import { getStaffSession } from "@/lib/admin-session";
import { BRAND_NAME } from "@/lib/brand";
import { getRoleName } from "@/lib/roles";
import { readWebsiteContent } from "@/modules/website/queries/website-content";
import AdminSessionProvider from "@/components/shared/admin-session-provider";
import QueryProvider from "@/components/shared/query-provider";
import DashboardSidebar from "@/modules/dashboard/components/dashboard-sidebar";
import { redirect } from "next/navigation";

export const instant = false;

// Staff pages are private: keep them out of search results.
export const metadata = { title: "Staff dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const access = await getStaffSession();
  if (!access.session) {
    redirect(access.status === 401 ? "/login" : "/login?access=denied");
  }

  const identity = {
    name: access.session.user.name,
    email: access.session.user.email,
    role: access.role ?? "user",
    roleName: await getRoleName(access.role ?? "user"),
    permissions: access.permissions,
  };
  // The centre name shown in the sidebar follows Website content, so it is changed in one place.
  const content = await readWebsiteContent();
  const brandName = content.clinicName.trim() ? [content.clinicName.trim(), content.clinicSubtitle.trim()].filter(Boolean).join(" ") : BRAND_NAME;
  const now = new Date();
  const todayLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(now);

  return (
    <AdminSessionProvider
      user={identity}
      todayLabel={todayLabel}
      now={now.toISOString()}
    >
      <QueryProvider>
        <div className="admin-shell" lang="en">
          <DashboardSidebar user={identity} brandName={brandName} />
          {children}
        </div>
      </QueryProvider>
    </AdminSessionProvider>
  );
}
