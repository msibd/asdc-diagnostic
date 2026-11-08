import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { PasswordChangeError, changePasswordWithCode } from "@/modules/password-recovery/password-change-service";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128),
  newPassword: z.string().min(10, "The new password must be at least 10 characters.").max(128, "The new password is too long."),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your e-mail."),
});

const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";

// Step 2: change the password, after checking the current password and the e-mailed code.
export async function POST(request: Request) {
  const access = await getStaffSession(request.headers);
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, schema, "Invalid request.");
  if (!body.ok) return body.response;
  const { id, name, email } = access.session.user;
  try {
    const { cookies } = await changePasswordWithCode({ id, name, email }, body.data, request.headers, clientIp(request));
    const response = NextResponse.json({ success: true });
    // The browser keeps its session: it receives the fresh session cookie.
    for (const cookie of cookies) response.headers.append("set-cookie", cookie);
    return response;
  } catch (error) {
    if (error instanceof PasswordChangeError) return apiError(error.message, error.status, error.retryAfter ? { retryAfter: error.retryAfter } : undefined);
    throw error;
  }
}
