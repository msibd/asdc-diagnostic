"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/** A Code 128 barcode of a sample code, drawn as SVG so it stays sharp at any print size. */
export default function SampleBarcode({ value, height = 44, width = 2 }: { value: string; height?: number; width?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: "CODE128", displayValue: false, height, width, margin: 0 });
    } catch {
      // A value Code 128 cannot encode would be a bug elsewhere; show nothing rather than a wrong barcode.
      ref.current.replaceChildren();
    }
  }, [value, height, width]);
  return <svg ref={ref} className="sample-barcode" role="img" aria-label={`Barcode ${value}`} />;
}
