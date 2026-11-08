import type { Metadata } from "next";
import PublicReport from "./public-report";

// A patient's private report: never indexed, never cached.
export const metadata: Metadata = { title: "Your report", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
export const instant = false;

export default async function ReportPage(props: PageProps<"/r/[token]">) {
  const { token } = await props.params;
  return <PublicReport token={token} />;
}
