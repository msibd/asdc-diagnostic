import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { getPatientCount } from "@/modules/patients/services/patient-service";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "patients:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const total = await getPatientCount();
  return NextResponse.json({ total });
}
