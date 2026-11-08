import { NextResponse } from "next/server";
import { getPublicGalleryImages } from "@/app/public_website/queries/clinic-queries";

export async function GET() {
  const images = await getPublicGalleryImages();
  return NextResponse.json({ images }, { headers: { "Cache-Control": "no-store" } });
}
