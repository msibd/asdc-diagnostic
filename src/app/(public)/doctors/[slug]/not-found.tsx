import Link from "next/link";

// A doctor who does not exist, or is not active and published, looks exactly like a missing page.
export default function DoctorNotFound() {
  return (
    <div data-public-site className="grid min-h-screen place-items-center bg-purple-50/30 px-4">
      <div className="max-w-md rounded-lg border border-purple-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Doctor not found</h1>
        <p className="mt-2 text-sm text-slate-600">This profile does not exist or is not available. · এই প্রোফাইলটি পাওয়া যায়নি।</p>
        <Link href="/doctors" className="mt-5 inline-block rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-800">See all doctors</Link>
      </div>
    </div>
  );
}
