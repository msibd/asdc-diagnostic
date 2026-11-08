"use client";

import { useEffect } from "react";

// Last-resort screen when the root layout itself fails. It replaces the whole document, so it
// carries its own <html>, <body> and styles (the app's CSS is not loaded here), and follows the
// device's light or dark setting.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <style>{`
          .ge { display: grid; min-height: 100vh; place-items: center; padding: 24px; font-family: system-ui, Segoe UI, Arial, sans-serif; background: #f5f3f1; color: #1f2c40; }
          .ge-card { max-width: 440px; padding: 32px; border: 1px solid #e5e0dc; border-radius: 16px; background: #fff; text-align: center; box-shadow: 0 8px 24px rgb(35 23 15 / 10%); }
          .ge h1 { margin: 0 0 8px; font-size: 22px; line-height: 1.3; }
          .ge p { margin: 0 0 20px; color: #4a5668; line-height: 1.6; }
          .ge button, .ge a { display: inline-block; margin: 4px; padding: 10px 18px; border: 0; border-radius: 8px; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
          .ge button { background: #c2410c; color: #fff; }
          .ge a { background: #f5ede7; color: #572c0f; }
          .ge button:focus-visible, .ge a:focus-visible { outline: 3px solid #ea580c; outline-offset: 2px; }
          @media (prefers-color-scheme: dark) {
            .ge { background: #1a2027; color: #eef1f4; }
            .ge-card { border-color: #414b56; background: #232b34; }
            .ge p { color: #c3ccd5; }
            .ge a { background: #323d48; color: #eef1f4; }
          }
        `}</style>
        <main className="ge">
          <div className="ge-card" role="alert">
            <h1>Something went wrong</h1>
            <p>The page could not be shown. Nothing was changed or lost. Please try again.</p>
            <button type="button" onClick={() => retry()}>Try again</button>
            {/* A plain link on purpose: this screen replaces the whole app, router included. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Go to the home page</a>
          </div>
        </main>
      </body>
    </html>
  );
}
