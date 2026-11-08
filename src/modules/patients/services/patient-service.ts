import { prisma } from "@/lib/prisma";
import type { PatientInput } from "@/modules/patients/schemas/patient-schema";
import {
  getPatientById,
  listPatientChoices,
  listPatients,
  type PatientListOptions,
} from "@/modules/patients/queries/patient-queries";

export async function getPatientDirectory(options: PatientListOptions) {
  return listPatients(options);
}

export async function getPatientChoices(options: PatientListOptions) {
  return listPatientChoices(options);
}

export async function getPatientProfile(id: string) {
  return getPatientById(id);
}

export function getPatientCount() {
  return prisma.patient.count();
}

/** Raised when the same person looks to be registered already (same name and phone). */
export class DuplicatePatientError extends Error {
  constructor(readonly existingPatientCode: string) {
    super(`A patient with this name and phone number is already registered (${existingPatientCode}).`);
    this.name = "DuplicatePatientError";
  }
}

/** The next patient ID (PID-10001, PID-10002…), from the database sequence so two patients never share one. */
export async function nextPatientCode(db: Pick<typeof prisma, "$queryRaw">) {
  const [sequence] = await db.$queryRaw<{ value: string }[]>`SELECT nextval('"patient_code_seq"')::text AS value`;
  return `PID-${sequence.value.padStart(5, "0")}`;
}

export async function createPatient(input: PatientInput) {
  return prisma.$transaction(async (transaction) => {
    const duplicate = await transaction.patient.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" }, phone: input.phone },
      select: { patientCode: true },
    });
    if (duplicate) throw new DuplicatePatientError(duplicate.patientCode);

    const patientCode = await nextPatientCode(transaction);

    return transaction.patient.create({
      data: {
        ...input,
        dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
        patientCode,
      },
    });
  });
}

export async function updatePatient(id: string, input: PatientInput) {
  try {
    return await prisma.patient.update({
      where: { id },
      data: {
        ...input,
        dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}

export async function updatePatientActiveStatus(id: string, isActive: boolean) {
  try {
    return await prisma.patient.update({
      where: { id },
      data: { isActive },
      select: { id: true, isActive: true },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}

export async function deletePatient(id: string) {
  return prisma.$transaction(async (transaction) => {
    const patient = await transaction.patient.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!patient) return null;

    // A patient with bookings, lab orders or invoices has history that must be kept (the database
    // refuses to delete them too), so such a patient is deactivated instead of deleted.
    const [appointmentCount, orderCount, invoiceCount] = await Promise.all([
      transaction.appointment.count({ where: { patientId: id } }),
      transaction.testOrder.count({ where: { patientId: id } }),
      transaction.invoice.count({ where: { patientId: id } }),
    ]);

    if (appointmentCount || orderCount || invoiceCount) {
      return { deleted: false, appointmentCount, orderCount, invoiceCount };
    }

    await transaction.patient.delete({ where: { id } });
    return { deleted: true, appointmentCount: 0, orderCount: 0, invoiceCount: 0 };
  });
}
