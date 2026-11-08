import { hashPassword } from "better-auth/crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const TEST_PASSWORD = "Test-Password-2026!";

type Role = string;

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Creates a user with an email/password credential (hashed exactly as Better Auth does). */
export async function createUser(role: Role) {
  const id = `u_${unique()}`;
  const email = `${role}.${id}@example.test`;
  await prisma.user.create({
    data: {
      id,
      name: `Test ${role}`,
      email,
      emailVerified: true,
      role,
      accounts: {
        create: { id: `a_${id}`, accountId: id, providerId: "credential", password: await hashPassword(TEST_PASSWORD) },
      },
    },
  });
  return { id, email, role };
}

/** Signs in through Better Auth and returns the Cookie header for subsequent requests. */
export async function signIn(email: string) {
  const { headers } = await auth.api.signInEmail({
    body: { email, password: TEST_PASSWORD },
    returnHeaders: true,
  });
  return headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

export type TestUser = Awaited<ReturnType<typeof createUser>> & { cookie: string };

export async function createSession(role: Role): Promise<TestUser> {
  const user = await createUser(role);
  return { ...user, cookie: await signIn(user.email) };
}

type CallOptions<P> = {
  method?: string;
  body?: unknown;
  cookie?: string;
  params?: P;
  /** Extra request headers, e.g. x-forwarded-for to act as a different client address. */
  headers?: Record<string, string>;
};

/** Calls a route handler directly with a real Request, the way Next.js would. */
export async function call<P extends Record<string, string> = Record<string, string>>(
  handler: (request: Request, context: { params: Promise<P> }) => Promise<Response>,
  path: string,
  { method = "GET", body, cookie, params = {} as P, headers: extraHeaders = {} }: CallOptions<P> = {},
) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);
  if (body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(`http://localhost:3000${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve(params) });
  const json = await response.json().catch(() => null) as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  return { status: response.status, json: json ?? {} };
}

// Starts at a random point per test file: files share one database, and registering the same
// name and phone twice is (rightly) refused, so fixtures must not repeat across files.
let patientNumber = Math.floor(Math.random() * 800_000);
export function patientInput(overrides: Record<string, unknown> = {}) {
  patientNumber += 1;
  return { name: `Test Patient ${patientNumber}`, phone: `01700${String(100000 + patientNumber)}`, ...overrides };
}

/** The doctor's weekly schedule used by the appointment tests: Sunday-Saturday, 09:00-17:00. */
export async function ensureDoctorSchedule() {
  await prisma.doctorProfile.upsert({
    where: { id: "primary" },
    create: { id: "primary", slug: "dr-test", name: "Dr Test" },
    update: {},
  });
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    await prisma.doctorSchedule.upsert({
      where: { doctorId_dayOfWeek: { doctorId: "primary", dayOfWeek } },
      create: { doctorId: "primary", dayOfWeek, startTime: "09:00", endTime: "17:00", isWorking: true },
      update: { startTime: "09:00", endTime: "17:00", isWorking: true },
    });
  }
}

/** An ISO timestamp for `daysAhead` days from now at the given Asia/Dhaka wall-clock time. */
export function clinicTime(daysAhead: number, hhmm: string) {
  const day = new Date(Date.now() + daysAhead * 86_400_000);
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(day);
  return new Date(`${dateKey}T${hhmm}:00+06:00`).toISOString();
}
