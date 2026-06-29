"use client";
import { useState } from "react";
import Link from "next/link";

type Item = { id: string; kind: "follow" | "handoff" | "overdue"; text: string; href: string; sub: string };

const META: Record<string, { color: string; label: string }> = {
  follow: { color: "#7B61FF", label: "متابعة" },
  handoff: { color: "#F08A24", label: "تسليم" },
  overdue: { color: "#E0483B", label: "قسط متأخر" },
};

export default function NotificationsBell({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const n = items.length;
  return (
    <div style={{ position: "relative" }}>
      <button className="icon-btn" title="الإشعارات" type="button" onClick={() => setOpen((v) => !v)} style={{ position: "relative" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {n > 0 && (
          <span style={{ position: "absolute", top: 2, insetInlineEnd: 2, minWidth: 16, height: 16, borderRadius: 8, background: "var(--red)", color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 3px" }}>
            {n > 9 ? "9+" : n}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", insetInlineEnd: 0, top: 44, width: 320, maxHeight: 420, overflow: "auto", background: "#fff", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 20px 50px rgba(16,27,48,.18)", zIndex: 50 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", fontWeight: 800, fontSize: 14 }}>
              التنبيهات {n > 0 && <span className="num" style={{ color: "var(--muted)" }}>({n})</span>}
            </div>
            {n === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>مفيش حاجة مطلوبة دلوقتي 🎉</div>
            ) : items.map((it) => {
              const m = META[it.kind];
              return (
                <Link key={it.id} href={it.href} onClick={() => setOpen(false)}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ marginTop: 2, width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600 }}>{it.text}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
                      <span style={{ color: m.color, fontWeight: 700 }}>{m.label}</span> · {it.sub}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
