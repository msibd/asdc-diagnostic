import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-session";
import { apiError } from "@/lib/api";
import { PasswordChangeError, maskEmail, sendPasswordChangeCode } from "@/modules/password-recovery/password-change-service";

const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";

// Step 1 of changing your own password: e-mail a verification code to the signed-in user's address.
export async function POST(request: Request) {
  const access = await getStaffSession(request.headers);
  if (!access.session) return apiError(access.error, access.status);
  const { id, name, email } = access.session.user;
  try {
    await sendPasswordChangeCode({ id, name, email }, clientIp(request));
  } catch (error) {
    if (error instanceof PasswordChangeError) return apiError(error.message, error.status, error.retryAfter ? { retryAfter: error.retryAfter } : undefined);
    throw error;
  }
  return NextResponse.json({ sent: true, email: maskEmail(email) });
}
