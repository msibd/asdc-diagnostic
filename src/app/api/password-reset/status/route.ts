import { NextResponse } from "next/server";
import { isEmailEnabled } from "@/modules/email/email-config-service";

// Lets the sign-in page decide whether to offer "Forgot password". It says only whether e-mail is
// switched on for the clinic, nothing about any account.
export async function GET() {
  return NextResponse.json({ available: await isEmailEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
