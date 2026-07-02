"use client";
import { useState, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; label: string; done: boolean; by: string | null; at: string };
type Card = {
  handoffId: string; custId: string; name: string; phone: string;
  status: string; note: string; assignee: string; diplomas: string[]; items: Item[];
};

function initials(name: string) {
  const p = (name || "؟").trim().split(/\s+/);
  return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2);
}
const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
function avColor(id: string) { let h = 0; for (const c of id || "") h += c.charCodeAt(0); return AV[h % AV.length]; }
function waLink(phone: string) { const d = (phone || "").replace(/\D/g, ""); return d ? "https://wa.me/" + d : "#"; }

const CardView = memo(function CardView({
  c, onToggle, onComplete,
}: {
  c: Card;
  onToggle: (hid: string, iid: string) => void;
  onComplete: (hid: string) => void;
}) {
  const total = c.items.length;
  const dn = c.items.filter((i) => i.done).length;
  const allDone = total > 0 && dn === total;
  return (
    <div className="onb-card" style={{ background: "var(--surface)" }}>
      <div className="oh">
        <span className="av" style={{ background: avColor(c.custId), width: 40, height: 40 }}>{initials(c.name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ color: "var(--ink)" }}>{c.name}</b>
          <div style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--fe)", direction: "ltr" }}>{c.phone || "—"}</div>
        </div>
        <span className="chip" style={{ background: allDone ? "#eaf7ef" : "#fff4e9", color: allDone ? "var(--green)" : "var(--brand)" }}>
          {allDone ? "جاهز للإتمام" : "محتاج تفعيل"}
        </span>
      </div>
      <div className="ob">
        {c.diplomas.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {c.diplomas.map((d, i) => <span className="chip" key={i}>{d}</span>)}
          </div>
        )}
        {c.note && <div className="onb-note" style={{ marginBottom: 12 }}>📝 {c.note}</div>}
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>{dn}/{total} تم</div>
        <div className="prog"><i style={{ width: (total ? (dn / total) * 100 : 0) + "%" }} /></div>
        <div style={{ marginTop: 12 }}>
          {c.items.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>لا توجد مهام تفعيل لهذا العميل.</div>}
          {c.items.map((it) => (
            <div className={"task" + (it.done ? " done" : "")} style={{ marginBottom: 8 }} key={it.id}>
              <div className={"cb" + (it.done ? " on" : "")} onClick={() => onToggle(c.handoffId, it.id)} style={{ cursor: "pointer" }}>
                {it.done && <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tt">{it.label}</div>
                {it.done && it.by && <div className="tinfo">فعّلها: <b>{it.by}</b>{it.at ? " • " + it.at : ""}</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
          <a className="btn wa sm" style={{ textDecoration: "none" }} href={waLink(c.phone)} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z" /></svg>
          </a>
          <Link className="btn ghost sm" href={`/customers/${c.custId}`}>الملف</Link>
          {allDone && (
            <button className="btn sm" style={{ marginInlineStart: "auto" }} onClick={() => onComplete(c.handoffId)}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>
              إتمام التفعيل
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default function OnboardingCards({ cards: initial }: { cards: Card[] }) {
  const supabase = createClient();
  const [cards, setCards] = useState<Card[]>(initial);

  const toggle = useCallback(async (hid: string, iid: string) => {
    let next = false;
    setCards((cs) => cs.map((c) => {
      if (c.handoffId !== hid) return c;
      return { ...c, items: c.items.map((x) => { if (x.id !== iid) return x; next = !x.done; return { ...x, done: next }; }) };
    }));
    await supabase.from("handoff_items").update({ done: next, done_at: next ? new Date().toISOString() : null }).eq("id", iid);
  }, [supabase]);

  const complete = useCallback(async (hid: string) => {
    // اختفاء فوري من البورد
    setCards((cs) => cs.filter((c) => c.handoffId !== hid));
    await supabase.from("handoffs").update({ status: "done" }).eq("id", hid);
  }, [supabase]);

  const pend = useMemo(() => cards.filter((c) => c.status !== "done"), [cards]);

  return (
    <>
      {pend.length ? (
        <div className="onb-grid">
          {pend.map((c) => <CardView key={c.handoffId} c={c} onToggle={toggle} onComplete={complete} />)}
        </div>
      ) : (
        <div className="empty"><b>لا توجد طلبات تفعيل حالياً 🎉</b></div>
      )}
    </>
  );
}
