"use client";

import Image from "next/image";
import { useState } from "react";
import { initials } from "@/lib/format";

/** Small round profile photo for the admin lists; initials when there is no photo or it fails to load. */
export default function DoctorAvatar({ name, imageUrl, size = 40 }: { name: string; imageUrl: string | null; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const style = { width: size, height: size };
  if (!imageUrl || failedUrl === imageUrl) {
    return <span className="doctor-avatar" style={style} aria-hidden>{initials(name.replace(/^(dr|prof)\.?\s+/i, "")) || "Dr"}</span>;
  }
  return (
    <Image
      className="doctor-avatar"
      src={imageUrl}
      alt=""
      width={size}
      height={size}
      unoptimized
      style={style}
      onError={() => setFailedUrl(imageUrl)}
    />
  );
}
