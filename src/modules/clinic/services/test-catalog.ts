import type { Prisma } from "@/generated/prisma/client";
import type { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** What the list screen needs: the row plus how many parameters and panel tests it has. */
export const listInclude = { _count: { select: { parameters: true, panelMembers: true } } } satisfies Prisma.ClinicServiceInclude;

/** Everything the edit form needs. */
export const detailInclude = {
  _count: { select: { parameters: true, panelMembers: true } },
  parameters: { orderBy: { sortOrder: "asc" as const }, include: { ranges: { orderBy: [{ sex: "asc" as const }, { minAgeYears: "asc" as const }] } } },
  panelMembers: { include: { test: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.ClinicServiceInclude;

type ListRow = Prisma.ClinicServiceGetPayload<{ include: typeof listInclude }>;
type DetailRow = Prisma.ClinicServiceGetPayload<{ include: typeof detailInclude }>;

const dec = (value: Prisma.Decimal | null) => (value === null ? null : value.toString());

/** Decimals become strings so they survive JSON without losing precision. */
export function serializeService(service: ListRow | DetailRow) {
  const { _count, ...rest } = service;
  const detailed = service as Partial<DetailRow>;
  return {
    ...rest,
    standardPrice: service.standardPrice.toString(),
    feeMax: dec(service.feeMax),
    parameterCount: _count.parameters,
    panelTestCount: _count.panelMembers,
    parameters: detailed.parameters?.map((parameter) => ({
      id: parameter.id,
      name: parameter.name,
      unit: parameter.unit,
      ranges: parameter.ranges.map((range) => ({
        id: range.id,
        sex: range.sex,
        minAgeYears: dec(range.minAgeYears),
        maxAgeYears: dec(range.maxAgeYears),
        low: dec(range.low),
        high: dec(range.high),
        criticalLow: dec(range.criticalLow),
        criticalHigh: dec(range.criticalHigh),
        note: range.note,
      })),
    })),
    panelMembers: detailed.panelMembers?.map((member) => member.test),
  };
}

export type ParameterInput = { name: string; unit: string | null; ranges: Prisma.TestReferenceRangeCreateWithoutParameterInput[] };

/** Replaces all parameters (and their ranges) of a test. The list order becomes the display order. */
export async function replaceParameters(db: Db, testId: string, parameters: ParameterInput[]) {
  await db.testParameter.deleteMany({ where: { testId } });
  for (const [index, parameter] of parameters.entries()) {
    await db.testParameter.create({
      data: { testId, name: parameter.name, unit: parameter.unit, sortOrder: index, ranges: { create: parameter.ranges } },
    });
  }
}

/** Replaces the tests inside a panel. Every id must be a real TEST row; a panel cannot hold itself or another panel. */
export async function replacePanelMembers(db: Db, panelId: string, testIds: string[]): Promise<string | null> {
  if (testIds.includes(panelId)) return "A panel cannot contain itself.";
  if (testIds.length) {
    const found = await db.clinicService.count({ where: { id: { in: testIds }, kind: "TEST" } });
    if (found !== testIds.length) return "Every panel member must be an existing test.";
  }
  await db.testPanelItem.deleteMany({ where: { panelId } });
  if (testIds.length) await db.testPanelItem.createMany({ data: testIds.map((testId) => ({ panelId, testId })) });
  return null;
}
