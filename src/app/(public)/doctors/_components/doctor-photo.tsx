"use client";

import Image from "next/image";
import { useState } from "react";
import { initialsOf } from "./public-format";

/**
 * Profile photo from the doctor's public image address. Uses next/image like the rest of the public
 * site (images are admin-supplied URLs, hence `unoptimized`), and falls back to initials when there is
 * no photo or it fails to load.
 */
export default function DoctorPhoto({ name, imageUrl, className, priority = false }: { name: string; imageUrl: string | null; className?: string; priority?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!imageUrl || failedUrl === imageUrl) {
    return (
      <div className={`grid place-items-center bg-gradient-to-br from-purple-100 to-purple-200 text-purple-800 ${className ?? ""}`} role="img" aria-label={name}>
        <span className="text-4xl font-bold tracking-wide" aria-hidden>{initialsOf(name)}</span>
      </div>
    );
  }
  return (
    <Image
      src={imageUrl}
      alt={name}
      width={640}
      height={640}
      unoptimized
      priority={priority}
      onError={() => setFailedUrl(imageUrl)}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
