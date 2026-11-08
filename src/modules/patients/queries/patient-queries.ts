import { prisma } from "@/lib/prisma";

export type PatientListOptions = {
  page: number;
  pageSize: number;
  search: string;
  status: "ALL" | "ACTIVE" | "INACTIVE";
  /** "newest" = most recently registered first; "name" = A to Z. */
  sort?: "newest" | "name";
};

const patientSelect = {
  id: true,
  patientCode: true,
  name: true,
  phone: true,
  isActive: true,
  email: true,
  dateOfBirth: true,
  sex: true,
  address: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  medicalHistory: true,
  allergies: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { appointments: true } },
  appointments: {
    orderBy: { dateTime: "desc" as const },
    take: 1,
    select: { dateTime: true, service: true },
  },
};

const patientListSelect = {
  id: true,
  patientCode: true,
  name: true,
  phone: true,
  isActive: true,
  email: true,
  createdAt: true,
  updatedAt: true,
  appointments: {
    orderBy: { dateTime: "desc" as const },
    take: 1,
    select: { dateTime: true, service: true },
  },
};

const patientChoiceSelect = {
  id: true,
  patientCode: true,
  name: true,
  phone: true,
};

export function buildPatientWhere({ search, status }: Pick<PatientListOptions, "search" | "status">) {
  return {
    ...(status === "ALL" ? {} : { isActive: status === "ACTIVE" }),
    ...(search
      ? {
          OR: [
            { patientCode: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

// Lightweight rows for dropdowns/search pickers: no relation counts, no clinical fields.
export async function listPatientChoices({ page, pageSize, search, status }: PatientListOptions) {
  const patients = await prisma.patient.findMany({
    where: buildPatientWhere({ search, status }),
    select: patientChoiceSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { patients, page, pageSize };
}

export async function listPatients({ page, pageSize, search, status, sort = "newest" }: PatientListOptions) {
  const where = buildPatientWhere({ search, status });

  const [patients, statusGroups, searchedTotal] = await Promise.all([
    prisma.patient.findMany({
      where,
      select: patientListSelect,
      orderBy: sort === "name"
        ? [{ name: "asc" as const }, { id: "asc" as const }]
        : [{ createdAt: "desc" as const }, { id: "asc" as const }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patient.groupBy({ by: ["isActive"], orderBy: { isActive: "asc" }, _count: { _all: true } }),
    search ? prisma.patient.count({ where }) : Promise.resolve(null),
  ]);

  const activeTotal = statusGroups.find((group) => group.isActive)?._count._all ?? 0;
  const inactiveTotal = statusGroups.find((group) => !group.isActive)?._count._all ?? 0;
  const total = searchedTotal
    ?? (status === "ACTIVE" ? activeTotal : status === "INACTIVE" ? inactiveTotal : activeTotal + inactiveTotal);

  // Counting only the visible page avoids Prisma's _count join, which aggregates the whole
  // Appointment/TestOrder tables before joining to the page rows.
  const patientIds = patients.map((patient) => patient.id);
  const [appointmentCounts, orderCounts] = patientIds.length
    ? await Promise.all([
        prisma.appointment.groupBy({
          by: ["patientId"],
          orderBy: { patientId: "asc" },
          where: { patientId: { in: patientIds } },
          _count: { _all: true },
        }),
        prisma.testOrder.groupBy({
          by: ["patientId"],
          orderBy: { patientId: "asc" },
          where: { patientId: { in: patientIds } },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const appointmentCountByPatient = new Map(appointmentCounts.map((row) => [row.patientId, row._count._all]));
  const orderCountByPatient = new Map(orderCounts.map((row) => [row.patientId, row._count._all]));

  return {
    patients: patients.map(({ appointments, ...patient }) => ({
      ...patient,
      appointmentCount: appointmentCountByPatient.get(patient.id) ?? 0,
      orderCount: orderCountByPatient.get(patient.id) ?? 0,
      latestAppointment: appointments[0] ?? null,
    })),
    total,
    activeTotal,
    inactiveTotal,
    page,
    pageSize,
  };
}

export async function getPatientById(id: string) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    select: patientSelect,
  });
  if (!patient) return null;

  const { _count, appointments, ...record } = patient;
  return {
    ...record,
    appointmentCount: _count.appointments,
    latestAppointment: appointments[0] ?? null,
  };
}
