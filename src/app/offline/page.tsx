import Link from "next/link";
import { Smile } from "lucide-react";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-purple-50 px-5 py-12 text-center text-slate-800">
      <div className="max-w-lg rounded-3xl border border-purple-100 bg-white p-8 shadow-xl sm:p-12">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-purple-800 text-white" aria-hidden="true"><Smile size={32} /></div>
        <h1 className="mt-6 text-2xl font-bold text-purple-950 sm:text-3xl">You&apos;re offline</h1>
        <p className="mt-3 text-slate-600">Please check your internet connection and try again.</p>
        <p className="mt-2 text-sm text-slate-500" lang="bn">ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।</p>
        <Link href="/" className="mt-7 inline-flex rounded-full bg-purple-700 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-800">
          Return to clinic website
        </Link>
      </div>
    </main>
  );
}
