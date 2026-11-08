// Role-based access control for staff accounts.
//
// Better Auth stores one role key per user (user.role). A role is a named set of permissions kept in
// the Role table and edited under "Users & roles"; the built-in roles below are the defaults used
// until an administrator changes them. "user" is the default role of an account with no staff access:
// it can sign in but every dashboard page and API route refuses it.
//
// Every sensitive route asks for one specific permission via authorize() (see admin-session.ts), so
// access is always enforced on the server, never only by hiding buttons in the UI.
//
// This file has no server-only imports, so the browser can use it too (to decide what to show).

export type Permission =
  | "dashboard:read"
  | "patients:read" | "patients:write" | "patients:delete" | "patients:export"
  | "appointments:read" | "appointments:write" | "appointments:delete"
  | "billing:read" | "billing:invoice" | "billing:payment" | "billing:void" | "billing:refund"
  | "services:read" | "services:write"
  | "orders:read" | "orders:write" | "samples:write"
  | "results:enter" | "results:verify" | "results:release" | "reports:send"
  | "doctor:read" | "doctor:write"
  | "expenses:read" | "expenses:write"
  | "inventory:read" | "inventory:write"
  | "finance:close"
  | "reports:read"
  | "security:manage"
  | "website:manage"
  | "users:manage"
  | "roles:manage"
  | "email:manage"
  | "sms:manage";

/** Permissions that only the built-in administrator holds. They can never be given to another role. */
export const ADMIN_ONLY_PERMISSIONS: readonly Permission[] = ["users:manage", "roles:manage", "email:manage", "sms:manage"];

/** The permission catalogue, grouped the way the roles screen shows it. */
export const PERMISSION_GROUPS: { id: string; label: string; items: { permission: Permission; label: string; hint?: string }[] }[] = [
  { id: "overview", label: "Dashboard", items: [{ permission: "dashboard:read", label: "View the dashboard overview" }] },
  {
    id: "patients", label: "Patients", items: [
      { permission: "patients:read", label: "View patients" },
      { permission: "patients:write", label: "Register and edit patients" },
      { permission: "patients:delete", label: "Delete patients" },
      { permission: "patients:export", label: "Export the patient list", hint: "Downloads names and phone numbers in bulk. Give it only to people who need it." },
    ],
  },
  {
    id: "appointments", label: "Appointments", items: [
      { permission: "appointments:read", label: "View appointments" },
      { permission: "appointments:write", label: "Book, edit and change status" },
      { permission: "appointments:delete", label: "Delete appointments" },
    ],
  },
  {
    id: "laboratory", label: "Laboratory", items: [
      { permission: "orders:read", label: "View test orders and samples" },
      { permission: "orders:write", label: "Create and cancel test orders" },
      { permission: "samples:write", label: "Collect, receive and reject samples" },
      { permission: "results:enter", label: "Enter and edit test results" },
      { permission: "results:verify", label: "Verify results and send them back (pathologist)" },
      { permission: "results:release", label: "Release reports to patients and withdraw them" },
      { permission: "reports:send", label: "Send report links by SMS or e-mail" },
    ],
  },
  {
    id: "billing", label: "Billing", items: [
      { permission: "billing:read", label: "View invoices and payments" },
      { permission: "billing:invoice", label: "Issue invoices" },
      { permission: "billing:payment", label: "Take payments" },
      { permission: "billing:void", label: "Void invoices" },
      { permission: "billing:refund", label: "Refund payments" },
    ],
  },
  {
    id: "finance", label: "Finance and reports", items: [
      { permission: "expenses:read", label: "View expenses and the daily summary" },
      { permission: "expenses:write", label: "Record and void expenses" },
      { permission: "finance:close", label: "Close the day's cash" },
      { permission: "reports:read", label: "View reports" },
    ],
  },
  {
    id: "inventory", label: "Inventory", items: [
      { permission: "inventory:read", label: "View stock, suppliers and purchases" },
      { permission: "inventory:write", label: "Change stock, record purchases, manage suppliers" },
    ],
  },
  {
    id: "setup", label: "Clinic setup", items: [
      { permission: "services:read", label: "View services and prices" },
      { permission: "services:write", label: "Edit services and prices" },
      { permission: "doctor:read", label: "View the doctor profile" },
      { permission: "doctor:write", label: "Edit the doctor profile and schedule" },
      { permission: "website:manage", label: "Manage website content, gallery and reviews" },
      { permission: "security:manage", label: "View the audit log and security settings" },
    ],
  },
  {
    id: "access", label: "Access control (administrator only)", items: [
      { permission: "users:manage", label: "Manage staff accounts" },
      { permission: "roles:manage", label: "Manage roles and permissions" },
      { permission: "email:manage", label: "Manage e-mail (SMTP) settings" },
      { permission: "sms:manage", label: "Manage SMS settings" },
    ],
  },
];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.permission));

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (ALL_PERMISSIONS as readonly string[]).includes(value);
}

export type RoleDefinition = { key: string; name: string; description: string; permissions: readonly Permission[] };

/** Built-in roles. They are created in the database on first use, then belong to the administrator. */
export const DEFAULT_ROLES: readonly RoleDefinition[] = [
  {
    key: "admin",
    name: "Administrator",
    description: "Full access, including staff accounts and roles. Cannot be restricted.",
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "receptionist",
    name: "Receptionist",
    description: "Front desk: patients, appointments, invoices and payments. Voiding and refunds need an administrator.",
    permissions: [
      "dashboard:read",
      "patients:read", "patients:write",
      "appointments:read", "appointments:write",
      "billing:read", "billing:invoice", "billing:payment",
      "orders:read", "orders:write", "samples:write", "reports:send",
      "services:read", "doctor:read", "inventory:read",
    ],
  },
  {
    key: "lab_staff",
    name: "Laboratory staff",
    description: "Laboratory floor: collects, receives and rejects samples and enters test results.",
    permissions: [
      "dashboard:read",
      "patients:read",
      "orders:read", "samples:write", "results:enter", "reports:send",
      "services:read", "inventory:read", "inventory:write",
    ],
  },
  {
    key: "pathologist",
    name: "Pathologist",
    description: "Reviews results and approves them for release. Can also enter results.",
    permissions: [
      "dashboard:read",
      "patients:read",
      "orders:read", "results:enter", "results:verify", "results:release", "reports:send",
      "services:read",
    ],
  },
  {
    key: "doctor",
    name: "Doctor",
    description: "Consulting doctor: sees patients, their test orders and released reports.",
    permissions: [
      "dashboard:read",
      "patients:read",
      "orders:read",
      "billing:read", "services:read", "doctor:read",
    ],
  },
  {
    key: "accountant",
    name: "Accountant",
    description: "Money: billing, refunds, expenses, cash closing, inventory purchases and reports.",
    permissions: [
      "dashboard:read",
      "patients:read",
      "billing:read", "billing:invoice", "billing:payment", "billing:refund",
      "expenses:read", "expenses:write", "finance:close", "reports:read",
      "orders:read", "inventory:read", "inventory:write", "services:read",
    ],
  },
];

export const ADMIN_ROLE_KEY = "admin";
/** The role of an account with no clinic access. */
export const NO_ACCESS_ROLE = "user";

const defaultsByKey = new Map(DEFAULT_ROLES.map((role) => [role.key, role]));

export function defaultRole(key: string | null | undefined) {
  return key ? defaultsByKey.get(key) : undefined;
}

/** What the built-in roles can do before any customisation (the server reads the real list from the database). */
export function defaultRoleHasPermission(role: string | null | undefined, permission: Permission) {
  return Boolean(defaultRole(role)?.permissions.includes(permission));
}

/** True when a list of permissions (from the signed-in user) includes the one asked for. */
export function can(permissions: readonly string[] | undefined, permission: Permission) {
  return Boolean(permissions?.includes(permission));
}

/** "Receptionist" for a built-in key; any other key is shown as typed. */
export function roleLabel(role: string | null | undefined) {
  if (!role || role === NO_ACCESS_ROLE) return "No access";
  return defaultRole(role)?.name ?? role;
}

// Permission needed to open each dashboard page. Pages that are mainly editing screens (doctor
// profile, services) require the write permission, so read-only roles are not shown
// a form they could never save. Their data is still readable through the APIs they are allowed.
export const sectionPermissions = {
  overview: "dashboard:read",
  appointments: "appointments:read",
  patients: "patients:read",
  doctors: "doctor:write",
  billing: "billing:read",
  reports: "reports:read",
  services: "services:write",
  orders: "orders:read",
  reviews: "website:manage",
  website: "website:manage",
  gallery: "website:manage",
  security: "security:manage",
  expenses: "expenses:read",
  inventory: "inventory:read",
  access: "users:manage",
  email: "email:manage",
  sms: "sms:manage",
} as const satisfies Record<string, Permission>;

export type SectionKey = keyof typeof sectionPermissions;
