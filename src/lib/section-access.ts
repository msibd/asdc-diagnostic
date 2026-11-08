import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/admin-session";
import { sectionPermissions, type SectionKey } from "@/lib/permissions";

/** Server-side page guard: staff without access to a section are sent back to the overview. */
export async function requireSection(section: SectionKey) {
  const access = await getStaffSession();
  if (!access.session) redirect(access.status === 401 ? "/login" : "/login?access=denied");
  if (!access.permissions.includes(sectionPermissions[section])) redirect("/dashboard");
}

/** For pages every staff member may open (for example their own password and sessions): signed in and active, no specific permission. */
export async function requireStaff() {
  const access = await getStaffSession();
  if (!access.session) redirect(access.status === 401 ? "/login" : "/login?access=denied");
}
