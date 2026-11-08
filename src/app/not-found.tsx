import { SearchX } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Page not found" };

// Shown for any address that does not exist. Next.js answers with a 404 status and tells search
// engines not to index it. Styled with Tailwind utilities that read the design tokens, so it is
// right in both themes with no dark: classes.
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-page p-6">
      <div className="grid max-w-115 justify-items-center gap-3 rounded-2xl border border-line-1 bg-surface-1 px-8 py-10 text-center text-ink-1 shadow-overlay">
        <SearchX className="text-brand-600" size={40} aria-hidden="true" />
        <p className="m-0 bg-linear-to-br from-brand-500 to-accent bg-clip-text text-5xl leading-none font-bold text-transparent">404</p>
        <h1 className="m-0 text-xl font-bold">This page does not exist</h1>
        <p className="m-0 text-ink-2">The address may be mistyped, or the page may have been moved.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link className="button-primary no-underline" href="/">Go to the website</Link>
          <Link className="button-secondary no-underline" href="/dashboard">Staff sign-in</Link>
        </div>
      </div>
    </main>
  );
}
