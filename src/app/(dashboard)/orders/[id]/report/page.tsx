import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/admin-session";
import ReportView from "./report-view";

export const instant = false;
export const metadata = { title: "Lab report" };

/** The released report (or a preview) as a printable page, for staff. */
export default async function OrderReportPage(props: PageProps<"/orders/[id]/report">) {
  const access = await getStaffSession();
  if (!access.session) redirect(access.status === 401 ? "/login" : "/login?access=denied");
  if (!access.permissions.includes("orders:read")) redirect("/dashboard");
  const { id } = await props.params;
  return <ReportView orderId={id} />;
}
