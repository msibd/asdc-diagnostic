import ForgotPasswordForm from "@/modules/auth/components/forgot-password-form";

export const instant = false;

export const metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
