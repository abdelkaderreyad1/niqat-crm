"use client";
import { useState, type ReactNode } from "react";

export default function DrawerTabs({ basic, sales, docs }: {
  basic: ReactNode; sales: ReactNode; docs: ReactNode;
}) {
  const [tab, setTab] = useState<"basic" | "sales" | "docs">("basic");
  return (
    <div>
      <div className="tabs-row" style={{ position: "sticky", top: 0, background: "var(--bg)", zIndex: 3, paddingTop: 2 }}>
        <button type="button" className="tabbtn" data-active={tab === "basic" ? "1" : "0"} onClick={() => setTab("basic")}>أساسية</button>
        <button type="button" className="tabbtn" data-active={tab === "sales" ? "1" : "0"} onClick={() => setTab("sales")}>مبيعات واشتراكات</button>
        <button type="button" className="tabbtn" data-active={tab === "docs" ? "1" : "0"} onClick={() => setTab("docs")}>مستندات وتواصل</button>
      </div>
      <div className="tab-pane" key={tab}>
        {tab === "basic" && basic}
        {tab === "sales" && sales}
        {tab === "docs" && docs}
      </div>
    </div>
  );
}
