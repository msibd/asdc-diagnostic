"use client";

import { useState } from "react";
import { useAdminSession } from "@/components/shared/admin-session-provider";
import { can } from "@/lib/permissions";
import HistoryTab from "./history-tab";
import PurchasesTab from "./purchases-tab";
import StockTab from "./stock-tab";
import SuppliersTab from "./suppliers-tab";

const TABS = [
  { id: "stock", label: "Stock" },
  { id: "purchases", label: "Purchases" },
  { id: "suppliers", label: "Suppliers" },
  { id: "history", label: "Reports & history" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function InventorySection({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const { user } = useAdminSession();
  const [tab, setTab] = useState<TabId>("stock");
  // The server enforces this on every request; hiding the buttons just avoids offering what would be refused.
  const canWrite = can(user.permissions, "inventory:write");

  return (
    <div className="inventory-section">
      <div className="wc-tabs" role="tablist" aria-label="Inventory">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" id={`inv-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`inv-panel-${item.id}`} className={`wc-tab${tab === item.id ? " is-active" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`inv-panel-${tab}`} aria-labelledby={`inv-tab-${tab}`} className="inventory-panel">
        {tab === "stock" && <StockTab canWrite={canWrite} onNotice={onNotice} />}
        {tab === "purchases" && <PurchasesTab canWrite={canWrite} onNotice={onNotice} />}
        {tab === "suppliers" && <SuppliersTab canWrite={canWrite} onNotice={onNotice} />}
        {tab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
