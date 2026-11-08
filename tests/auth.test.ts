import { beforeAll, describe, expect, it } from "vitest";
import { GET as listAppointments } from "@/app/api/appointments/route";
import { POST as refundPayment } from "@/app/api/billing/payments/[id]/refund/route";
import { POST as voidInvoice } from "@/app/api/billing/[id]/void/route";
import { GET as getReports } from "@/app/api/reports/route";
import { GET as getAudit } from "@/app/api/security/audit/route";
import { GET as listPatients, POST as createPatient } from "@/app/api/patients/route";
import { DELETE as deletePatient } from "@/app/api/patients/[id]/route";
import { POST as reviewResults } from "@/app/api/orders/[id]/review/route";
import { POST as releaseReport } from "@/app/api/orders/[id]/report/route";
import { PUT as saveResults } from "@/app/api/results/[itemId]/route";
import { GET as listExpenses } from "@/app/api/expenses/route";
import { PUT as saveDoctor } from "@/app/api/doctor/route";
import { POST as createService } from "@/app/api/services/route";
import { getStaffSession } from "@/lib/admin-session";
import { defaultRoleHasPermission as roleHasPermission, sectionPermissions, type Permission } from "@/lib/permissions";
import { call, createSession, patientInput, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;
let plain: TestUser;

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  plain = await createSession("user");
});

describe("permission matrix", () => {
  const adminOnly: Permission[] = [
    "patients:delete", "appointments:delete", "billing:void", "billing:refund", "results:enter",
    "results:verify", "results:release", "services:write",
    "doctor:write", "expenses:read", "expenses:write", "reports:read", "security:manage", "website:manage",
    "inventory:write", "finance:close", "users:manage", "roles:manage", "email:manage", "sms:manage",
  ];
  const shared: Permission[] = [
    "dashboard:read", "patients:read", "patients:write", "appointments:read", "appointments:write",
    "billing:read", "billing:invoice", "billing:payment", "orders:read", "orders:write", "samples:write",
    "reports:send", "services:read", "doctor:read", "inventory:read",
  ];

  it("gives the administrator every permission", () => {
    for (const permission of [...adminOnly, ...shared]) expect(roleHasPermission("admin", permission)).toBe(true);
  });

  it("limits the receptionist to front-desk work", () => {
    for (const permission of shared) expect(roleHasPermission("receptionist", permission), permission).toBe(true);
    for (const permission of adminOnly) expect(roleHasPermission("receptionist", permission), permission).toBe(false);
  });

  it("gives non-staff and unknown roles nothing", () => {
    for (const role of ["user", "", null, undefined, "superadmin", "ADMIN"]) {
      for (const permission of [...adminOnly, ...shared]) expect(roleHasPermission(role, permission)).toBe(false);
    }
  });

  it("requires an existing permission for every dashboard page", () => {
    for (const permission of Object.values(sectionPermissions)) {
      expect(roleHasPermission("admin", permission)).toBe(true);
    }
  });
});

describe("sessions", () => {
  it("rejects a request with no session cookie", async () => {
    const result = await getStaffSession(new Headers());
    expect(result.status).toBe(401);
  });

  it("rejects a forged or garbage session cookie", async () => {
    const result = await getStaffSession(new Headers({ cookie: "better-auth.session_token=not-a-real-token.abc" }));
    expect(result.status).toBe(401);
  });

  it("signs in staff and recognises their role", async () => {
    const adminSession = await getStaffSession(new Headers({ cookie: admin.cookie }));
    const frontDesk = await getStaffSession(new Headers({ cookie: receptionist.cookie }));
    expect(adminSession.status).toBe(200);
    expect(frontDesk.status).toBe(200);
    expect(adminSession.session?.user.role).toBe("admin");
    expect(frontDesk.session?.user.role).toBe("receptionist");
  });

  it("signs in a non-staff account but refuses it clinic access", async () => {
    const result = await getStaffSession(new Headers({ cookie: plain.cookie }));
    expect(result.status).toBe(403);
  });
});

describe("API authorization", () => {
  it("returns 401 to anonymous requests on every sensitive route", async () => {
    const attempts = await Promise.all([
      call(listPatients, "/api/patients"),
      call(createPatient, "/api/patients", { method: "POST", body: patientInput() }),
      call(listAppointments, "/api/appointments"),
      call(getReports, "/api/reports?from=2026-01-01&to=2026-01-31"),
      call(getAudit, "/api/security/audit"),
      call(listExpenses, "/api/expenses"),
    ]);
    for (const attempt of attempts) expect(attempt.status).toBe(401);
  });

  it("returns 403 to an account without a staff role", async () => {
    const attempts = await Promise.all([
      call(listPatients, "/api/patients", { cookie: plain.cookie }),
      call(listAppointments, "/api/appointments", { cookie: plain.cookie }),
      call(getReports, "/api/reports?from=2026-01-01&to=2026-01-31", { cookie: plain.cookie }),
    ]);
    for (const attempt of attempts) expect(attempt.status).toBe(403);
  });

  it("lets the receptionist do front-desk work", async () => {
    expect((await call(listPatients, "/api/patients", { cookie: receptionist.cookie })).status).toBe(200);
    expect((await call(listAppointments, "/api/appointments", { cookie: receptionist.cookie })).status).toBe(200);
    const created = await call(createPatient, "/api/patients", { method: "POST", body: patientInput(), cookie: receptionist.cookie });
    expect(created.status).toBe(201);
  });

  it("refuses the receptionist every administrator-only action", async () => {
    const forbidden = await Promise.all([
      call(deletePatient, "/api/patients/x", { method: "DELETE", cookie: receptionist.cookie, params: { id: "x" } }),
      call(voidInvoice, "/api/billing/x/void", { method: "POST", body: { reason: "test" }, cookie: receptionist.cookie, params: { id: "x" } }),
      call(refundPayment, "/api/billing/payments/x/refund", { method: "POST", body: { reason: "test" }, cookie: receptionist.cookie, params: { id: "x" } }),
      call(getReports, "/api/reports?from=2026-01-01&to=2026-01-31", { cookie: receptionist.cookie }),
      call(getAudit, "/api/security/audit", { cookie: receptionist.cookie }),
      // Entering, approving and releasing lab results are never front-desk work.
      call(saveResults, "/api/results/x", { method: "PUT", body: {}, cookie: receptionist.cookie, params: { itemId: "x" } }),
      call(reviewResults, "/api/orders/x/review", { method: "POST", body: { action: "verify" }, cookie: receptionist.cookie, params: { id: "x" } }),
      call(releaseReport, "/api/orders/x/report", { method: "POST", body: { action: "release" }, cookie: receptionist.cookie, params: { id: "x" } }),
      call(listExpenses, "/api/expenses", { cookie: receptionist.cookie }),
      call(saveDoctor, "/api/doctor", { method: "PUT", body: {}, cookie: receptionist.cookie }),
      call(createService, "/api/services", { method: "POST", body: {}, cookie: receptionist.cookie }),
    ]);
    for (const attempt of forbidden) {
      expect(attempt.status).toBe(403);
      expect(attempt.json.error).toMatch(/permission/i);
    }
  });

  it("lets the administrator reach administrator-only routes", async () => {
    expect((await call(getAudit, "/api/security/audit", { cookie: admin.cookie })).status).toBe(200);
    expect((await call(listExpenses, "/api/expenses", { cookie: admin.cookie })).status).toBe(200);
  });
});
