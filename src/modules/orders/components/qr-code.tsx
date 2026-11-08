"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A QR code of a web address, as a plain image so it prints sharply and survives "Save as PDF". */
export default function QrCode({ value, size = 96, label }: { value: string; size?: number; label: string }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    // High error correction: a printed code survives a crease or a smudge and still scans.
    QRCode.toDataURL(value, { margin: 1, width: size * 3, errorCorrectionLevel: "H" })
      .then((url) => { if (!cancelled) setSource(url); })
      .catch(() => { if (!cancelled) setSource(null); });
    return () => { cancelled = true; };
  }, [value, size]);
  // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, nothing for next/image to optimise
  return source ? <img src={source} width={size} height={size} alt={label} className="qr-code" /> : <span className="qr-code qr-code-empty" style={{ width: size, height: size }} aria-hidden />;
}
