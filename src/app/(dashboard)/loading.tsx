// Shown inside the dashboard shell (the sidebar stays) while a page loads. Skeletons keep the
// page's shape, so nothing jumps when the real content arrives.
export default function DashboardLoading() {
  return (
    <div className="main-area" aria-busy="true">
      <main className="content" id="main-content">
        <p className="sr-only" role="status">Loading…</p>
        <div className="skeleton mb-3 h-3.5 w-30" />
        <div className="skeleton mb-6 h-8.5 w-70" />
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {Array.from({ length: 4 }, (_, index) => <div className="skeleton h-23" key={index} />)}
        </div>
        <div className="skeleton mb-4 h-65" />
        <div className="skeleton h-45" />
      </main>
    </div>
  );
}
