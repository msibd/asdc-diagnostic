import { requireSection } from "@/lib/section-access";
import DashboardSectionPage from "@/modules/dashboard/components/dashboard-section-page";

export const instant = false;

export default async function ReportsPage() {
  await requireSection("reports");
  return <DashboardSectionPage section="reports" />;
}
