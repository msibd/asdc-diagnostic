import { NextResponse } from "next/server";
import { getPublicClinicData } from "@/app/public_website/queries/clinic-queries";

export async function GET() {
  return NextResponse.json(await getPublicClinicData(), {
    headers: { "Cache-Control": "no-store" },
  });
}
