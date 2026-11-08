"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

// Shown when the doctor pages fail to load; the visitor can retry or go back to the home page.
export default function DoctorsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div data-public-site className="grid min-h-screen place-items-center bg-purple-50/30 px-4">
      <div role="alert" className="max-w-md rounded-lg border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">We couldn&apos;t load the doctors</h1>
        <p className="mt-2 text-sm text-slate-600">Something went wrong on our side. Please try again in a moment. · কিছু সমস্যা হয়েছে, আবার চেষ্টা করুন।</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-800"><RefreshCw size={15} aria-hidden />Try again</button>
          <Link href="/" className="rounded-xl border border-purple-200 px-4 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-50">Home</Link>
        </div>
      </div>
    </div>
  );
}
