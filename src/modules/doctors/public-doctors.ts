import { prisma } from "@/lib/prisma";

// What a visitor to the public website can learn about a doctor. Nothing outside this shape ever
// leaves the server: phone, e-mail and address are deliberately absent, and every query is limited to
// doctors that are both active and published.
export type PublicDoctor = {
  slug: string;
  name: string;
  designation: string | null;
  imageUrl: string | null;
  qualifications: string;
  specialization: string;
  experienceYears: number | null;
  bio: string | null;
  registrationNumber: string | null;
  consultationInfo: string | null;
  /** Null when no fee has been set. */
  consultationFee: string | null;
  /** Working days only. */
  schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
};

export const PUBLIC_DOCTORS_PER_PAGE = 12;

const publicDoctorSelect = {
  slug: true,
  name: true,
  designation: true,
  imageUrl: true,
  qualifications: true,
  specialization: true,
  experienceYears: true,
  bio: true,
  registrationNumber: true,
  consultationInfo: true,
  consultationFee: true,
  schedules: {
    orderBy: { dayOfWeek: "asc" },
    where: { isWorking: true },
    select: { dayOfWeek: true, startTime: true, endTime: true },
  },
} as const;

const visibleDoctors = { isActive: true, isPublished: true } as const;

type Row = {
  slug: string; name: string; designation: string | null; imageUrl: string | null; qualifications: string;
  specialization: string; experienceYears: number | null; bio: string | null; registrationNumber: string | null;
  consultationInfo: string | null; consultationFee: { toString(): string };
  schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
};

function toPublicDoctor(row: Row): PublicDoctor {
  return { ...row, consultationFee: Number(row.consultationFee) > 0 ? row.consultationFee.toString() : null };
}

export async function listPublishedDoctors(page = 1): Promise<{ total: number; pageCount: number; doctors: PublicDoctor[] }> {
  const [total, rows] = await Promise.all([
    prisma.doctorProfile.count({ where: visibleDoctors }),
    prisma.doctorProfile.findMany({
      where: visibleDoctors,
      select: publicDoctorSelect,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      skip: (page - 1) * PUBLIC_DOCTORS_PER_PAGE,
      take: PUBLIC_DOCTORS_PER_PAGE,
    }),
  ]);
  return { total, pageCount: Math.max(1, Math.ceil(total / PUBLIC_DOCTORS_PER_PAGE)), doctors: rows.map(toPublicDoctor) };
}

export async function findPublishedDoctor(slug: string) {
  const row = await prisma.doctorProfile.findFirst({ where: { slug, ...visibleDoctors }, select: publicDoctorSelect });
  return row ? toPublicDoctor(row) : null;
}

export function listPublishedDoctorSlugs() {
  return prisma.doctorProfile.findMany({
    where: visibleDoctors,
    select: { slug: true, updatedAt: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

export function countPublishedDoctors() {
  return prisma.doctorProfile.count({ where: visibleDoctors });
}
