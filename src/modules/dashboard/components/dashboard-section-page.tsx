"use client";

import AdminDashboard, { type DashboardSection } from "@/modules/dashboard/components/admin-dashboard";
import { useAdminSession } from "@/components/shared/admin-session-provider";

export default function DashboardSectionPage({
  section,
}: {
  section: DashboardSection;
}) {
  const { user, todayLabel, now } = useAdminSession();

  return (
    <AdminDashboard
      key={section}
      user={user}
      todayLabel={todayLabel}
      now={now}
      initialSection={section}
    />
  );
}
