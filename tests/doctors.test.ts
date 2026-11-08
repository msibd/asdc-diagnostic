import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET as listDoctors, POST as createDoctor } from "@/app/api/doctors/route";
import { DELETE as deleteDoctor, GET as getDoctor, PATCH as updateDoctor } from "@/app/api/doctors/[id]/route";
import { PUT as saveLegacyDoctor } from "@/app/api/doctor/route";
import { prisma } from "@/lib/prisma";
import { doctorInputSchema, doctorUpdateSchema, slugify } from "@/modules/doctors/doctor-schema";
import { countPublishedDoctors, findPublishedDoctor, listPublishedDoctors, listPublishedDoctorSlugs } from "@/modules/doctors/public-doctors";
import { call, createSession, ensureDoctorSchedule, type TestUser } from "./helpers";

// Next.js cache invalidation only works inside the running server; here we just ignore it.
vi.mock("@/lib/public-cache", () => ({
  publicCacheTags: { clinic: "public-clinic", doctors: "public-doctors", gallery: "public-gallery", reviews: "public-reviews" },
  invalidatePublicCache: () => undefined,
}));

let admin: TestUser;
let receptionist: TestUser;
const run = Date.now().toString(36);
let counter = 0;
const uniqueName = (label = "Doctor") => `${label} ${run}${counter++}`;

const week = (working = [0, 1, 2, 3, 4, 6]) =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: "09:00", endTime: "17:00", isWorking: working.includes(dayOfWeek) }));

const input = (overrides: Record<string, unknown> = {}) => ({
  name: uniqueName("Dr Test"),
  designation: "Consultant",
  imageUrl: null,
  qualifications: "MBBS",
  specialization: "Pathology",
  experienceYears: 8,
  bio: "A short biography.",
  registrationNumber: null,
  consultationInfo: null,
  consultationFee: 0,
  phone: "01711111111",
  email: "private@example.test",
  address: "Private clinic address",
  displayOrder: 5,
  isActive: true,
  isPublished: false,
  schedules: week(),
  ...overrides,
});

const create = (body: unknown, cookie = admin.cookie) => call(createDoctor, "/api/doctors", { method: "POST", body, cookie });
const patch = (id: string, body: unknown, cookie = admin.cookie) => call(updateDoctor, `/api/doctors/${id}`, { method: "PATCH", body, cookie, params: { id } });
const read = (id: string, cookie = admin.cookie) => call(getDoctor, `/api/doctors/${id}`, { cookie, params: { id } });
const remove = (id: string, cookie = admin.cookie) => call(deleteDoctor, `/api/doctors/${id}`, { method: "DELETE", cookie, params: { id } });
const list = (query = "", cookie = admin.cookie) => call(listDoctors, `/api/doctors${query}`, { cookie });

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  await ensureDoctorSchedule();
});

describe("validation rules", () => {
  it("makes URL-safe slugs and falls back for names with no Latin letters", () => {
    expect(slugify("Dr. Anika Rahman")).toBe("dr-anika-rahman");
    expect(slugify("  Prof.  Dr. José  Müller--II ")).toBe("prof-dr-jose-muller-ii");
    expect(slugify("ডা. আনিকা")).toBe("doctor");
  });

  it("accepts a full profile and rejects bad values", () => {
    expect(doctorInputSchema.safeParse(input()).success).toBe(true);
    const bad = (overrides: Record<string, unknown>) => doctorInputSchema.safeParse(input(overrides)).success;
    expect(bad({ name: "  " })).toBe(false);
    expect(bad({ specialization: "" })).toBe(false);
    expect(bad({ slug: "Not A Slug" })).toBe(false);
    expect(bad({ slug: "double--hyphen" })).toBe(false);
    expect(bad({ imageUrl: "http://example.com/a.jpg" })).toBe(false);
    expect(bad({ imageUrl: "javascript:alert(1)" })).toBe(false);
    expect(bad({ imageUrl: "https://example.com/a.jpg" })).toBe(true);
    expect(bad({ experienceYears: -1 })).toBe(false);
    expect(bad({ experienceYears: 3.5 })).toBe(false);
    expect(bad({ experienceYears: 71 })).toBe(false);
    expect(bad({ consultationFee: -5 })).toBe(false);
    expect(bad({ email: "nope" })).toBe(false);
    expect(bad({ displayOrder: -1 })).toBe(false);
    expect(bad({ schedules: week().slice(0, 6) })).toBe(false);
    expect(bad({ schedules: week().map((day) => (day.dayOfWeek === 1 ? { ...day, startTime: "18:00" } : day)) })).toBe(false);
  });

  it("does not fill in defaults for fields an edit leaves out", () => {
    const parsed = doctorUpdateSchema.parse({ isPublished: true });
    expect(parsed).toEqual({ isPublished: true });
    expect(doctorUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("who may manage doctors", () => {
  it("refuses signed-out visitors", async () => {
    expect((await call(listDoctors, "/api/doctors")).status).toBe(401);
    expect((await call(createDoctor, "/api/doctors", { method: "POST", body: input() })).status).toBe(401);
    expect((await call(deleteDoctor, "/api/doctors/x", { method: "DELETE", params: { id: "x" } })).status).toBe(401);
  });

  it("lets a receptionist look but not change anything", async () => {
    const made = await create(input());
    expect((await list("", receptionist.cookie)).status).toBe(200);
    expect((await read(made.json.doctor.id, receptionist.cookie)).status).toBe(200);
    expect((await create(input(), receptionist.cookie)).status).toBe(403);
    expect((await patch(made.json.doctor.id, { isPublished: true }, receptionist.cookie)).status).toBe(403);
    expect((await remove(made.json.doctor.id, receptionist.cookie)).status).toBe(403);
    expect((await call(saveLegacyDoctor, "/api/doctor", { method: "PUT", body: {}, cookie: receptionist.cookie })).status).toBe(403);
    expect((await read(made.json.doctor.id)).json.doctor.isPublished).toBe(false);
  });

  it("refuses a user with no clinic role", async () => {
    const outsider = await createSession("user");
    expect((await list("", outsider.cookie)).status).toBe(403);
    expect((await create(input(), outsider.cookie)).status).toBe(403);
  });
});

describe("creating and editing doctors", () => {
  it("creates a doctor with weekly hours and an audit entry", async () => {
    const body = input({ name: uniqueName("Dr Create") });
    const { status, json } = await create(body);
    expect(status).toBe(201);
    expect(json.doctor).toMatchObject({ name: body.name, designation: "Consultant", experienceYears: 8, isActive: true, isPublished: false, displayOrder: 5 });
    expect(json.doctor.slug).toBe(slugify(body.name));
    expect(json.doctor.schedules).toHaveLength(7);
    expect(json.doctor.schedules.filter((day: { isWorking: boolean }) => day.isWorking)).toHaveLength(6);
    expect(await prisma.auditEvent.count({ where: { entity: "DoctorProfile", entityId: json.doctor.id, action: "CREATE", actorId: admin.id } })).toBe(1);
  });

  it("keeps slugs unique: generated ones get a suffix, chosen ones are refused when taken", async () => {
    const name = uniqueName("Dr Same");
    const first = await create(input({ name }));
    const second = await create(input({ name }));
    expect(second.status).toBe(201);
    expect(second.json.doctor.slug).toBe(`${first.json.doctor.slug}-2`);

    const clash = await create(input({ name: uniqueName("Dr Other"), slug: first.json.doctor.slug }));
    expect(clash.status).toBe(409);
    expect(clash.json.error).toMatch(/slug/i);

    const mine = await create(input({ name: uniqueName("Dr Mine"), slug: `custom-${run}` }));
    expect(mine.json.doctor.slug).toBe(`custom-${run}`);
    const move = await patch(second.json.doctor.id, { slug: `custom-${run}` });
    expect(move.status).toBe(409);
    expect((await patch(mine.json.doctor.id, { slug: `custom-${run}` })).status).toBe(200);
  });

  it("rejects invalid input with a message", async () => {
    for (const bad of [{ slug: "Bad Slug" }, { imageUrl: "http://insecure.example/x.png" }, { experienceYears: -2 }, { email: "x" }, { name: "" }]) {
      const result = await create(input(bad));
      expect(result.status, JSON.stringify(bad)).toBe(400);
      expect(typeof result.json.error).toBe("string");
    }
    expect((await patch("whatever", {})).status).toBe(400);
  });

  it("edits only the fields that are sent", async () => {
    const made = (await create(input({ qualifications: "MBBS, FCPS", isPublished: true }))).json.doctor;
    const result = await patch(made.id, { bio: "New biography." });
    expect(result.status).toBe(200);
    expect(result.json.doctor).toMatchObject({ bio: "New biography.", qualifications: "MBBS, FCPS", isPublished: true, specialization: "Pathology" });
    expect(await prisma.auditEvent.count({ where: { entity: "DoctorProfile", entityId: made.id, action: "UPDATE" } })).toBe(1);

    const hours = await patch(made.id, { schedules: week([1, 2]) });
    expect(hours.json.doctor.schedules.filter((day: { isWorking: boolean }) => day.isWorking)).toHaveLength(2);
    expect((await patch("does-not-exist", { bio: "x" })).status).toBe(404);
  });

  it("switches active and published independently", async () => {
    const made = (await create(input())).json.doctor;
    expect((await patch(made.id, { isPublished: true })).json.doctor).toMatchObject({ isPublished: true, isActive: true });
    expect((await patch(made.id, { isActive: false })).json.doctor).toMatchObject({ isPublished: true, isActive: false });
  });
});

describe("listing, searching and paging", () => {
  const tag = `Zed${run}`;

  beforeAll(async () => {
    await create(input({ name: `Dr Alpha ${tag}`, specialization: `Cardiology ${tag}`, designation: "Heart Specialist", displayOrder: 2, isPublished: true }));
    await create(input({ name: `Dr Beta ${tag}`, specialization: `Cardiology ${tag}`, designation: null, displayOrder: 1, isActive: false }));
    await create(input({ name: `Dr Gamma ${tag}`, specialization: `Neurology ${tag}`, designation: null, displayOrder: 3 }));
  });

  it("searches by name, specialization and designation (any case)", async () => {
    expect((await list(`?search=${tag.toLowerCase()}`)).json.total).toBe(3);
    expect((await list(`?search=alpha ${tag}`)).json.doctors.map((doctor: { name: string }) => doctor.name)).toEqual([`Dr Alpha ${tag}`]);
    expect((await list(`?search=cardiology ${tag}`)).json.total).toBe(2);
    expect((await list(`?search=heart specialist`)).json.doctors.some((doctor: { name: string }) => doctor.name.includes(tag))).toBe(true);
  });

  it("filters by status and specialization", async () => {
    const query = (extra: string) => list(`?search=${tag}&${extra}`);
    expect((await query("status=active")).json.total).toBe(2);
    expect((await query("status=inactive")).json.total).toBe(1);
    expect((await query("status=published")).json.total).toBe(1);
    expect((await query("status=unpublished")).json.total).toBe(2);
    expect((await query(`specialization=${encodeURIComponent(`neurology ${tag}`)}`)).json.total).toBe(1);
    expect((await query("status=bogus")).status).toBe(400);
    expect((await list("?page=0")).status).toBe(400);
  });

  it("orders by display order and pages the results", async () => {
    const first = await list(`?search=${tag}&pageSize=2&page=1`);
    expect(first.json).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(first.json.doctors.map((doctor: { name: string }) => doctor.name)).toEqual([`Dr Beta ${tag}`, `Dr Alpha ${tag}`]);
    const second = await list(`?search=${tag}&pageSize=2&page=2`);
    expect(second.json.doctors.map((doctor: { name: string }) => doctor.name)).toEqual([`Dr Gamma ${tag}`]);
    expect((await list(`?search=${tag}&pageSize=2&page=3`)).json.doctors).toEqual([]);
    expect(first.json.specializations).toEqual(expect.arrayContaining([`Cardiology ${tag}`, `Neurology ${tag}`]));
  });
});

describe("public visibility", () => {
  it("shows only doctors that are both active and published", async () => {
    const live = (await create(input({ name: uniqueName("Dr Live"), isActive: true, isPublished: true, consultationFee: 500 }))).json.doctor;
    const draft = (await create(input({ name: uniqueName("Dr Draft"), isActive: true, isPublished: false }))).json.doctor;
    const inactive = (await create(input({ name: uniqueName("Dr Inactive"), isActive: false, isPublished: true }))).json.doctor;

    const slugs = (await listPublishedDoctors()).doctors.map((doctor) => doctor.slug);
    expect(slugs).toContain(live.slug);
    expect(slugs).not.toContain(draft.slug);
    expect(slugs).not.toContain(inactive.slug);
    expect(await findPublishedDoctor(live.slug)).not.toBeNull();
    expect(await findPublishedDoctor(draft.slug)).toBeNull();
    expect(await findPublishedDoctor(inactive.slug)).toBeNull();
    expect(await findPublishedDoctor("no-such-doctor")).toBeNull();
    expect((await listPublishedDoctorSlugs()).map((row) => row.slug)).not.toContain(draft.slug);
    expect(await countPublishedDoctors()).toBe((await listPublishedDoctors()).total);

    // Hiding a published doctor takes effect at once.
    await patch(live.id, { isActive: false });
    expect(await findPublishedDoctor(live.slug)).toBeNull();
  });

  it("never exposes private fields", async () => {
    const doctor = (await create(input({ name: uniqueName("Dr Public"), isPublished: true, consultationFee: 0 }))).json.doctor;
    const visible = await findPublishedDoctor(doctor.slug);
    expect(visible).not.toBeNull();
    expect(Object.keys(visible!).sort()).toEqual([
      "bio", "consultationFee", "consultationInfo", "designation", "experienceYears", "imageUrl", "name",
      "qualifications", "registrationNumber", "schedules", "slug", "specialization",
    ]);
    expect(JSON.stringify(visible)).not.toMatch(/private@example|01711111111|Private clinic address/);
    expect(visible!.consultationFee).toBeNull();
    // Only the days the doctor works are listed.
    expect(visible!.schedules).toHaveLength(6);
    await patch(doctor.id, { consultationFee: 750 });
    expect((await findPublishedDoctor(doctor.slug))!.consultationFee).toBe("750");
  });

  it("pages the public list", async () => {
    const page = await listPublishedDoctors(1);
    expect(page.doctors.length).toBeLessThanOrEqual(12);
    expect(page.pageCount).toBe(Math.max(1, Math.ceil(page.total / 12)));
    expect((await listPublishedDoctors(page.pageCount + 1)).doctors).toEqual([]);
  });
});

describe("deleting and the main profile", () => {
  it("deletes a doctor and the weekly hours with it", async () => {
    const made = (await create(input())).json.doctor;
    expect(await prisma.doctorSchedule.count({ where: { doctorId: made.id } })).toBe(7);
    const result = await remove(made.id);
    expect(result.status).toBe(200);
    expect((await read(made.id)).status).toBe(404);
    expect(await prisma.doctorSchedule.count({ where: { doctorId: made.id } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { entity: "DoctorProfile", entityId: made.id, action: "DELETE" } })).toBe(1);
    expect((await remove(made.id)).status).toBe(404);
  });

  it("never deletes the main profile that drives booking hours, but can hide it", async () => {
    const result = await remove("primary");
    expect(result.status).toBe(409);
    expect(result.json.error).toMatch(/deactivate|unpublish/i);
    expect(await prisma.doctorProfile.findUnique({ where: { id: "primary" } })).not.toBeNull();
    expect(await prisma.doctorSchedule.count({ where: { doctorId: "primary" } })).toBe(7);
    expect((await patch("primary", { isPublished: false })).status).toBe(200);
    expect((await patch("primary", { isPublished: true })).status).toBe(200);
  });

  it("refuses new hours for the main profile that would strand a confirmed booking", async () => {
    await ensureDoctorSchedule();
    const later = new Date(Date.now() + 3 * 86_400_000);
    // 10:00 in Dhaka on that day.
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(later);
    const appointment = await prisma.appointment.create({
      data: { patientName: "Booked Patient", patientPhone: "01800000000", service: "Check", status: "CONFIRMED", dateTime: new Date(`${key}T10:00:00+06:00`) },
    });
    try {
      const closed = await patch("primary", { schedules: week([]) });
      expect(closed.status).toBe(409);
      expect(closed.json.error).toMatch(/confirmed appointment/i);
      // Hours that still cover the booking are fine.
      expect((await patch("primary", { schedules: week([0, 1, 2, 3, 4, 5, 6]) })).status).toBe(200);
      // Other doctors do not affect booking, so their hours can change freely.
      const other = (await create(input())).json.doctor;
      expect((await patch(other.id, { schedules: week([]) })).status).toBe(200);
    } finally {
      await prisma.appointment.delete({ where: { id: appointment.id } });
    }
  });
  it("does not let a booking that is already outside the hours block an unrelated save", async () => {
    await ensureDoctorSchedule(); // 09:00-17:00 every day
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(Date.now() + 4 * 86_400_000));
    // 20:00 is already outside the saved hours (for example it was booked before the hours changed).
    const appointment = await prisma.appointment.create({
      data: { patientName: "Late Patient", patientPhone: "01800000001", service: "Check", status: "CONFIRMED", dateTime: new Date(`${key}T20:00:00+06:00`) },
    });
    try {
      // Saving the profile with the same hours (as the edit form does) must work.
      expect((await patch("primary", { bio: "Edited bio.", schedules: week([0, 1, 2, 3, 4, 5, 6]) })).status).toBe(200);
      // Changing the hours of other days is not the late booking's fault either.
      expect((await patch("primary", { schedules: week([0, 1, 2, 3, 4, 5, 6]).map((day) => (day.dayOfWeek === 0 ? { ...day, endTime: "16:00" } : day)) })).status).toBe(200);
    } finally {
      await prisma.appointment.delete({ where: { id: appointment.id } });
      await ensureDoctorSchedule();
    }
  });

});
