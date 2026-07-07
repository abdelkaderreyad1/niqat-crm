"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

type DiplomaGroup = {
  name: string;
  total: number;
  batches: { code: string; n: number }[];
};

const COLORS = ["#F08A24", "#2F6BFF", "#0FA3A3", "#7B61FF", "#18A957", "#E6A700", "#E0483B", "#25D366"];

export default function BatchesByDiploma({ groups }: { groups: DiplomaGroup[] }) {
  const tr = useT();
  // أول دبلومة مفتوحة افتراضياً، الباقي مقفول
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const maxTotal = Math.max(1, ...groups.map((g) => g.total));

  if (groups.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>{tr("noEnrolls")}</div>;
  }

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      {groups.map((g, gi) => {
        const isOpen = !!open[gi];
        const color = COLORS[gi % COLORS.length];
        const maxBatch = Math.max(1, ...g.batches.map((b) => b.n));
        return (
          <div key={g.name} style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
            {/* رأس الدبلومة — قابل للضغط */}
            <button
              onClick={() => setOpen((s) => ({ ...s, [gi]: !s[gi] }))}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                background: "none", border: "none", cursor: "pointer", textAlign: "start",
              }}>
              {/* سهم يلف */}
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.5}
                style={{ width: 15, height: 15, flexShrink: 0, transition: "transform .25s cubic-bezier(.4,0,.2,1)", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                <path d="M9 5l7 7-7 7" />
              </svg>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ fontWeight: 800, fontSize: 13.5, flex: 1, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
              {/* شريط مصغّر لإجمالي الدبلومة */}
              <div style={{ width: 70, height: 6, background: "var(--muted-soft)", borderRadius: 20, overflow: "hidden", flexShrink: 0 }}>
                <div style={{ width: (g.total / maxTotal) * 100 + "%", height: "100%", background: color, borderRadius: 20, transition: "width .7s cubic-bezier(.22,1,.36,1)" }} />
              </div>
              <span className="chip" style={{ background: color + "1a", color, flexShrink: 0, minWidth: 32, textAlign: "center" }}>{g.total}</span>
            </button>

            {/* الباتشات — تنطوي بحركة */}
            <div style={{ maxHeight: isOpen ? g.batches.length * 40 + 12 : 0, overflow: "hidden", transition: "max-height .35s cubic-bezier(.4,0,.2,1)" }}>
              <div style={{ padding: "4px 14px 12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {g.batches.map((b) => (
                  <div key={b.code} style={{ display: "flex", alignItems: "center", gap: 10, paddingInlineStart: 24 }}>
                    <span className="num" style={{ minWidth: 46, fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }} dir="ltr">{b.code}</span>
                    <div style={{ flex: 1, height: 7, background: "var(--muted-soft)", borderRadius: 20, overflow: "hidden" }}>
                      <div style={{ width: isOpen ? (b.n / maxBatch) * 100 + "%" : "0%", height: "100%", background: color, opacity: 0.75, borderRadius: 20, transition: "width .6s cubic-bezier(.22,1,.36,1)" }} />
                    </div>
                    <span className="num" style={{ width: 34, textAlign: "end", fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{b.n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
