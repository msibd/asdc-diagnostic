"use client";

// Inline scripts that must run before the page is shown (saved theme, saved public language).
//
// React 19 refuses to run a <script> it creates in the browser and logs "Encountered a script tag
// while rendering React component". These scripts only matter in the server-rendered HTML, so they
// are emitted on the server and skipped in the browser; the browser keeps the nodes it was sent.
export default function BootstrapScripts({ scripts }: { scripts: { id: string; code: string }[] }) {
  if (typeof window !== "undefined") return null;
  return (
    <>
      {scripts.map((script) => (
        <script key={script.id} id={script.id} dangerouslySetInnerHTML={{ __html: script.code }} />
      ))}
    </>
  );
}
