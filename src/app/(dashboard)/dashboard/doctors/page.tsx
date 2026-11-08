import { requireSection } from "@/lib/section-access";
import DashboardSectionPage from "@/modules/dashboard/components/dashboard-section-page";

export const instant = false;

export default async function DoctorsPage() {
  await requireSection("doctors");
  return <DashboardSectionPage section="doctors" />;
}
