import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET as moderationList, PATCH as moderate } from "@/app/public_website/api/reviews/moderation/route";
import { POST as submitReview } from "@/app/public_website/api/reviews/route";
import { prisma } from "@/lib/prisma";
import { namesOverlap, phoneMatchKeys } from "@/modules/website/reviews/review-rules";
import { publicReviewSelect } from "@/modules/website/reviews/review-select";
import { call, createSession, type TestUser } from "./helpers";

// Next.js cache invalidation only works inside the running server; here we just ignore it.
vi.mock("@/lib/public-cache", () => ({
  publicCacheTags: { clinic: "public-clinic", gallery: "public-gallery", reviews: "public-reviews" },
  invalidatePublicCache: () => undefined,
}));

let admin: TestUser;
let ipCounter = 0;

// Each call comes from its own address so the per-address rate limit never interferes.
async function review(body: Record<string, unknown>) {
  ipCounter += 1;
  const request = new Request("http://localhost:3000/public_website/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${ipCounter}` },
    body: JSON.stringify({ rating: 5, comment: "Very gentle and professional care.", ...body }),
  });
  const response = await submitReview(request);
  const json = await response.json().catch(() => null) as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  return { status: response.status, json: json ?? {} };
}

const PHONE = "01711223344";
let patientId: string;

beforeAll(async () => {
  admin = await createSession("admin");
  patientId = (await prisma.patient.create({ data: { patientCode: "PID-REV-1", name: "Rahim Uddin", phone: PHONE } })).id;
  await prisma.patient.create({ data: { patientCode: "PID-REV-2", name: "Karima Begum", phone: "+880 1812-345678" } });
  await prisma.patient.create({ data: { patientCode: "PID-REV-3", name: "Old Patient", phone: "01911000000", isActive: false } });
});

describe("matching helpers", () => {
  it("treats every way of writing a Bangladeshi number as the same number", () => {
    const keys = phoneMatchKeys("+880 1712-345678");
    expect(keys).toEqual(expect.arrayContaining(["8801712345678", "01712345678"]));
    for (const form of ["01712345678", "8801712345678", "+8801712345678", "1712345678", "01712-345 678"]) {
      expect(phoneMatchKeys(form), form).toEqual(expect.arrayContaining(["01712345678", "8801712345678"]));
    }
    expect(phoneMatchKeys("")).toEqual([]);
  });

  it("matches names that share a word, in any case, including Bangla", () => {
    expect(namesOverlap("rahim", "Rahim Uddin")).toBe(true);
    expect(namesOverlap("UDDIN Rahim", "Rahim Uddin")).toBe(true);
    expect(namesOverlap("রহিম", "রহিম উদ্দিন")).toBe(true);
    expect(namesOverlap("Karim", "Rahim Uddin")).toBe(false);
    expect(namesOverlap("A", "A B")).toBe(false); // single letters do not count
  });
});

describe("who can review", () => {
  it("accepts a registered patient and links the review to them, without storing the number", async () => {
    const { status, json } = await review({ name: "Rahim", phone: PHONE });
    expect(status).toBe(201);
    expect(json.review.status).toBe("PENDING");
    expect(JSON.stringify(json)).not.toContain(PHONE);
    const saved = await prisma.clinicReview.findUniqueOrThrow({ where: { id: json.review.id } });
    expect(saved.patientId).toBe(patientId);
    expect(JSON.stringify(saved)).not.toContain(PHONE);
    expect(JSON.stringify(saved)).not.toContain("1711223344");
  });

  it("finds the patient however the number is written, whichever way it was registered", async () => {
    expect((await review({ name: "Karima", phone: "01812345678" })).status).toBe(201);
    expect((await review({ name: "Old Patient", phone: "+8801911000000" })).status).toBe(201); // disabled patients still count
  });

  it("refuses a number that is not registered, with a message that does not say which part failed", async () => {
    const unknown = await review({ name: "Rahim", phone: "01700000999" });
    const wrongName = await review({ name: "Someone Else", phone: PHONE });
    expect(unknown.status).toBe(403);
    expect(wrongName.status).toBe(403);
    expect(unknown.json.error).toBe(wrongName.json.error);
    expect(await prisma.clinicReview.count({ where: { name: "Someone Else" } })).toBe(0);
  });

  it("allows one open review per patient, and another once it was rejected", async () => {
    const patient = await prisma.patient.create({ data: { patientCode: "PID-REV-4", name: "Nusrat Jahan", phone: "01655443322" } });
    const first = await review({ name: "Nusrat", phone: "01655443322" });
    expect(first.status).toBe(201);
    const again = await review({ name: "Nusrat", phone: "01655443322" });
    expect(again.status).toBe(409);
    expect(await prisma.clinicReview.count({ where: { patientId: patient.id } })).toBe(1);
    await call(moderate, "/public_website/api/reviews/moderation", { method: "PATCH", body: { id: first.json.review.id, status: "REJECTED" }, cookie: admin.cookie });
    expect((await review({ name: "Nusrat", phone: "01655443322" })).status).toBe(201);
  });

  it("rejects an invalid or missing number before looking anything up", async () => {
    for (const phone of [undefined, "", "abc", "0171", "01212345678"]) {
      const { status, json } = await review({ name: "Rahim", phone });
      expect(status, String(phone)).toBe(400);
      expect(json.fieldErrors.phone).toBeTruthy();
    }
    expect((await review({ name: "R", phone: PHONE })).json.fieldErrors.name).toBeTruthy();
    expect((await review({ name: "Rahim", phone: PHONE, rating: 9 })).status).toBe(400);
  });
});

describe("the mobile number stays private", () => {
  it("the public review fields contain nothing that identifies a patient", async () => {
    expect(Object.keys(publicReviewSelect).sort()).toEqual(["comment", "createdAt", "id", "name", "rating"]);
    const rows = await prisma.clinicReview.findMany({ select: publicReviewSelect });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["comment", "createdAt", "id", "name", "rating"]);
      expect(JSON.stringify(row)).not.toMatch(/0171122|01812345|1911000/);
    }
  });

  it("the clinic sees the verified patient's name and code, never the number", async () => {
    const { status, json } = await call(moderationList, "/public_website/api/reviews/moderation", { cookie: admin.cookie });
    expect(status).toBe(200);
    const mine = json.reviews.find((item: { patient: { patientCode: string } | null }) => item.patient?.patientCode === "PID-REV-1");
    expect(mine.patient).toEqual({ name: "Rahim Uddin", patientCode: "PID-REV-1" });
    const text = JSON.stringify(json);
    expect(text).not.toContain(PHONE);
    expect(text).not.toContain("01812345678");
    expect(text).not.toMatch(/phone/i);
  });

  it("keeps the review when the patient record is deleted", async () => {
    const patient = await prisma.patient.create({ data: { patientCode: "PID-REV-5", name: "Short Stay", phone: "01577889900" } });
    const created = await review({ name: "Short", phone: "01577889900" });
    await prisma.patient.delete({ where: { id: patient.id } });
    const kept = await prisma.clinicReview.findUniqueOrThrow({ where: { id: created.json.review.id } });
    expect(kept.patientId).toBeNull();
  });
});
