"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatStatus } from "@/lib/status-labels";
import { bdtCurrency as currency } from "@/lib/format";
import { requestJson, type ReportRecord } from "./clinic-types";
import { useSectionLoader, localDate, Metric } from "./section-shared";

export default function ReportsSection() {
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [from, setFrom] = useState(localDate(29));
  const [to, setTo] = useState(localDate());

  const load = useCallback(async () => {
    setReport(await requestJson<ReportRecord>(await fetch(`/api/reports?from=${from}&to=${to}`, { cache: "no-store" })));
  }, [from, to]);

  const { gate, reload } = useSectionLoader({ section: "reports", load });

  function exportReport() {
    if (!report) return;
    const rows = [
      ["Metric", "Value"],
      ["From", from], ["To", to], ["Patient registrations", String(report.patientRegistrations)],
      ["Appointments", String(report.appointments.total)], ["Revenue (BDT)", report.revenue],
      ["Outstanding (BDT)", report.outstanding], ["Payment transactions", String(report.paymentTransactions)],
      ...Object.entries(report.appointments.byStatus).map(([status, count]) => [`Appointments ${status}`, String(count)]),
      ["Expenses (BDT)", report.expenses.total], ["Profit / loss (BDT)", report.netIncome],
      ["No-shows", String(report.noShows.count)], ["No-show rate (%)", String(report.noShows.ratePercent)],
      ...report.revenueByMethod.map((item) => [`Collected via ${item.method}`, item.amount]),
      ...report.expenses.byCategory.map((item) => [`Expense ${item.category}`, item.amount]),
      ...report.orders.map((item) => [`Test orders ${item.status}`, String(item.count)]),
    ];
    const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `clinic-report-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (gate) return gate;

  return (
    <section className="panel-card clinic-module-card">
      <header className="panel-header"><div><h2 className="panel-title">Clinic reports</h2><p className="panel-description">Operational and cash-collection summaries from persisted clinic records.</p></div><button className="button-secondary" onClick={exportReport}>Export CSV</button></header>
      <div className="clinic-report-range"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label><button className="button-secondary" onClick={() => reload()}><RefreshCw size={14} /> Apply range</button></div>
      {report && <><div className="clinic-report-cards"><Metric label="Patient registrations" value={report.patientRegistrations} /><Metric label="Appointments" value={report.appointments.total} /><Metric label="Collected revenue" value={currency.format(Number(report.revenue))} /><Metric label="Outstanding" value={currency.format(Number(report.outstanding))} /><Metric label="Payment transactions" value={report.paymentTransactions} /><Metric label="Expenses" value={currency.format(Number(report.expenses.total))} /><Metric label={Number(report.netIncome) < 0 ? "Loss" : "Profit"} value={currency.format(Number(report.netIncome))} /><Metric label="No-shows" value={`${report.noShows.count} (${report.noShows.ratePercent}%)`} /></div><p className="panel-description">Profit / loss is cash collected minus recorded expenses for the period (a cash view, not full accounting).</p><div className="clinic-report-columns"><div><h3 className="clinic-subheading">Appointment status</h3>{Object.entries(report.appointments.byStatus).map(([status, count]) => <p key={status}>{formatStatus(status)} <strong>{count}</strong></p>)}</div><div><h3 className="clinic-subheading">Collected by payment method</h3>{report.revenueByMethod.length ? report.revenueByMethod.map((item) => <p key={item.method}>{formatStatus(item.method)} <strong>{currency.format(Number(item.amount))}</strong></p>) : <p>No payments</p>}</div><div><h3 className="clinic-subheading">Expenses by category</h3>{report.expenses.byCategory.length ? report.expenses.byCategory.map((item) => <p key={item.category}>{formatStatus(item.category)} <strong>{currency.format(Number(item.amount))}</strong></p>) : <p>No expenses</p>}</div><div><h3 className="clinic-subheading">Most missed appointments</h3>{report.noShows.patients.length ? report.noShows.patients.map((item) => <p key={`${item.name}${item.phone}`}>{item.name} <strong>{item.count}</strong></p>) : <p>No no-shows</p>}</div><div><h3 className="clinic-subheading">Test orders</h3>{report.orders.map((item) => <p key={item.status}>{formatStatus(item.status)} <strong>{item.count}</strong></p>)}</div><div><h3 className="clinic-subheading">Appointments by day</h3>{report.dailyAppointments.slice(-14).map((item) => <p key={item.date}>{item.date} <strong>{item.count}</strong></p>)}</div><div><h3 className="clinic-subheading">Cash collected by day</h3>{report.dailyRevenue.slice(-14).map((item) => <p key={item.date}>{item.date} <strong>{currency.format(Number(item.amount))}</strong></p>)}</div></div></>}
    </section>
  );
}
