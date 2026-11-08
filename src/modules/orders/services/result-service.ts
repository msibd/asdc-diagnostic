import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { OrderError, syncOrderStatus, type AuditRecorder } from "@/modules/orders/services/order-service";
import {
  ageYearsAt, evaluateValue, formatReference, isCritical, noRangeMessage, pickReferenceRange,
  type PatientFacts, type RangeRow, type ResultFlag,
} from "@/modules/orders/services/result-rules";

// ---------------------------------------------------------------- reading the entry sheet

type RangeRecord = { sex: "ANY" | "MALE" | "FEMALE"; minAgeYears: Prisma.Decimal | null; maxAgeYears: Prisma.Decimal | null; low: Prisma.Decimal | null; high: Prisma.Decimal | null; criticalLow: Prisma.Decimal | null; criticalHigh: Prisma.Decimal | null; note: string | null };
const num = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

export const toRangeRow = (range: RangeRecord): RangeRow => ({
  sex: range.sex,
  minAgeYears: num(range.minAgeYears), maxAgeYears: num(range.maxAgeYears),
  low: num(range.low), high: num(range.high),
  criticalLow: num(range.criticalLow), criticalHigh: num(range.criticalHigh),
  note: range.note,
});

export type SheetParameter = {
  name: string;
  unit: string | null;
  /** What was saved last time ("" if nothing yet). */
  value: string;
  flag: ResultFlag | null;
  /** The reference text printed with the result: the saved snapshot, or the range that applies now. */
  referenceText: string | null;
  /** The range that applies to this patient, so the screen can preview a flag while typing. */
  range: RangeRow | null;
  /** Why no range applies, when none does. */
  rangeProblem: string | null;
  /** True for a saved result whose parameter has since been removed from the catalog. */
  retired: boolean;
};

export type SheetItem = {
  itemId: string;
  testId: string;
  testCode: string;
  testName: string;
  panelName: string | null;
  resultStatus: "PENDING" | "ENTERED" | "VERIFIED";
  /** True when the test has no parameters and is reported as free text. */
  freeText: boolean;
  resultText: string | null;
  resultNote: string | null;
  returnReason: string | null;
  enteredBy: string | null;
  enteredAt: Date | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  parameters: SheetParameter[];
};

const itemInclude = {
  panel: { select: { name: true } },
  results: { orderBy: { sortOrder: "asc" as const } },
  test: { select: { parameters: { orderBy: { sortOrder: "asc" as const }, include: { ranges: true } } } },
} satisfies Prisma.TestOrderItemInclude;

/** The patient facts that decide which range applies, as they were when the order was placed. */
export function patientFacts(patient: { sex: "MALE" | "FEMALE" | "OTHER" | null; dateOfBirth: Date | null }, orderedAt: Date): PatientFacts {
  return { sex: patient.sex, ageYears: ageYearsAt(patient.dateOfBirth, orderedAt) };
}

/** Every test of the order with its parameters, applicable ranges and any results saved so far. */
export async function loadResultSheet(orderId: string) {
  const order = await prisma.testOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderCode: true, status: true, orderedAt: true,
      patient: { select: { name: true, sex: true, dateOfBirth: true } },
      items: { orderBy: { testName: "asc" }, include: itemInclude },
    },
  });
  if (!order) return null;
  const facts = patientFacts(order.patient, order.orderedAt);

  const items: SheetItem[] = order.items.map((item) => {
    const saved = new Map(item.results.map((result) => [result.parameterName, result]));
    const catalog = item.test.parameters;
    const parameters: SheetParameter[] = catalog.map((parameter) => {
      const picked = pickReferenceRange(parameter.ranges.map(toRangeRow), facts);
      const result = saved.get(parameter.name);
      return {
        name: parameter.name,
        unit: parameter.unit,
        value: result?.value ?? "",
        flag: result?.flag ?? null,
        referenceText: result ? result.referenceText : formatReference(picked.range),
        range: picked.range,
        rangeProblem: picked.range ? null : noRangeMessage(picked.reason),
        retired: false,
      };
    });
    // Results saved for a parameter that was later removed from the catalog are still shown, read-only.
    const known = new Set(catalog.map((parameter) => parameter.name));
    for (const result of item.results) {
      if (!known.has(result.parameterName)) {
        parameters.push({ name: result.parameterName, unit: result.unit, value: result.value, flag: result.flag, referenceText: result.referenceText, range: null, rangeProblem: null, retired: true });
      }
    }
    return {
      itemId: item.id, testId: item.testId, testCode: item.testCode, testName: item.testName, panelName: item.panel?.name ?? null,
      resultStatus: item.resultStatus, freeText: catalog.length === 0 && item.results.length === 0,
      resultText: item.resultText, resultNote: item.resultNote, returnReason: item.returnReason,
      enteredBy: item.enteredBy, enteredAt: item.enteredAt, verifiedBy: item.verifiedBy, verifiedAt: item.verifiedAt,
      parameters,
    };
  });

  return { orderId: order.id, orderCode: order.orderCode, status: order.status, patient: { name: order.patient.name, ...facts }, items };
}

// ---------------------------------------------------------------- saving results

/** Statuses in which the lab may enter or change results. */
const ENTRY_STATUSES = ["RECEIVED", "IN_PROCESS", "RESULT_ENTERED"] as const;

function lockedMessage(status: string): string {
  if (status === "CANCELLED") return "This order was cancelled.";
  if (status === "DELIVERED") return "The report for this order has been released. Withdraw the report first to change a result.";
  if (status === "VERIFIED") return "This order's results are approved. The pathologist must send a test back before it can be changed.";
  return "Results can be entered only after every sample has reached the lab.";
}

export type SaveInput = { values: { name: string; value: string }[]; text: string | null; note: string | null };

/** Saves (or replaces) the results of one test, works out each flag, and marks the test as entered. */
export async function saveResults(itemId: string, input: SaveInput, actorName: string, record: AuditRecorder) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.testOrderItem.findUnique({
      where: { id: itemId },
      include: {
        order: { select: { id: true, orderCode: true, status: true, orderedAt: true, patient: { select: { sex: true, dateOfBirth: true } } } },
        test: { select: { parameters: { orderBy: { sortOrder: "asc" }, include: { ranges: true } } } },
      },
    });
    if (!item) throw new OrderError("Test not found.", 404);
    if (!(ENTRY_STATUSES as readonly string[]).includes(item.order.status)) throw new OrderError(lockedMessage(item.order.status), 409);
    if (item.resultStatus === "VERIFIED") throw new OrderError("This test is already approved. The pathologist must send it back before it can be changed.", 409);

    const parameters = item.test.parameters;
    let rows: Prisma.TestResultCreateManyInput[] = [];
    let criticalCount = 0;
    let resultText: string | null = null;

    if (!parameters.length) {
      resultText = input.text?.trim() || null;
      if (!resultText) throw new OrderError(`Write the result of ${item.testName}.`);
    } else {
      const byName = new Map(parameters.map((parameter) => [parameter.name, parameter]));
      for (const entry of input.values) if (!byName.has(entry.name)) throw new OrderError(`${entry.name} is not a parameter of ${item.testName}.`);
      const typed = new Map(input.values.map((entry) => [entry.name, entry.value.trim()]));
      const facts = patientFacts(item.order.patient, item.order.orderedAt);

      for (const [index, parameter] of parameters.entries()) {
        const value = typed.get(parameter.name);
        if (!value) continue; // left blank: not reported
        const { range } = pickReferenceRange(parameter.ranges.map(toRangeRow), facts);
        const evaluated = evaluateValue(value, range, parameter.name);
        if ("error" in evaluated) throw new OrderError(evaluated.error);
        if (isCritical(evaluated.flag)) criticalCount += 1;
        rows.push({
          itemId, parameterName: parameter.name, unit: parameter.unit, sortOrder: index,
          value, numericValue: evaluated.numericValue, flag: evaluated.flag, referenceText: formatReference(range),
        });
      }
      if (!rows.length) throw new OrderError("Enter at least one result.");
      rows = rows.map((row, position) => ({ ...row, sortOrder: row.sortOrder ?? position }));
    }

    await tx.testResult.deleteMany({ where: { itemId } });
    if (rows.length) await tx.testResult.createMany({ data: rows });
    await tx.testOrderItem.update({
      where: { id: itemId },
      data: {
        resultStatus: "ENTERED", resultText, resultNote: input.note?.trim() || null,
        enteredBy: actorName, enteredAt: new Date(), returnReason: null, verifiedBy: null, verifiedAt: null,
      },
    });
    await syncOrderStatus(tx, item.order.id);
    await record(tx, "ENTER", "TestOrderItem", itemId, { orderCode: item.order.orderCode, test: item.testCode, values: rows.length, critical: criticalCount });
    return item.order.id;
  });
}

// ---------------------------------------------------------------- approving or sending back

/**
 * The pathologist approves results ("verify") or sends them back for correction ("return").
 * With an itemId it acts on that test; without one, "verify" approves every test that has results
 * waiting, which is how a whole order is signed off in one go.
 * Approval is recorded with who and when, and a test that was entered by the same person is allowed
 * (a one-person lab has no one else) but both names are kept on the record.
 */
export async function reviewResults(
  orderId: string,
  change: { action: "verify"; itemId?: string } | { action: "return"; itemId: string; reason: string },
  actorName: string,
  record: AuditRecorder,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.testOrder.findUnique({ where: { id: orderId }, select: { id: true, orderCode: true, status: true, items: { select: { id: true, testCode: true, resultStatus: true } } } });
    if (!order) throw new OrderError("Order not found.", 404);
    if (order.status === "CANCELLED") throw new OrderError("This order was cancelled.", 409);
    if (order.status === "DELIVERED") throw new OrderError("The report for this order has been released. Withdraw the report first to change a result.", 409);
    if (!["IN_PROCESS", "RESULT_ENTERED", "VERIFIED"].includes(order.status)) throw new OrderError("No results have been entered for this order yet.", 409);

    const target = change.itemId ? order.items.filter((item) => item.id === change.itemId) : order.items;
    if (change.itemId && !target.length) throw new OrderError("Test not found on this order.", 404);

    if (change.action === "verify") {
      const waiting = target.filter((item) => item.resultStatus === "ENTERED");
      if (!waiting.length) throw new OrderError(change.itemId ? "This test has no results waiting for approval." : "There are no results waiting for approval.", 409);
      await tx.testOrderItem.updateMany({
        where: { id: { in: waiting.map((item) => item.id) }, resultStatus: "ENTERED" },
        data: { resultStatus: "VERIFIED", verifiedBy: actorName, verifiedAt: new Date(), returnReason: null },
      });
      for (const item of waiting) await record(tx, "VERIFY", "TestOrderItem", item.id, { orderCode: order.orderCode, test: item.testCode });
    } else {
      const [item] = target;
      if (item.resultStatus === "PENDING") throw new OrderError("This test has no results to send back.", 409);
      await tx.testOrderItem.update({ where: { id: item.id }, data: { resultStatus: "PENDING", returnReason: change.reason, verifiedBy: null, verifiedAt: null } });
      await record(tx, "RETURN", "TestOrderItem", item.id, { orderCode: order.orderCode, test: item.testCode, reason: change.reason });
    }
    await syncOrderStatus(tx, order.id);
    return order.id;
  });
}
