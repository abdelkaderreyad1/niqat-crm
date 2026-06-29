"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type FU = { id: string; due_at: string; note: string; done: boolean };

function fmt(d: string) {
  try { return new Date(d).toLocaleString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

export default function FollowUpPanel({
  customerId, meId, open, history,
}: {
  customerId: string; meId: string; open: FU | null; history: FU[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function setFollowUp() {
    if (!date) { alert("اختر تاريخ المتابعة."); return; }
    setBusy(true);
    const { error } = await supabase.from("follow_ups").insert({
      customer_id: customerId, owner_id: meId, due_at: new Date(date).toISOString(), note: note.trim(), done: false,
    });
    setBusy(false);
    if (error) { alert("تعذّر الحفظ: " + error.message); return; }
    setDate(""); setNote("");
    router.refresh();
  }

  async function markDone(id: string) {
    setBusy(true);
    const { error } = await supabase.from("follow_ups").update({ done: true }).eq("id", id);
    setBusy(false);
    if (error) { alert("تعذّر التحديث: " + error.message); return; }
    router.refresh();
  }

  const overdue = open && new Date(open.due_at) < new Date();

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t">موعد المتابعة</div>

      {open && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginBottom: 10,
          background: overdue ? "#FDECEA" : "rgba(240,138,36,.07)",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: overdue ? "#E0483B" : "var(--ink)" }}>
              {overdue ? "⏰ متأخرة — " : "📅 "}<span className="num">{fmt(open.due_at)}</span>
            </div>
            {open.note && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{open.note}</div>}
          </div>
          <button onClick={() => markDone(open.id)} disabled={busy} className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 13, flexShrink: 0 }}>تمّت</button>
        </div>
      )}

      <div className="frow">
        <div className="fld"><label>تاريخ ووقت المتابعة</label>
          <input className="inp num" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="fld"><label>ملاحظة</label>
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" /></div>
      </div>
      <button onClick={setFollowUp} disabled={busy} className="btn">{busy ? "..." : (open ? "تحديد موعد جديد" : "تحديد موعد متابعة")}</button>

      {history.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>متابعات سابقة</div>
          {history.map((h) => (
            <div key={h.id} style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span className="num">{fmt(h.due_at)}</span>
              <span style={{ color: "var(--green)" }}>تمّت ✓</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
