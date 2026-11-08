import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLE_KEY, ALL_PERMISSIONS, DEFAULT_ROLES, NO_ACCESS_ROLE, defaultRole, isPermission, type Permission,
} from "@/lib/permissions";

// Role -> permissions, read from the Role table. A short cache keeps the database out of every
// request; it is cleared at once on this server whenever a role changes, and expires on its own
// after a few seconds for any other running copy of the app.
const CACHE_MS = 10_000;
const cache = new Map<string, { permissions: Permission[]; expires: number }>();

export function invalidateRoleCache() {
  cache.clear();
}

/** The permissions a role key grants right now. Unknown or deleted roles grant nothing. */
export async function getRolePermissions(roleKey: string | null | undefined): Promise<Permission[]> {
  if (!roleKey || roleKey === NO_ACCESS_ROLE) return [];
  // The administrator can never be locked out by a bad edit, whatever the table says.
  if (roleKey === ADMIN_ROLE_KEY) return [...ALL_PERMISSIONS];
  const hit = cache.get(roleKey);
  if (hit && hit.expires > Date.now()) return hit.permissions;

  const row = await prisma.role.findUnique({ where: { key: roleKey }, select: { permissions: true } });
  // A built-in role that has never been saved uses its defaults; any other missing role grants nothing.
  const permissions = row ? row.permissions.filter(isPermission) : [...(defaultRole(roleKey)?.permissions ?? [])];
  cache.set(roleKey, { permissions, expires: Date.now() + CACHE_MS });
  return permissions;
}

/** Creates the built-in roles that are missing from the table (never overwrites an edited one). */
export async function ensureSystemRoles() {
  await prisma.role.createMany({
    data: DEFAULT_ROLES.map((role) => ({
      key: role.key, name: role.name, description: role.description, permissions: [...role.permissions], isSystem: true,
    })),
    skipDuplicates: true,
  });
}

/** The display name of a role ("Receptionist"), falling back to the key. */
export async function getRoleName(roleKey: string) {
  const row = await prisma.role.findUnique({ where: { key: roleKey }, select: { name: true } });
  return row?.name ?? defaultRole(roleKey)?.name ?? roleKey;
}

/** True for an active account whose role grants at least one permission. */
export async function isStaffAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  if (!user?.isActive) return false;
  return (await getRolePermissions(user.role)).length > 0;
}
