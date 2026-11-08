// Starter test catalog for a pathology lab: common tests with their result parameters and
// reference ranges, plus two sample panels. Safe to run more than once: a test whose code already
// exists is left exactly as it is, so edits made in the app are never overwritten.
//
//   pnpm db:seed:lab
//
// IMPORTANT: the ranges below are common adult textbook values to get you started, and every price is
// 0 on purpose. The laboratory's pathologist must review the ranges (they depend on the analyser and
// reagent kit in use, and on the local population) and the management must set the prices before real
// patients are reported against them.
import dotenv from "dotenv";

type Db = typeof import("../src/lib/prisma").prisma;


type Sex = "ANY" | "MALE" | "FEMALE";
type Range = { sex?: Sex; low?: number; high?: number; criticalLow?: number; criticalHigh?: number; note?: string; minAge?: number; maxAge?: number };
type Parameter = [name: string, unit: string | null, ranges: Range[]];
type Test = { code: string; name: string; category: string; sample: string; hours: number; fasting?: boolean; prep?: string; parameters: Parameter[] };

const any = (low?: number, high?: number, extra: Partial<Range> = {}): Range[] => [{ sex: "ANY", low, high, ...extra }];
const mf = (male: [number, number], female: [number, number]): Range[] => [
  { sex: "MALE", low: male[0], high: male[1] },
  { sex: "FEMALE", low: female[0], high: female[1] },
];
const negative = (): Range[] => [{ sex: "ANY", note: "Negative" }];

export const TESTS: Test[] = [
  {
    code: "CBC", name: "Complete Blood Count (CBC)", category: "Haematology", sample: "Blood", hours: 6,
    parameters: [
      ["Haemoglobin", "g/dL", [{ sex: "MALE", low: 13, high: 17, criticalLow: 7 }, { sex: "FEMALE", low: 12, high: 15, criticalLow: 7 }]],
      ["Total WBC count", "x10³/µL", any(4, 11, { criticalLow: 2, criticalHigh: 30 })],
      ["Platelet count", "x10³/µL", any(150, 450, { criticalLow: 20, criticalHigh: 1000 })],
      ["PCV (Haematocrit)", "%", mf([40, 50], [36, 46])],
      ["MCV", "fL", any(80, 100)],
      ["MCH", "pg", any(27, 33)],
      ["MCHC", "g/dL", any(32, 36)],
    ],
  },
  { code: "ESR", name: "Erythrocyte Sedimentation Rate (ESR)", category: "Haematology", sample: "Blood", hours: 3, parameters: [["ESR (Westergren)", "mm/1st hr", mf([0, 15], [0, 20])]] },
  {
    code: "FBS", name: "Fasting Blood Sugar", category: "Biochemistry", sample: "Plasma", hours: 3, fasting: true, prep: "Fast for 8–10 hours. Water is allowed.",
    parameters: [["Fasting glucose", "mg/dL", any(70, 100, { criticalLow: 40, criticalHigh: 500 })]],
  },
  { code: "RBS", name: "Random Blood Sugar", category: "Biochemistry", sample: "Plasma", hours: 2, parameters: [["Random glucose", "mg/dL", any(70, 140, { criticalLow: 40, criticalHigh: 500 })]] },
  { code: "HBA1C", name: "HbA1c", category: "Biochemistry", sample: "Blood", hours: 24, parameters: [["HbA1c", "%", any(4, 5.6)]] },
  {
    code: "LIPID", name: "Lipid Profile", category: "Biochemistry", sample: "Serum", hours: 24, fasting: true, prep: "Fast for 10–12 hours. Water is allowed.",
    parameters: [
      ["Total cholesterol", "mg/dL", any(undefined, 200)],
      ["Triglycerides", "mg/dL", any(undefined, 150)],
      ["HDL cholesterol", "mg/dL", [{ sex: "MALE", low: 40 }, { sex: "FEMALE", low: 50 }]],
      ["LDL cholesterol", "mg/dL", any(undefined, 100)],
    ],
  },
  {
    code: "LFT", name: "Liver Function Test (LFT)", category: "Biochemistry", sample: "Serum", hours: 24,
    parameters: [
      ["Bilirubin (total)", "mg/dL", any(0.1, 1.2)],
      ["SGPT (ALT)", "U/L", any(7, 56)],
      ["SGOT (AST)", "U/L", any(10, 40)],
      ["Alkaline phosphatase", "U/L", any(44, 147)],
    ],
  },
  {
    code: "CREAT", name: "Serum Creatinine", category: "Biochemistry", sample: "Serum", hours: 6,
    parameters: [["Creatinine", "mg/dL", [{ sex: "MALE", low: 0.7, high: 1.3 }, { sex: "FEMALE", low: 0.6, high: 1.1 }]]],
  },
  { code: "UA", name: "Serum Uric Acid", category: "Biochemistry", sample: "Serum", hours: 6, parameters: [["Uric acid", "mg/dL", mf([3.5, 7.2], [2.6, 6])]] },
  { code: "TSH", name: "Thyroid Stimulating Hormone (TSH)", category: "Hormones", sample: "Serum", hours: 24, parameters: [["TSH", "mIU/L", any(0.4, 4)]] },
  {
    code: "URE", name: "Urine Routine Examination", category: "Urine", sample: "Urine", hours: 4, prep: "Collect a midstream sample in the container provided.",
    parameters: [
      ["pH", null, any(5, 8)],
      ["Specific gravity", null, any(1.005, 1.03)],
      ["Protein", null, negative()],
      ["Glucose", null, negative()],
    ],
  },
  { code: "NS1", name: "Dengue NS1 Antigen", category: "Serology", sample: "Serum", hours: 3, parameters: [["Dengue NS1 antigen", null, negative()]] },
  { code: "HBSAG", name: "HBsAg (Hepatitis B surface antigen)", category: "Serology", sample: "Serum", hours: 4, parameters: [["HBsAg", null, [{ sex: "ANY", note: "Non-reactive" }]]] },
];

export const PANELS = [
  { code: "DIABETES", name: "Diabetes Check Package", category: "Packages", tests: ["FBS", "HBA1C", "CREAT"] },
  { code: "BASIC-CHECK", name: "Basic Health Check-up", category: "Packages", tests: ["CBC", "FBS", "LIPID", "CREAT", "LFT"] },
];

/** Adds the starter tests and panels that are missing. Existing codes are never touched. */
export async function seedLabCatalog(prisma: Db) {
  let created = 0;
  let skipped = 0;
  for (const test of TESTS) {
    if (await prisma.clinicService.findUnique({ where: { code: test.code } })) { skipped++; continue; }
    await prisma.clinicService.create({
      data: {
        code: test.code, name: test.name, category: test.category, kind: "TEST",
        sampleType: test.sample, turnaroundHours: test.hours, fastingRequired: test.fasting ?? false, preparation: test.prep ?? null,
        standardPrice: 0, durationMinutes: 15,
        parameters: {
          create: test.parameters.map(([name, unit, ranges], index) => ({
            name, unit, sortOrder: index,
            ranges: {
              create: ranges.map((range) => ({
                sex: range.sex ?? "ANY", low: range.low ?? null, high: range.high ?? null,
                criticalLow: range.criticalLow ?? null, criticalHigh: range.criticalHigh ?? null,
                minAgeYears: range.minAge ?? null, maxAgeYears: range.maxAge ?? null, note: range.note ?? null,
              })),
            },
          })),
        },
      },
    });
    created++;
  }
  for (const panel of PANELS) {
    if (await prisma.clinicService.findUnique({ where: { code: panel.code } })) { skipped++; continue; }
    const members = await prisma.clinicService.findMany({ where: { code: { in: panel.tests }, kind: "TEST" }, select: { id: true } });
    await prisma.clinicService.create({
      data: {
        code: panel.code, name: panel.name, category: panel.category, kind: "PANEL", standardPrice: 0, durationMinutes: 15,
        sampleType: "Blood", turnaroundHours: 24,
        panelMembers: { create: members.map((member) => ({ testId: member.id })) },
      },
    });
    created++;
  }
  return { created, skipped };
}

async function main() {
  // The database client reads DATABASE_URL when it loads, so load the env files first.
  dotenv.config({ path: [".env.local", ".env"], quiet: true });
  const { prisma } = await import("../src/lib/prisma");
  const { created, skipped } = await seedLabCatalog(prisma);
  console.log(`Test catalog: ${created} added, ${skipped} already present. Prices are 0: set them in Tests & services.`);
}

// Run directly (pnpm db:seed:lab); importing this file for its data or seedLabCatalog() does nothing by itself.
if (process.argv[1]?.replaceAll("\\", "/").endsWith("prisma/seed-lab-tests.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
}
