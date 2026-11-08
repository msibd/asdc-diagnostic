export type OrderStatus = "ORDERED" | "SAMPLE_COLLECTED" | "RECEIVED" | "IN_PROCESS" | "RESULT_ENTERED" | "VERIFIED" | "DELIVERED" | "CANCELLED";
export type SampleStatus = "PENDING" | "COLLECTED" | "RECEIVED" | "REJECTED";

export type OrderSample = {
  id: string;
  sampleCode: string;
  sampleType: string;
  status: SampleStatus;
  collectedAt: string | null;
  collectedBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectReason: string | null;
  replacesId: string | null;
};

export type OrderItem = {
  id: string;
  testId: string;
  testCode: string;
  testName: string;
  sampleType: string | null;
  sampleId: string | null;
  panelId: string | null;
  resultStatus: "PENDING" | "ENTERED" | "VERIFIED";
  panel: { name: string } | null;
};

export type OrderRecord = {
  id: string;
  orderCode: string;
  status: OrderStatus;
  priority: "ROUTINE" | "URGENT";
  referredBy: string | null;
  clinicalNotes: string | null;
  cancelReason: string | null;
  orderedAt: string;
  patient: { id: string; patientCode: string; name: string; phone: string; sex: "MALE" | "FEMALE" | "OTHER" | null; dateOfBirth: string | null };
  items: OrderItem[];
  samples: OrderSample[];
  invoice: { id: string; invoiceCode: string; status: string; subtotal: string; discount: string; total: string; paid: string; due: string } | null;
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  ORDERED: "Ordered",
  SAMPLE_COLLECTED: "Sample collected",
  RECEIVED: "In lab",
  IN_PROCESS: "In process",
  RESULT_ENTERED: "Result entered",
  VERIFIED: "Verified",
  DELIVERED: "Report released",
  CANCELLED: "Cancelled",
};

export const SAMPLE_LABEL: Record<SampleStatus, string> = {
  PENDING: "Waiting for collection",
  COLLECTED: "Collected",
  RECEIVED: "Received in lab",
  REJECTED: "Rejected",
};

export const SEX_LABEL = { MALE: "Male", FEMALE: "Female", OTHER: "Other" } as const;

/** "34 y" from a date of birth (YYYY-MM-DD), or an empty string when it is not known. */
export function ageText(dateOfBirth: string | null, today = new Date()) {
  if (!dateOfBirth) return "";
  const born = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(born.getTime())) return "";
  // Whole months lived; babies under two are shown in months, everyone else in years.
  const months = (today.getUTCFullYear() - born.getUTCFullYear()) * 12 + (today.getUTCMonth() - born.getUTCMonth()) - (today.getUTCDate() < born.getUTCDate() ? 1 : 0);
  if (months < 0) return "";
  return months < 24 ? `${months} mo` : `${Math.floor(months / 12)} y`;
}

/** Sample progress for the list: "2 of 3 received", or "No sample needed". */
export function sampleSummary(samples: OrderSample[]) {
  const live = samples.filter((sample) => sample.status !== "REJECTED");
  if (!live.length) return "No sample needed";
  const received = live.filter((sample) => sample.status === "RECEIVED").length;
  const collected = live.filter((sample) => sample.status === "COLLECTED" || sample.status === "RECEIVED").length;
  if (received === live.length) return `${received} received`;
  if (collected === live.length) return `${collected} collected`;
  return `${collected} of ${live.length} collected`;
}

// ---- Result entry (shape of GET /api/orders/:id/results)

export type ResultState = "PENDING" | "ENTERED" | "VERIFIED";
export type RangeShape = {
  sex: "ANY" | "MALE" | "FEMALE";
  minAgeYears: number | null; maxAgeYears: number | null;
  low: number | null; high: number | null; criticalLow: number | null; criticalHigh: number | null;
  note: string | null;
};
export type SheetParameter = {
  name: string;
  unit: string | null;
  value: string;
  flag: "NORMAL" | "LOW" | "HIGH" | "CRITICAL_LOW" | "CRITICAL_HIGH" | "ABNORMAL" | null;
  referenceText: string | null;
  range: RangeShape | null;
  rangeProblem: string | null;
  retired: boolean;
};
export type SheetItem = {
  itemId: string; testId: string; testCode: string; testName: string; panelName: string | null;
  resultStatus: ResultState; freeText: boolean;
  resultText: string | null; resultNote: string | null; returnReason: string | null;
  enteredBy: string | null; enteredAt: string | null; verifiedBy: string | null; verifiedAt: string | null;
  parameters: SheetParameter[];
};
export type ResultSheet = { orderId: string; orderCode: string; status: OrderStatus; items: SheetItem[] };

export const RESULT_STATE_LABEL: Record<ResultState, string> = { PENDING: "Waiting for result", ENTERED: "Entered, to be approved", VERIFIED: "Approved" };

/** Progress of the lab work on an order, e.g. "1 of 3 tests done" (empty before any sample is in the lab). */
export function resultsSummary(order: OrderRecord) {
  if (!["RECEIVED", "IN_PROCESS", "RESULT_ENTERED", "VERIFIED", "DELIVERED"].includes(order.status) || !order.items.length) return "";
  const done = order.items.filter((item) => item.resultStatus !== "PENDING").length;
  const approved = order.items.filter((item) => item.resultStatus === "VERIFIED").length;
  if (approved === order.items.length) return "All approved";
  if (done === order.items.length) return `${approved} of ${order.items.length} approved`;
  return `${done} of ${order.items.length} tests done`;
}
