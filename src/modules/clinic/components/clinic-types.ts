export type ServiceRecord = {
  id: string;
  code: string;
  name: string;
  nameBn: string | null;
  category: string;
  description: string | null;
  descriptionBn: string | null;
  categoryBn: string | null;
  iconKey: string | null;
  badgeEn: string | null;
  badgeBn: string | null;
  timeTextEn: string | null;
  timeTextBn: string | null;
  painTextEn: string | null;
  painTextBn: string | null;
  feeMax: string | null;
  detailsEn: string;
  detailsBn: string;
  stepsEn: string[];
  stepsBn: string[];
  standardPrice: string;
  durationMinutes: number;
  isActive: boolean;
  kind: CatalogKind;
  sampleType: string | null;
  turnaroundHours: number | null;
  fastingRequired: boolean;
  preparation: string | null;
  /** Counts come with the list; the full definition below comes from GET /api/services/:id. */
  parameterCount: number;
  panelTestCount: number;
  parameters?: ServiceParameter[];
  panelMembers?: { id: string; code: string; name: string }[];
};

export type CatalogKind = "SERVICE" | "TEST" | "PANEL";
export type RangeSex = "ANY" | "MALE" | "FEMALE";
export type ServiceRange = {
  id: string; sex: RangeSex; minAgeYears: string | null; maxAgeYears: string | null;
  low: string | null; high: string | null; criticalLow: string | null; criticalHigh: string | null; note: string | null;
};
export type ServiceParameter = { id: string; name: string; unit: string | null; ranges: ServiceRange[] };

/** Form copies of the above: every number is text while it is being typed. */
export type RangeForm = { sex: RangeSex; minAgeYears: string; maxAgeYears: string; low: string; high: string; criticalLow: string; criticalHigh: string; note: string };
export type ParameterForm = { name: string; unit: string; ranges: RangeForm[] };
export const emptyRange: RangeForm = { sex: "ANY", minAgeYears: "", maxAgeYears: "", low: "", high: "", criticalLow: "", criticalHigh: "", note: "" };
export const emptyParameter = (): ParameterForm => ({ name: "", unit: "", ranges: [{ ...emptyRange }] });

export type PatientChoice = { id: string; patientCode: string; name: string; phone: string };
export type InvoiceRecord = {
  id: string;
  invoiceCode: string;
  status: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  issuedAt: string;
  notes?: string | null;
  referredBy?: string | null;
  patient: PatientChoice & { dateOfBirth?: string | null; sex?: string | null };
  items: { id: string; description: string; quantity: number; unitPrice: string; amount: string; code?: string | null; turnaroundHours?: number | null }[];
  payments: { id: string; amount: string; method: string; status: string; receivedAt: string }[];
};
export type ReportRecord = {
  patientRegistrations: number;
  appointments: { total: number; byStatus: Record<string, number> };
  orders: { status: string; count: number }[];
  revenue: string;
  outstanding: string;
  paymentTransactions: number;
  dailyAppointments: { date: string; count: number }[];
  dailyRevenue: { date: string; amount: string }[];
  revenueByMethod: { method: string; amount: string; count: number }[];
  expenses: { total: string; byCategory: { category: string; amount: string }[] };
  netIncome: string;
  noShows: { count: number; ratePercent: number; patients: { name: string; phone: string; count: number }[] };
};


export const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const emptyService = {
  code: "",
  name: "",
  nameBn: "",
  category: "General",
  description: "",
  descriptionBn: "",
  categoryBn: "",
  iconKey: "",
  badgeEn: "",
  badgeBn: "",
  timeTextEn: "",
  timeTextBn: "",
  painTextEn: "",
  painTextBn: "",
  feeMax: "",
  detailsEn: "",
  detailsBn: "",
  stepsEn: "",
  stepsBn: "",
  standardPrice: "0",
  durationMinutes: "30",
  kind: "TEST" as CatalogKind,
  sampleType: "Blood",
  turnaroundHours: "24",
  fastingRequired: false,
  preparation: "",
  parameters: [] as ParameterForm[],
  panelTestIds: [] as string[],
};
const splitLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const blankToNull = (value: string) => value.trim() || null;
const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

export type ServiceForm = typeof emptyService;

/** Turns the edit form (all text) into the API body: blanks become null, step lists become arrays. */
export function serviceFormToPayload(form: ServiceForm, isActive: boolean) {
  return {
    code: form.code,
    name: form.name,
    category: form.category,
    description: blankToNull(form.description),
    standardPrice: Number(form.standardPrice),
    durationMinutes: Number(form.durationMinutes),
    nameBn: blankToNull(form.nameBn),
    descriptionBn: blankToNull(form.descriptionBn),
    categoryBn: blankToNull(form.categoryBn),
    iconKey: blankToNull(form.iconKey),
    badgeEn: blankToNull(form.badgeEn),
    badgeBn: blankToNull(form.badgeBn),
    timeTextEn: blankToNull(form.timeTextEn),
    timeTextBn: blankToNull(form.timeTextBn),
    painTextEn: blankToNull(form.painTextEn),
    painTextBn: blankToNull(form.painTextBn),
    feeMax: form.feeMax.trim() === "" ? null : Number(form.feeMax),
    detailsEn: form.detailsEn.trim(),
    detailsBn: form.detailsBn.trim(),
    stepsEn: splitLines(form.stepsEn),
    stepsBn: splitLines(form.stepsBn),
    isActive,
    kind: form.kind,
    // Lab fields only mean something for tests and panels; a plain service clears them.
    sampleType: form.kind === "SERVICE" ? null : blankToNull(form.sampleType),
    turnaroundHours: form.kind === "SERVICE" ? null : numberOrNull(form.turnaroundHours),
    fastingRequired: form.kind === "SERVICE" ? false : form.fastingRequired,
    preparation: form.kind === "SERVICE" ? null : blankToNull(form.preparation),
    ...(form.kind === "TEST" ? { parameters: form.parameters.map(parameterToPayload) } : {}),
    ...(form.kind === "PANEL" ? { panelTestIds: form.panelTestIds } : {}),
  };
}

function parameterToPayload(parameter: ParameterForm) {
  return {
    name: parameter.name,
    unit: blankToNull(parameter.unit),
    ranges: parameter.ranges.map((range) => ({
      sex: range.sex,
      minAgeYears: numberOrNull(range.minAgeYears),
      maxAgeYears: numberOrNull(range.maxAgeYears),
      low: numberOrNull(range.low),
      high: numberOrNull(range.high),
      criticalLow: numberOrNull(range.criticalLow),
      criticalHigh: numberOrNull(range.criticalHigh),
      note: blankToNull(range.note),
    })),
  };
}

export function serviceToForm(service: ServiceRecord): ServiceForm {
  return {
    code: service.code,
    name: service.name,
    nameBn: service.nameBn ?? "",
    category: service.category,
    categoryBn: service.categoryBn ?? "",
    description: service.description ?? "",
    descriptionBn: service.descriptionBn ?? "",
    iconKey: service.iconKey ?? "",
    badgeEn: service.badgeEn ?? "",
    badgeBn: service.badgeBn ?? "",
    timeTextEn: service.timeTextEn ?? "",
    timeTextBn: service.timeTextBn ?? "",
    painTextEn: service.painTextEn ?? "",
    painTextBn: service.painTextBn ?? "",
    feeMax: service.feeMax ?? "",
    detailsEn: service.detailsEn,
    detailsBn: service.detailsBn,
    stepsEn: service.stepsEn.join("\n"),
    stepsBn: service.stepsBn.join("\n"),
    standardPrice: service.standardPrice,
    durationMinutes: String(service.durationMinutes),
    kind: service.kind,
    sampleType: service.sampleType ?? "",
    turnaroundHours: service.turnaroundHours == null ? "" : String(service.turnaroundHours),
    fastingRequired: service.fastingRequired,
    preparation: service.preparation ?? "",
    parameters: (service.parameters ?? []).map((parameter) => ({
      name: parameter.name,
      unit: parameter.unit ?? "",
      ranges: parameter.ranges.map((range) => ({
        sex: range.sex,
        minAgeYears: range.minAgeYears ?? "", maxAgeYears: range.maxAgeYears ?? "",
        low: range.low ?? "", high: range.high ?? "",
        criticalLow: range.criticalLow ?? "", criticalHigh: range.criticalHigh ?? "",
        note: range.note ?? "",
      })),
    })),
    panelTestIds: (service.panelMembers ?? []).map((member) => member.id),
  };
}


export async function requestJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let result: { error?: string } & Record<string, unknown>;
  try {
    result = text ? JSON.parse(text) as { error?: string } & Record<string, unknown> : {};
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(result.error ?? `Request failed (HTTP ${response.status}).`);
  return result as T;
}
