// Pure rules of a lab order: what an order expands into, which samples it needs, and which status
// the order is in. No database access here, so every rule can be tested on its own.

export type CatalogKind = "SERVICE" | "TEST" | "PANEL";
export type OrderStatus = "ORDERED" | "SAMPLE_COLLECTED" | "RECEIVED" | "IN_PROCESS" | "RESULT_ENTERED" | "VERIFIED" | "DELIVERED" | "CANCELLED";
export type SampleState = "PENDING" | "COLLECTED" | "RECEIVED" | "REJECTED";

export type CatalogMember = { id: string; code: string; name: string; sampleType: string | null; isActive: boolean };
export type CatalogRow = {
  id: string;
  code: string;
  name: string;
  kind: CatalogKind;
  isActive: boolean;
  standardPrice: number;
  sampleType: string | null;
  /** Tests inside a PANEL; empty for other kinds. */
  members: CatalogMember[];
};

export type PlannedTest = { testId: string; code: string; name: string; sampleType: string | null; panelId: string | null };
export type PlannedInvoiceItem = { serviceId: string; description: string; quantity: 1; unitPrice: number };
export type OrderPlan = { invoiceItems: PlannedInvoiceItem[]; tests: PlannedTest[] };

/** "Blood", " blood " and "BLOOD" are the same sample; "None", blank and null mean nothing is collected. */
export function normaliseSampleType(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text || text.toLowerCase() === "none") return null;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Turns what the receptionist picked (tests, panels and plain services) into invoice lines and the
 * list of tests to perform. A panel is billed once, at its own price, and expands into its member
 * tests. Picking the same test twice (alone and inside a panel, or in two panels) is refused: it
 * would be reported twice and the patient could be charged twice for one result.
 */
export function planOrder(picked: CatalogRow[]): { plan: OrderPlan } | { error: string } {
  if (!picked.length) return { error: "Choose at least one test." };
  const ids = new Set<string>();
  for (const row of picked) {
    if (ids.has(row.id)) return { error: `${row.name} is selected twice.` };
    ids.add(row.id);
    if (!row.isActive) return { error: `${row.name} is no longer available.` };
  }

  const tests: PlannedTest[] = [];
  const owner = new Map<string, string>(); // testId -> the picked row that brings it in
  const bring = (test: CatalogMember, via: CatalogRow, panelId: string | null): string | null => {
    const earlier = owner.get(test.id);
    if (earlier) return `${test.name} is already included in ${earlier}. Remove one of them.`;
    owner.set(test.id, via.name);
    tests.push({ testId: test.id, code: test.code, name: test.name, sampleType: normaliseSampleType(test.sampleType), panelId });
    return null;
  };

  for (const row of picked) {
    if (row.kind === "TEST") {
      const problem = bring({ id: row.id, code: row.code, name: row.name, sampleType: row.sampleType, isActive: row.isActive }, row, null);
      if (problem) return { error: problem };
    } else if (row.kind === "PANEL") {
      if (!row.members.length) return { error: `${row.name} has no tests in it.` };
      for (const member of row.members) {
        if (!member.isActive) return { error: `${row.name} contains ${member.name}, which is disabled.` };
        const problem = bring(member, row, row.id);
        if (problem) return { error: problem };
      }
    }
    // A plain SERVICE (e.g. home sample collection) is only billed: it has nothing to perform.
  }

  return {
    plan: {
      invoiceItems: picked.map((row) => ({ serviceId: row.id, description: row.name, quantity: 1 as const, unitPrice: row.standardPrice })),
      tests,
    },
  };
}

/** Groups tests by the sample they share. Tests that need no sample are returned separately. */
export function groupBySample(tests: PlannedTest[]) {
  const groups = new Map<string, PlannedTest[]>();
  const withoutSample: PlannedTest[] = [];
  for (const test of tests) {
    if (!test.sampleType) { withoutSample.push(test); continue; }
    groups.set(test.sampleType, [...(groups.get(test.sampleType) ?? []), test]);
  }
  return { groups, withoutSample };
}

/** Statuses that belong to sample handling. From IN_PROCESS on, result entry owns the order. */
const SAMPLE_PHASE: readonly OrderStatus[] = ["ORDERED", "SAMPLE_COLLECTED", "RECEIVED"];
/** Statuses that follow the results of the tests, once every sample is in the lab. */
const RESULT_PHASE: readonly OrderStatus[] = ["RECEIVED", "IN_PROCESS", "RESULT_ENTERED", "VERIFIED"];

export type ResultState = "PENDING" | "ENTERED" | "VERIFIED";

/**
 * The status an order should have, given its samples and (once the lab is working) its tests' results.
 *  - Sample phase: rejected samples are ignored because each is replaced by a new pending one; an order
 *    with nothing to collect is ready for the lab at once.
 *  - Result phase: IN_PROCESS once any test has a result, RESULT_ENTERED when all do, VERIFIED when the
 *    pathologist has approved all. A test sent back for correction moves the order back a step.
 * Cancelled and delivered orders keep their status.
 */
export function deriveOrderStatus(current: OrderStatus, samples: { status: SampleState }[], items?: { resultStatus: ResultState }[]): OrderStatus {
  let status = current;
  if (SAMPLE_PHASE.includes(status)) {
    const live = samples.filter((sample) => sample.status !== "REJECTED");
    if (!live.length) status = "RECEIVED";
    else if (live.some((sample) => sample.status === "PENDING")) return "ORDERED";
    else status = live.every((sample) => sample.status === "RECEIVED") ? "RECEIVED" : "SAMPLE_COLLECTED";
  }
  if (!items?.length || !RESULT_PHASE.includes(status) || !RESULT_PHASE.includes(current)) return status;
  if (items.every((item) => item.resultStatus === "VERIFIED")) return "VERIFIED";
  if (items.every((item) => item.resultStatus !== "PENDING")) return "RESULT_ENTERED";
  if (items.some((item) => item.resultStatus !== "PENDING")) return "IN_PROCESS";
  return "RECEIVED";
}

/** An order can be cancelled until result entry starts. */
export const canCancelOrder = (status: OrderStatus) => SAMPLE_PHASE.includes(status);
/** A sample can be rejected (and replaced) while the order is still in the sample phase. */
export const canChangeSamples = (status: OrderStatus) => SAMPLE_PHASE.includes(status);
