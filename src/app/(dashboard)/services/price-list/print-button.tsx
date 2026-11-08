"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button type="button" className="button-primary price-list-print" onClick={() => window.print()}>
      <Printer size={14} /> Print
    </button>
  );
}
