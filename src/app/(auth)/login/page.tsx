import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/modules/auth/components/login-form";
import { getStaffSession } from "@/lib/admin-session";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string }>;
}) {
  // Anyone already signed in with clinic access (any staff role) goes straight to the dashboard.
  const staff = await getStaffSession(await headers());
  if (staff.session) redirect("/dashboard");

  const { access } = await searchParams;

  return <LoginForm accessDenied={access === "denied"} />;
}
