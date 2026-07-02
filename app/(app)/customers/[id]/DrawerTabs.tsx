"use client";
import { useState, type ReactNode } from "react";

export default function DrawerTabs({ basic, sales, docs, footer }: {
  basic: ReactNode; sales: ReactNode; docs: ReactNode;
  footer?: (tab: string) => ReactNode;
}) {
  const [tab, setTab] = useState<"basic" | "sales" | "docs">("basic");
  const TabBtn = ({ val, label }: { val: typeof tab; label: string }) => (
    <button type="button" onClick={() => setTab(val)}
      className={"relative px-4 py-2.5 text-[12.5px] font-bold transition-colors duration-150 " +
        (tab === val ? "text-brand" : "text-muted hover:text-ink")}>
      {label}
      {tab === val && <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-brand" />}
    </button>
  );
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center border-b border-line px-1 sticky top-0 bg-[var(--bg)] z-3">
        <TabBtn val="basic" label="أساسية" />
        <TabBtn val="sales" label="مبيعات واشتراكات" />
        <TabBtn val="docs" label="مستندات وتواصل" />
      </div>
      <div className="tab-pane flex flex-col flex-1 min-h-0" key={tab}>
        {tab === "basic" && basic}
        {tab === "sales" && sales}
        {tab === "docs" && docs}
      </div>
      {footer?.(tab)}
    </div>
  );
}
