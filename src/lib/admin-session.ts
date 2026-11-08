import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { type Permission } from "@/lib/permissions";
import { getRolePermissions } from "@/lib/roles";

type Failure = { session: null; status: 401 | 403; error: string };

/** Signed-in staff member (any staff role), or a 401/403 failure. Used by dashboard pages. */
export async function getStaffSession(requestHeaders?: Headers) {
  const session = await auth.api.getSession({
    headers: requestHeaders ?? await headers(),
  });

  if (!session) {
    return { session: null, status: 401 as const, error: "Unauthorized" } satisfies Failure;
  }

  // A deactivated account is refused even if it still holds a session.
  if (session.user.isActive === false) {
    return { session: null, status: 403 as const, error: "This account has been deactivated." } satisfies Failure;
  }

  const permissions = await getRolePermissions(session.user.role);
  if (!permissions.length) {
    return { session: null, status: 403 as const, error: "This account does not have clinic access." } satisfies Failure;
  }

  return { session, role: session.user.role, permissions, status: 200 as const };
}

/**
 * Server-side authorization for API routes: the caller must be signed in, be staff, and hold the
 * given permission. On failure respond with `{ error: access.error }, { status: access.status }`.
 */
export async function authorize(requestHeaders: Headers, permission: Permission) {
  const access = await getStaffSession(requestHeaders);
  if (!access.session) return access;
  if (!access.permissions.includes(permission)) {
    return { session: null, status: 403 as const, error: "You do not have permission to perform this action." } satisfies Failure;
  }
  return access;
}
