import { requireSection } from "@/lib/section-access";
import DashboardSectionPage from "@/modules/dashboard/components/dashboard-section-page";

export const instant = false;

export default async function WebsiteContentPage() {
  await requireSection("website");
  return <DashboardSectionPage section="website" />;
}
