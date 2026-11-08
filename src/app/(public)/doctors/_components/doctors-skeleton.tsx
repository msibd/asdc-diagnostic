// Shown while the doctor list loads: card-shaped placeholders in the public site colours.
export default function DoctorsSkeleton() {
  return (
    <div role="status" aria-label="Loading doctors">
      <div className="border-b border-purple-100 bg-purple-100/60 py-12">
        <div className="site-container space-y-3">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-purple-200/70" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-purple-200/60" />
        </div>
      </div>
      <ul className="site-container grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((item) => (
          <li key={item} className="overflow-hidden rounded-lg border border-purple-100 bg-white">
            <div className="aspect-[4/3] animate-pulse bg-purple-100/70" />
            <div className="space-y-3 p-5">
              <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-16 animate-pulse rounded bg-slate-100" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
