import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { BRAND_NAME } from "@/lib/brand";
import { bdtCurrency } from "@/lib/format";
import PrintButton from "./print-button";

export const instant = false;
export const metadata = { title: "Price list" };

const reportTime = (hours: number | null) => (hours == null ? "" : hours >= 24 && hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? "" : "s"}` : `${hours} h`);

/** A clean, printable price list of every active test, panel and service, grouped by category. */
export default async function PriceListPage() {
  const access = await getStaffSession();
  if (!access.session) redirect(access.status === 401 ? "/login" : "/login?access=denied");
  if (!access.permissions.includes("services:read")) redirect("/dashboard");

  const items = await prisma.clinicService.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { kind: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, category: true, kind: true, sampleType: true, turnaroundHours: true, fastingRequired: true, standardPrice: true },
  });
  const groups = new Map<string, typeof items>();
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  const today = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date());

  return (
    <div className="main-area">
    <div className="content price-list">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{BRAND_NAME}</div>
          <h1 className="page-title">Price list</h1>
          <p className="page-subtitle">As of {today} · {items.length} items</p>
        </div>
        <PrintButton />
      </div>
      {[...groups.entries()].map(([category, rows]) => (
        <section className="panel-card price-list-group" key={category}>
          <header className="panel-header"><h2 className="panel-title">{category}</h2></header>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Sample</th><th>Report</th><th className="price-list-amount">Price (BDT)</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td><strong>{row.name}</strong>{row.kind === "PANEL" && <span className="catalog-kind catalog-kind-panel">Package</span>}{row.fastingRequired && <div className="cell-secondary">Fasting required</div>}</td>
                    <td>{row.kind === "SERVICE" ? "" : row.sampleType ?? ""}</td>
                    <td>{row.kind === "SERVICE" ? "" : reportTime(row.turnaroundHours)}</td>
                    <td className="price-list-amount">{bdtCurrency.format(Number(row.standardPrice))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!items.length && <p className="empty-state">No active items yet. Add tests in Tests &amp; services.</p>}
    </div>
    </div>
  );
}
