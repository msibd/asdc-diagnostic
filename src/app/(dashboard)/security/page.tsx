import { requireStaff } from "@/lib/section-access";
import DashboardSectionPage from "@/modules/dashboard/components/dashboard-section-page";

export const instant = false;

export default async function SecurityPage() {
  // Everyone on staff manages their own password and sessions here; the audit log inside needs security:manage.
  await requireStaff();
  return <DashboardSectionPage section="security" />;
}
