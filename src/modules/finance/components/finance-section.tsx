"use client";

import { useState } from "react";
import ExpensesSection from "@/modules/expenses/components/expenses-section";
import CashClosing from "./cash-closing";

const TABS = [
  { id: "expenses", label: "Expenses" },
  { id: "closing", label: "Daily summary & cash closing" },
] as const;

export default function FinanceSection({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("expenses");
  return (
    <div className="inventory-section">
      <div className="wc-tabs" role="tablist" aria-label="Finance">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" id={`fin-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`fin-panel-${item.id}`} className={`wc-tab${tab === item.id ? " is-active" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`fin-panel-${tab}`} aria-labelledby={`fin-tab-${tab}`} className="inventory-panel">
        {tab === "expenses" ? <ExpensesSection onNotice={onNotice} /> : <CashClosing onNotice={onNotice} />}
      </div>
    </div>
  );
}
