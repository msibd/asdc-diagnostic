// Demo data for a fictional diagnostic center: repeatable and safe to run more than once.
//
//   pnpm db:seed:demo
//
// Every record this script owns belongs to a "demo-" patient, user, service or booking, so a re-run
// first removes exactly those rows and recreates them (dates are relative to today). Nothing else is
// touched. All people, phone numbers and e-mail addresses are fictional. See SEEDING.md for the logins.
//
// The lab orders are NOT inserted row by row. They are driven through the same functions the app
// uses (place the order, collect and receive samples, enter results, approve, release the report), so
// every flag, status, invoice and report in the demo is exactly what the real screens would produce.
import dotenv from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { seedLabCatalog } from "./seed-lab-tests";
import type { AppointmentSource, AppointmentStatus, ExpenseCategory, PaymentMethod } from "../src/generated/prisma/client";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? "Demo-Admin#2026";
const DEMO_RECEPTION_PASSWORD = process.env.DEMO_RECEPTIONIST_PASSWORD ?? "Demo-Front#2026";
const DEMO_LAB_PASSWORD = process.env.DEMO_LAB_PASSWORD ?? "Demo-Lab#2026";
const DEMO_PATHOLOGIST_PASSWORD = process.env.DEMO_PATHOLOGIST_PASSWORD ?? "Demo-Patho#2026";

// ---------------------------------------------------------------- helpers

// Small deterministic generator so every run picks the same "random" values.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20261112);
const pad = (value: number, width = 2) => String(value).padStart(width, "0");

// ---------------------------------------------------------------- fictional reference data

const maleNames = ["Rahim Uddin", "Karim Hossain", "Jamal Chowdhury", "Imran Ahmed", "Sabbir Rahman", "Tanvir Islam", "Mahfuz Alam", "Nayeem Khan", "Fahim Sarker", "Arif Mahmud", "Shakil Mia", "Zahid Hasan", "Rubel Sheikh", "Monir Talukder", "Hasan Mahmud"] as const;
const femaleNames = ["Nusrat Jahan", "Farhana Akter", "Sumaiya Khatun", "Tasnim Sultana", "Mou Begum", "Rima Parvin", "Shirin Akhter", "Nadia Islam", "Lamia Rahman", "Afsana Mimi", "Sadia Afrin", "Jannatul Ferdous", "Rokeya Sultana", "Mahmuda Khanom", "Salma Begum"] as const;
const areas = ["Dhanmondi", "Mirpur", "Uttara", "Mohammadpur", "Gulshan", "Banani", "Rampura", "Bashundhara", "Malibagh", "Motijheel"];
const histories = [null, null, null, null, null, "Type 2 diabetes, controlled with medication.", "Hypertension; takes amlodipine daily.", "Asthma; carries an inhaler.", "Thyroid condition, on levothyroxine.", "Chronic kidney disease, stage 2."] as const;
const allergyList = [null, null, null, null, null, null, "Penicillin", "Latex", "Ibuprofen", "Sulfa drugs"] as const;
const referrers = ["Dr. Mizanur Rahman", "Dr. Shahana Parvin", "Dr. Tahmid Hasan", "Square Hospital OPD", "Dr. Rezaul Karim", null] as const;

// Prices of the fictional price list. Applied only to catalog rows that still have price 0, so
// prices someone has already set in the app are never overwritten.
const DEMO_PRICES: Record<string, number> = {
  CBC: 450, ESR: 200, FBS: 150, RBS: 120, HBA1C: 800, LIPID: 1200, LFT: 1100, CREAT: 400, UA: 350, TSH: 900,
  URE: 200, NS1: 800, HBSAG: 500, DIABETES: 1500, "BASIC-CHECK": 3500,
};

// A typical value for each parameter: [normal, abnormal, critical (where one exists)].
const VALUES: Record<string, Record<string, [string, string, string?]>> = {
  CBC: { Haemoglobin: ["14.2", "10.8", "6.4"], "Total WBC count": ["7.2", "14.5", "31"], "Platelet count": ["250", "110", "15"], "PCV (Haematocrit)": ["42", "31"], MCV: ["90", "72"], MCH: ["29", "24"], MCHC: ["34", "30"] },
  ESR: { "ESR (Westergren)": ["8", "42"] },
  FBS: { "Fasting glucose": ["88", "132", "520"] },
  RBS: { "Random glucose": ["110", "210", "38"] },
  HBA1C: { HbA1c: ["5.2", "8.4"] },
  LIPID: { "Total cholesterol": ["170", "260"], Triglycerides: ["120", "340"], "HDL cholesterol": ["52", "31"], "LDL cholesterol": ["90", "170"] },
  LFT: { "Bilirubin (total)": ["0.8", "3.2"], "SGPT (ALT)": ["28", "145"], "SGOT (AST)": ["24", "98"], "Alkaline phosphatase": ["90", "320"] },
  CREAT: { Creatinine: ["0.9", "2.4"] },
  UA: { "Uric acid": ["5.1", "8.8"] },
  TSH: { TSH: ["2.1", "9.5"] },
  URE: { pH: ["6", "6"], "Specific gravity": ["1.015", "1.025"], Protein: ["Negative", "Positive"], Glucose: ["Negative", "Positive"] },
  NS1: { "Dengue NS1 antigen": ["Negative", "Positive"] },
  HBSAG: { HBsAg: ["Non-reactive", "Reactive"] },
};

const patientCount = 30;
const patients = Array.from({ length: patientCount }, (_, index) => {
  const n = index + 1;
  const male = n % 2 === 1;
  const name = male ? maleNames[(n - 1) / 2] : femaleNames[(n - 2) / 2];
  const child = n === 29;
  return {
    id: `demo-patient-${pad(n)}`,
    // Same PID format real patients get (PID-10001, PID-10002 …); the demo patients take the first thirty numbers.
    patientCode: `PID-${pad(10000 + n, 5)}`,
    name: child ? "Ayaan Rahman" : name,
    phone: `0170000${pad(n, 4)}`,
    email: n % 3 === 0 ? `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@demo.example` : null,
    // One child, one patient whose sex is not recorded (to show the "no range" warning), the rest adults.
    sex: n === 30 ? null : child ? "MALE" as const : male ? "MALE" as const : "FEMALE" as const,
    dateOfBirth: child ? new Date(Date.UTC(2019, 4, 14)) : new Date(Date.UTC(1962 + ((n * 7) % 45), (n * 5) % 12, 1 + ((n * 11) % 27))),
    address: `House ${10 + n}, Road ${1 + (n % 12)}, ${areas[n % areas.length]}, Dhaka`,
    emergencyContactName: `${maleNames[n % maleNames.length]} (family)`,
    emergencyContactPhone: `0171000${pad(n, 4)}`,
    medicalHistory: histories[n % histories.length],
    allergies: allergyList[(n * 3) % allergyList.length],
    createdAt: new Date(Date.now() - (60 - n) * 86_400_000),
  };
});

type Stage = "ordered" | "collected" | "received" | "partial" | "entered" | "verified" | "released" | "cancelled";
type OrderSpec = {
  patient: number; codes: string[]; daysAgo: number; stage: Stage; pay: "full" | "partial" | "split" | "none";
  priority?: "URGENT"; critical?: boolean; reject?: boolean; correction?: boolean; sms?: boolean; views?: number; notes?: string;
};

const orderSpecs: OrderSpec[] = [
  // Released reports: the history
  { patient: 1, codes: ["CBC", "FBS"], daysAgo: 18, stage: "released", pay: "full", sms: true, views: 2 },
  { patient: 2, codes: ["LIPID"], daysAgo: 16, stage: "released", pay: "full", sms: true, views: 1 },
  { patient: 3, codes: ["BASIC-CHECK"], daysAgo: 14, stage: "released", pay: "split", notes: "Annual health check-up." },
  { patient: 4, codes: ["HBA1C", "CREAT"], daysAgo: 12, stage: "released", pay: "none", notes: "Report released; payment still due." },
  { patient: 5, codes: ["TSH"], daysAgo: 10, stage: "released", pay: "full", sms: true, views: 1 },
  { patient: 6, codes: ["CBC"], daysAgo: 9, stage: "released", pay: "full", critical: true, notes: "Fever and weakness." },
  { patient: 7, codes: ["DIABETES"], daysAgo: 8, stage: "released", pay: "partial", correction: true, sms: true },
  { patient: 8, codes: ["NS1", "CBC"], daysAgo: 6, stage: "released", pay: "full", notes: "Fever for 3 days." },
  { patient: 30, codes: ["FBS"], daysAgo: 4, stage: "released", pay: "full" },
  { patient: 29, codes: ["NS1"], daysAgo: 5, stage: "released", pay: "full", notes: "Child, fever for 2 days." },
  // Approved, waiting for the pathologist to release
  { patient: 9, codes: ["LFT"], daysAgo: 3, stage: "verified", pay: "full" },
  { patient: 10, codes: ["URE", "RBS"], daysAgo: 2, stage: "verified", pay: "partial" },
  // Results entered, waiting for approval
  { patient: 11, codes: ["CBC", "ESR"], daysAgo: 2, stage: "entered", pay: "full" },
  { patient: 12, codes: ["UA", "CREAT"], daysAgo: 1, stage: "entered", pay: "none" },
  { patient: 13, codes: ["FBS"], daysAgo: 1, stage: "entered", pay: "full", critical: true },
  // Some results in
  { patient: 14, codes: ["CBC", "LIPID", "FBS"], daysAgo: 1, stage: "partial", pay: "full" },
  { patient: 15, codes: ["LFT", "CREAT"], daysAgo: 0, stage: "partial", pay: "partial" },
  // In the lab, no results yet
  { patient: 16, codes: ["HBSAG", "NS1"], daysAgo: 0, stage: "received", pay: "full", priority: "URGENT" },
  { patient: 17, codes: ["TSH", "UA"], daysAgo: 0, stage: "received", pay: "none" },
  { patient: 23, codes: ["CBC"], daysAgo: 1, stage: "received", pay: "full", reject: true, notes: "First sample was haemolysed; recollected." },
  // Collected, on the way to the lab
  { patient: 18, codes: ["CBC", "URE"], daysAgo: 0, stage: "collected", pay: "full" },
  { patient: 19, codes: ["LIPID"], daysAgo: 0, stage: "collected", pay: "partial" },
  // Waiting for collection
  { patient: 20, codes: ["BASIC-CHECK", "HOMECOL"], daysAgo: 0, stage: "ordered", pay: "none", priority: "URGENT", notes: "Home collection requested." },
  { patient: 21, codes: ["RBS"], daysAgo: 0, stage: "ordered", pay: "full" },
  { patient: 22, codes: ["URE"], daysAgo: 0, stage: "ordered", pay: "none" },
  // Cancelled
  { patient: 24, codes: ["TSH"], daysAgo: 2, stage: "cancelled", pay: "none" },
];

// ---------------------------------------------------------------- main

async function main() {
  // The database client reads DATABASE_URL when it loads, so it is imported only after the env files.
  const { prisma } = await import("../src/lib/prisma");
  const { addClinicDays, getClinicDateKey } = await import("../src/lib/clinic-date");
  const { invoiceTotalCents, paidCents, statusForPayments } = await import("../src/modules/billing/services/invoice-math");
  const { cancelOrder, changeSample, createOrder } = await import("../src/modules/orders/services/order-service");
  const { reviewResults, saveResults } = await import("../src/modules/orders/services/result-service");
  const { releaseReport, withdrawReport } = await import("../src/modules/orders/services/report-service");
  const { deriveOrderStatus } = await import("../src/modules/orders/services/order-rules");

  const today = getClinicDateKey(new Date());
  const dayKey = (offset: number) => addClinicDays(today, offset);
  /** A clinic-local (Asia/Dhaka) wall-clock time on a day `offset` days from today. */
  const at = (offset: number, hhmm: string) => new Date(`${dayKey(offset)}T${hhmm}:00+06:00`);
  const dateOnly = (offset: number) => new Date(`${dayKey(offset)}T00:00:00.000Z`);

  type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  type Recorder = Parameters<typeof createOrder>[1];

  const staff = [
    { id: "demo-user-admin", name: "Dr. Anika Rahman (Admin)", email: "admin@demo.example", role: "admin", password: DEMO_ADMIN_PASSWORD },
    { id: "demo-user-reception", name: "Sabina Khatun (Reception)", email: "reception@demo.example", role: "receptionist", password: DEMO_RECEPTION_PASSWORD },
    { id: "demo-user-lab", name: "Rafiq Hasan (Lab)", email: "lab@demo.example", role: "lab_staff", password: DEMO_LAB_PASSWORD },
    { id: "demo-user-pathologist", name: "Dr. Anika Rahman (Pathologist)", email: "pathologist@demo.example", role: "pathologist", password: DEMO_PATHOLOGIST_PASSWORD },
  ];
  const demoUserIds = staff.map((person) => person.id);
  const actor = { reception: staff[1], lab: staff[2], pathologist: staff[3] };

  /** Audit recorder for the app's own functions, attributing each step to the right demo user. */
  const recorderFor = (userId: string): Recorder => async (db, action, entity, entityId, details) => {
    await db.auditEvent.create({ data: { actorId: userId, action, entity, entityId, details: details ?? undefined, ipAddress: "127.0.0.1" } });
  };

  async function assertSafeTarget() {
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data when NODE_ENV=production.");
    const notDemo = { NOT: { id: { startsWith: "demo-" } } };
    const [foreignPatients, foreignOrders, foreignInvoices] = await Promise.all([
      prisma.patient.count({ where: notDemo }), prisma.testOrder.count({ where: { patient: notDemo } }), prisma.invoice.count({ where: { patient: notDemo } }),
    ]);
    if ((foreignPatients || foreignOrders || foreignInvoices) && !process.argv.includes("--allow-existing-data")) {
      throw new Error(
        `This database already contains real records (${foreignPatients} patients, ${foreignOrders} orders, ${foreignInvoices} invoices). ` +
        "Demo data is meant for an empty development database. Use a separate database, or pass --allow-existing-data to add the demo rows next to the existing ones.",
      );
    }
  }

  async function wipeDemoRows() {
    const demo = { id: { startsWith: "demo-" } };
    const ofDemoPatient = { patient: demo };
    await prisma.$transaction(async (tx: Tx) => {
      await tx.labReport.deleteMany({ where: { order: ofDemoPatient } });
      await tx.testResult.deleteMany({ where: { item: { order: ofDemoPatient } } });
      await tx.testOrderItem.deleteMany({ where: { order: ofDemoPatient } });
      // Replacement samples point at the one they replace, so they go first.
      await tx.sample.deleteMany({ where: { order: ofDemoPatient, replacesId: { not: null } } });
      await tx.sample.deleteMany({ where: { order: ofDemoPatient } });
      await tx.testOrder.deleteMany({ where: ofDemoPatient });
      await tx.payment.deleteMany({ where: { invoice: ofDemoPatient } });
      await tx.invoiceItem.deleteMany({ where: { invoice: ofDemoPatient } });
      await tx.invoice.deleteMany({ where: ofDemoPatient });
      await tx.appointment.deleteMany({ where: { OR: [demo, ofDemoPatient] } });
      await tx.expense.deleteMany({ where: demo });
      await tx.patient.deleteMany({ where: demo });
      await tx.clinicService.deleteMany({ where: demo });
      await tx.auditEvent.deleteMany({ where: { actorId: { in: demoUserIds } } });
    }, { timeout: 60_000 });
  }

  async function seedStaff() {
    for (const person of staff) {
      await prisma.user.upsert({
        where: { id: person.id },
        create: { id: person.id, name: person.name, email: person.email, emailVerified: true, role: person.role },
        update: { name: person.name, role: person.role },
      });
      // The password is only set when the account is first created, so a re-run never overwrites a
      // password someone changed; it is stored hashed (scrypt) exactly as Better Auth does.
      const existing = await prisma.account.findUnique({ where: { id: `demo-acct-${person.id}` } });
      if (!existing) {
        await prisma.account.create({ data: { id: `demo-acct-${person.id}`, accountId: person.id, providerId: "credential", userId: person.id, password: await hashPassword(person.password) } });
      }
    }
  }

  async function seedCenterProfile() {
    // One contact profile per center; it supplies the report letterhead. An existing one is left as it is.
    const existing = await prisma.doctorProfile.findUnique({ where: { id: "primary" }, include: { schedules: true } });
    if (!existing) {
      await prisma.doctorProfile.create({
        data: {
          id: "primary", slug: "dr-anika-rahman", isActive: true, isPublished: true, displayOrder: 0,
          name: "Dr. Anika Rahman", designation: "Consultant Pathologist", qualifications: "MBBS, MD (Pathology)",
          specialization: "Pathology, Haematology", experienceYears: 12,
          // No registration number and no photo: demo data must not look like a verified credential or a real person.
          registrationNumber: null, imageUrl: null, consultationFee: 0,
          phone: "01700000000", email: "info@demo.example",
          address: "ASDC Diagnostic (demo), Road 5, Dhanmondi, Dhaka",
          bio: "Sample profile created with the demonstration data; it describes a fictional doctor.\n\nDr. Rahman reviews and signs laboratory reports, with a focus on blood disorders and routine diagnostic pathology. Replace this text with the real doctor's biography.",
          consultationInfo: "Sample text: appointments are by serial. Please bring previous reports.",
        },
      });
    }
    if (!existing?.schedules.length) {
      // Saturday to Thursday, 07:30-20:00; Friday closed.
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
        await prisma.doctorSchedule.upsert({
          where: { doctorId_dayOfWeek: { doctorId: "primary", dayOfWeek } },
          create: { doctorId: "primary", dayOfWeek, startTime: "07:30", endTime: "20:00", isWorking: dayOfWeek !== 5 },
          update: {},
        });
      }
    }
    return prisma.doctorSchedule.findMany({ where: { doctorId: "primary", isWorking: true } });
  }

  /** Makes the catalog the demo needs: the starter tests (priced if still free) plus a home-collection service. */
  async function seedCatalog() {
    const added = await seedLabCatalog(prisma);
    let priced = 0;
    for (const [code, price] of Object.entries(DEMO_PRICES)) {
      const done = await prisma.clinicService.updateMany({ where: { code, standardPrice: 0 }, data: { standardPrice: price } });
      priced += done.count;
    }
    await prisma.clinicService.create({
      data: { id: "demo-svc-home", code: "HOMECOL", name: "Home sample collection", category: "Services", kind: "SERVICE", standardPrice: 300, durationMinutes: 45, description: "A phlebotomist visits the patient at home (demo price)." },
    });
    return { testsAdded: added.created, priced };
  }

  /** Moves everything an order has already recorded back in time, so the demo has a believable history. */
  async function backdate(orderId: string, days: number) {
    if (days <= 0) return;
    const back = (column: string) => `"${column}" = "${column}" - (${days} * INTERVAL '1 day')`;
    await prisma.$executeRawUnsafe(`UPDATE "TestOrder" SET ${back("orderedAt")}, ${back("createdAt")} WHERE id = $1`, orderId);
    await prisma.$executeRawUnsafe(`UPDATE "Sample" SET ${back("createdAt")}, ${back("collectedAt")}, ${back("receivedAt")}, ${back("rejectedAt")} WHERE "orderId" = $1`, orderId);
    await prisma.$executeRawUnsafe(`UPDATE "TestOrderItem" SET ${back("enteredAt")}, ${back("verifiedAt")} WHERE "orderId" = $1`, orderId);
    await prisma.$executeRawUnsafe(`UPDATE "LabReport" SET ${back("issuedAt")}, ${back("withdrawnAt")}, ${back("smsSentAt")}, ${back("firstViewedAt")} WHERE "orderId" = $1`, orderId);
    await prisma.$executeRawUnsafe(`UPDATE "Invoice" SET ${back("issuedAt")}, ${back("createdAt")} WHERE id = (SELECT "invoiceId" FROM "TestOrder" WHERE id = $1)`, orderId);
  }

  /** The values the technician types for one test: mostly normal, now and then abnormal, a critical one on request. */
  function valuesFor(code: string, critical: boolean, forceNormal = false) {
    const set = VALUES[code] ?? {};
    let usedCritical = false;
    return Object.entries(set).map(([name, [normal, abnormal, criticalValue]]) => {
      if (forceNormal) return { name, value: normal };
      if (critical && criticalValue && !usedCritical) { usedCritical = true; return { name, value: criticalValue }; }
      return { name, value: random() < 0.22 ? abnormal : normal };
    });
  }

  const money = (cents: number) => cents / 100;
  const methods: PaymentMethod[] = ["CASH", "CARD", "MOBILE_BANKING", "BANK_TRANSFER", "CASH"];

  async function takePayments(orderId: string, spec: OrderSpec, index: number) {
    const order = await prisma.testOrder.findUniqueOrThrow({ where: { id: orderId }, include: { invoice: { include: { payments: true } } } });
    const invoice = order.invoice!;
    const total = invoiceTotalCents(invoice);
    const portions = spec.pay === "full" ? [1] : spec.pay === "split" ? [0.6, 0.4] : spec.pay === "partial" ? [0.5] : [];
    let paid = 0;
    for (const [position, share] of portions.entries()) {
      const cents = position === portions.length - 1 && spec.pay !== "partial" ? total - paid : Math.round(total * share);
      paid += cents;
      await prisma.payment.create({ data: { invoiceId: invoice.id, amount: money(cents), method: methods[(index + position) % methods.length], status: "POSTED", receivedAt: at(-Math.max(spec.daysAgo - position, 0), "11:30") } });
    }
    const status = statusForPayments(paid, total);
    if (invoice.status !== status) await prisma.invoice.update({ where: { id: invoice.id }, data: { status } });
  }

  async function runOrder(spec: OrderSpec, index: number) {
    const patient = patients[spec.patient - 1];
    const catalog = await prisma.clinicService.findMany({ where: { code: { in: spec.codes } }, select: { id: true, code: true } });
    const idOf = new Map(catalog.map((row) => [row.code, row.id]));
    for (const code of spec.codes) if (!idOf.has(code)) throw new Error(`The test catalog has no item with code ${code}.`);

    const orderId = await createOrder(
      { patientId: patient.id, serviceIds: spec.codes.map((code) => idOf.get(code)!), priority: spec.priority ?? "ROUTINE", referredBy: referrers[index % referrers.length], clinicalNotes: spec.notes ?? null, discount: 0 },
      recorderFor(actor.reception.id),
    );
    await takePayments(orderId, spec, index);
    const lab = recorderFor(actor.lab.id);
    const doctor = recorderFor(actor.pathologist.id);
    const samples = () => prisma.sample.findMany({ where: { orderId, status: { not: "REJECTED" } }, orderBy: { createdAt: "asc" } });

    if (spec.stage === "cancelled") {
      await cancelOrder(orderId, "Patient did not come for the sample.", recorderFor(actor.reception.id));
      return orderId;
    }
    if (spec.stage === "ordered") return orderId;

    // Collect every sample; one is rejected and recollected when the demo wants to show that.
    for (const sample of await samples()) await changeSample(sample.id, { action: "collect" }, actor.lab.name, lab);
    if (spec.reject) {
      const [first] = await samples();
      await changeSample(first.id, { action: "reject", reason: "Sample was haemolysed" }, actor.lab.name, lab);
      for (const sample of await samples()) if (sample.status === "PENDING") await changeSample(sample.id, { action: "collect" }, actor.lab.name, lab);
    }
    if (spec.stage === "collected") return orderId;
    for (const sample of await samples()) await changeSample(sample.id, { action: "receive" }, actor.lab.name, lab);
    if (spec.stage === "received") return orderId;

    // Results
    const items = await prisma.testOrderItem.findMany({ where: { orderId }, orderBy: { testName: "asc" } });
    const enterable = spec.stage === "partial" ? items.slice(0, Math.max(1, Math.floor(items.length / 2))) : items;
    for (const item of enterable) {
      const values = valuesFor(item.testCode, Boolean(spec.critical));
      // Free-text tests (none in the starter catalog) would need `text`; every starter test has parameters.
      await saveResults(item.id, { values, text: null, note: values.some((value) => value.value === "Positive" || value.value === "Reactive") ? "Clinical correlation advised." : null }, actor.lab.name, lab);
    }
    if (spec.stage === "partial" || spec.stage === "entered") return orderId;

    await reviewResults(orderId, { action: "verify" }, actor.pathologist.name, doctor);
    if (spec.stage === "verified") return orderId;

    await releaseReport(orderId, actor.pathologist.name, doctor);
    if (spec.correction) {
      // A mistake found after release: withdraw, send the first test back, correct it, approve, release version 2.
      await withdrawReport(orderId, "Wrong value entered for one test; corrected.", actor.pathologist.name, doctor);
      const [first] = items;
      await reviewResults(orderId, { action: "return", itemId: first.id, reason: "Value looks like a typing error" }, actor.pathologist.name, doctor);
      await saveResults(first.id, { values: valuesFor(first.testCode, false, true), text: null, note: null }, actor.lab.name, lab);
      await reviewResults(orderId, { action: "verify" }, actor.pathologist.name, doctor);
      await releaseReport(orderId, actor.pathologist.name, doctor);
    }
    if (spec.sms || spec.views) {
      await prisma.labReport.updateMany({
        where: { orderId, status: "ISSUED" },
        data: { ...(spec.sms ? { smsSentAt: new Date() } : {}), ...(spec.views ? { viewCount: spec.views, firstViewedAt: new Date() } : {}) },
      });
    }
    return orderId;
  }

  async function seedBookings(workingDays: Set<number>) {
    const weekdayOf = (offset: number) => new Date(`${dayKey(offset)}T12:00:00+06:00`).getUTCDay();
    const plans: { patient: number | null; service: string; offset: number; time: string; status: AppointmentStatus; source: AppointmentSource }[] = [
      { patient: 1, service: "Home sample collection", offset: -17, time: "08:00", status: "COMPLETED", source: "DIRECT" },
      { patient: 3, service: "Basic Health Check-up", offset: -14, time: "08:30", status: "COMPLETED", source: "WALK_IN" },
      { patient: 6, service: "Complete Blood Count (CBC)", offset: -9, time: "09:00", status: "COMPLETED", source: "WHATSAPP" },
      { patient: 12, service: "Lipid Profile", offset: -5, time: "08:00", status: "NO_SHOW", source: "DIRECT" },
      { patient: 15, service: "Home sample collection", offset: -2, time: "07:45", status: "CANCELLED", source: "DIRECT" },
      { patient: 20, service: "Home sample collection", offset: 1, time: "08:00", status: "CONFIRMED", source: "DIRECT" },
      { patient: 21, service: "Fasting Blood Sugar", offset: 2, time: "08:15", status: "CONFIRMED", source: "WHATSAPP" },
      { patient: 22, service: "Diabetes Check Package", offset: 3, time: "08:30", status: "CONFIRMED", source: "ADMIN" },
      { patient: null, service: "Thyroid Stimulating Hormone (TSH)", offset: 4, time: "09:30", status: "PENDING", source: "DIRECT" },
      { patient: null, service: "Basic Health Check-up", offset: 6, time: "10:00", status: "PENDING", source: "DIRECT" },
      { patient: null, service: "Home sample collection", offset: 7, time: "08:00", status: "PENDING", source: "DIRECT" },
    ];
    const visitors = [["Mahbub Alam", "01710010001"], ["Ayesha Siddika", "01710010002"], ["Rony Biswas", "01710010003"]] as const;
    const used = new Set<number>();
    let visitor = 0;
    const rows = plans.map((plan, index) => {
      // Each booking on a working day of its own, so no two can overlap.
      while (!workingDays.has(weekdayOf(plan.offset)) || used.has(plan.offset)) plan.offset += plan.offset < 0 ? -1 : 1;
      used.add(plan.offset);
      const person = plan.patient ? patients[plan.patient - 1] : null;
      const guest = person ? null : visitors[visitor++ % visitors.length];
      return {
        id: `demo-appt-${pad(index + 1)}`, patientId: person?.id ?? null, patientName: person?.name ?? guest![0], patientPhone: person?.phone ?? guest![1],
        patientEmail: person?.email ?? null, service: plan.service, dateTime: at(plan.offset, plan.time), durationMinutes: 30, status: plan.status, source: plan.source,
        notes: plan.status === "PENDING" ? "Requested through the website." : plan.status === "CANCELLED" ? "Patient asked to cancel." : null, createdAt: at(plan.offset - 2, "09:00"),
      };
    });
    await prisma.appointment.createMany({ data: rows });
    return rows.length;
  }

  async function seedExpenses() {
    type Row = { id: string; category: ExpenseCategory; description: string; amount: number; spentAt: Date; method: PaymentMethod; reference: string | null; createdById: string; voidedAt: Date | null; voidReason: string | null };
    const rows: Row[] = [];
    const expense = (category: ExpenseCategory, description: string, amount: number, offset: number, method: PaymentMethod = "CASH", extra: { voidedAt?: Date; voidReason?: string } = {}) =>
      rows.push({ id: `demo-exp-${pad(rows.length + 1)}`, category, description, amount, spentAt: dateOnly(offset), method, reference: method === "BANK_TRANSFER" ? `TRX-${pad(rows.length + 1, 4)}` : null, createdById: "demo-user-admin", voidedAt: extra.voidedAt ?? null, voidReason: extra.voidReason ?? null });
    for (const offset of [-85, -55, -25]) {
      expense("RENT", "Laboratory rent", 25000, offset, "BANK_TRANSFER");
      expense("SALARY", "Technician and receptionist salaries", 30000, offset + 2, "BANK_TRANSFER");
      expense("UTILITIES", "Electricity, water and internet", 4800 + Math.round(random() * 600), offset + 5, "MOBILE_BANKING");
    }
    expense("SUPPLIES", "CBC reagent kit", 18500, -50, "CARD");
    expense("SUPPLIES", "Vacutainer tubes, needles and gloves", 6400, -42, "CASH");
    expense("SUPPLIES", "Biochemistry reagents (glucose, creatinine, lipid)", 21000, -30, "BANK_TRANSFER");
    expense("SUPPLIES", "Urine containers and test strips", 2900, -12, "CASH");
    expense("LAB_FEES", "Referral lab: histopathology samples", 7500, -38, "BANK_TRANSFER");
    expense("EQUIPMENT", "Centrifuge replacement rotor", 9800, -60, "CARD");
    expense("MAINTENANCE", "Analyser calibration and service", 12000, -28, "BANK_TRANSFER");
    expense("MAINTENANCE", "Refrigerator repair (sample storage)", 3500, -9, "CASH");
    expense("MARKETING", "Facebook page promotion", 3000, -35, "MOBILE_BANKING");
    expense("OTHER", "Waiting-room refreshments", 900, -7, "CASH");
    expense("EQUIPMENT", "Hematology analyser (ordered twice by mistake)", 85000, -16, "BANK_TRANSFER", { voidedAt: at(-15, "10:00"), voidReason: "Duplicate order; supplier refunded." });
    await prisma.expense.createMany({ data: rows });
    return rows.length;
  }

  /** Re-reads what was created and fails loudly if any invoice, order or report is inconsistent. */
  async function verifyConsistency() {
    const problems: string[] = [];
    const invoices = await prisma.invoice.findMany({ where: { patient: { id: { startsWith: "demo-" } } }, include: { items: true, payments: true } });
    for (const invoice of invoices) {
      const itemTotal = invoice.items.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
      if (itemTotal !== Math.round(Number(invoice.subtotal) * 100)) problems.push(`${invoice.invoiceCode}: items do not add up to the subtotal`);
      const total = invoiceTotalCents(invoice);
      const paid = paidCents(invoice.payments.filter((payment) => payment.status === "POSTED"));
      if (paid > total) problems.push(`${invoice.invoiceCode}: paid more than the total`);
      if (invoice.status !== "VOID" && invoice.status !== statusForPayments(paid, total)) problems.push(`${invoice.invoiceCode}: status ${invoice.status} does not match its payments`);
    }
    const orders = await prisma.testOrder.findMany({
      where: { patient: { id: { startsWith: "demo-" } } },
      include: { samples: true, items: { include: { results: true } }, reports: true, invoice: true },
    });
    for (const order of orders) {
      const label = order.orderCode;
      if (order.status === "CANCELLED") { if (order.invoice?.status !== "VOID") problems.push(`${label}: cancelled but its invoice is not void`); continue; }
      const expected = deriveOrderStatus(order.status, order.samples, order.items);
      if (expected !== order.status && order.status !== "DELIVERED") problems.push(`${label}: status ${order.status} but its samples and results say ${expected}`);
      const issued = order.reports.filter((report) => report.status === "ISSUED");
      if (order.status === "DELIVERED" && issued.length !== 1) problems.push(`${label}: released but has ${issued.length} issued reports`);
      if (order.status !== "DELIVERED" && issued.length) problems.push(`${label}: has an issued report but is ${order.status}`);
      for (const item of order.items) if (item.resultStatus !== "PENDING" && !item.results.length && !item.resultText) problems.push(`${label}: ${item.testCode} has no result rows`);
    }
    const confirmed = await prisma.appointment.findMany({ where: { id: { startsWith: "demo-" }, status: "CONFIRMED" }, orderBy: { dateTime: "asc" } });
    confirmed.forEach((booking, index) => {
      const next = confirmed[index + 1];
      if (next && booking.dateTime.getTime() + booking.durationMinutes * 60_000 > next.dateTime.getTime()) problems.push(`bookings ${booking.id} and ${next.id} overlap`);
    });
    if (problems.length) throw new Error(`Demo data failed its consistency check:\n- ${problems.join("\n- ")}`);
  }

  // ------------------------------------------------------------ run
  await assertSafeTarget();
  await seedStaff();
  const workingDays = new Set((await seedCenterProfile()).map((schedule) => schedule.dayOfWeek));
  await wipeDemoRows();
  const catalog = await seedCatalog();
  await prisma.patient.createMany({ data: patients });
  // The next patient registered in the app continues after the demo patients instead of reusing a number.
  await prisma.$executeRaw`SELECT setval('"patient_code_seq"', GREATEST((SELECT last_value FROM "patient_code_seq"), ${10000 + patientCount}::bigint), true)`;

  const counts: Record<string, number> = { patients: patients.length, "catalog tests priced": catalog.priced };
  for (const [index, spec] of orderSpecs.entries()) {
    const orderId = await runOrder(spec, index);
    await backdate(orderId, spec.daysAgo);
    counts[`orders (${spec.stage})`] = (counts[`orders (${spec.stage})`] ?? 0) + 1;
  }
  counts.bookings = await seedBookings(workingDays);
  counts.expenses = await seedExpenses();

  await verifyConsistency();

  console.log("Demo data is ready:");
  for (const [key, value] of Object.entries(counts)) console.log(`  ${key.padEnd(24)} ${value}`);
  console.log("\nSign in with the demo accounts listed in SEEDING.md (admin@demo.example, reception@demo.example, lab@demo.example, pathologist@demo.example).");
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
