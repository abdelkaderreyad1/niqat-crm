"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Opt = { v: string; label: string };
type Enr = { id: string; diploma: string; batch: string; diplomaId: string; batchId: string };

export default function SubscriptionsPanel({
  customerId, meId, enrolls, dipOpts, batchOpts, canFinance,
}: {
  customerId: string; meId: string; enrolls: Enr[];
  dipOpts: Opt[]; batchOpts: Opt[]; canFinance: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [adding, setAdding] = useState(false);
  const [nd, setNd] = useState({ dip: "", batch: "", amount: "", currency: "EGP" });

  const batchLabel = (id: string) => batchOpts.find((b) => b.v === id)?.label || "—";

  async function logAudit(action: string, detail: string) {
    await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action, detail });
  }

  // نقل بين الباتشات
  async function doMove(e: Enr) {
    if (!moveTo || moveTo === e.batchId) { setMoveFor(null); return; }
    setBusy(true);
    const { error } = await supabase.from("enrollments").update({ batch_id: moveTo }).eq("id", e.id);
    if (error) { setBusy(false); toast("تعذّر النقل"); return; }
    await logAudit("batch_transfer", `${e.diploma}: نقل من ${e.batch} إلى ${batchLabel(moveTo)}`);
    setBusy(false); setMoveFor(null); setMoveTo("");
    toast("تم النقل"); router.refresh();
  }

  // إضافة دبلومة/اشتراك جديد
  async function addDiploma() {
    if (!nd.dip) { toast("اختر الدبلومة"); return; }
    setBusy(true);
    const { data: ins, error } = await supabase.from("enrollments")
      .insert({ customer_id: customerId, diploma_id: nd.dip, batch_id: nd.batch || null, status: "active" })
      .select("id").maybeSingle();
    if (error || !ins) { setBusy(false); toast("تعذّر إضافة الدبلومة"); return; }
    if (canFinance && Number(nd.amount) > 0) {
      await supabase.from("enrollment_finance").insert({ enrollment_id: ins.id, agreed_amount: Number(nd.amount), currency: nd.currency });
    }
    const dipName = dipOpts.find((d) => d.v === nd.dip)?.label || "دبلومة";
    await logAudit("enrollment_add", `إضافة اشتراك: ${dipName}${nd.batch ? " — " + batchLabel(nd.batch) : ""}`);
    setBusy(false); setAdding(false); setNd({ dip: "", batch: "", amount: "", currency: "EGP" });
    toast("اتضافت الدبلومة"); router.refresh();
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>الاشتراكات (الدبلومة / الباتش)</span>
        <button onClick={() => { setAdding((v) => !v); setNd({ dip: "", batch: "", amount: "", currency: "EGP" }); }}
          className={adding ? "btn ghost" : "btn"} style={{ height: 34, padding: "0 14px", fontSize: 13 }}>
          {adding ? "إغلاق" : "＋ إضافة دبلومة"}
        </button>
      </div>

      {adding && (
        <div style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 10, padding: 12, marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <select className="inp" style={{ height: 38 }} value={nd.dip} onChange={(e) => setNd((s) => ({ ...s, dip: e.target.value }))}>
            <option value="">اختر الدبلومة</option>
            {dipOpts.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
          </select>
          <select className="inp" style={{ height: 38 }} value={nd.batch} onChange={(e) => setNd((s) => ({ ...s, batch: e.target.value }))}>
            <option value="">بدون باتش</option>
            {batchOpts.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
          </select>
          {canFinance && (
            <div style={{ display: "flex", gap: 8 }}>
              <input className="inp num" dir="ltr" placeholder="المبلغ المتفق" style={{ flex: 1 }} value={nd.amount} onChange={(e) => setNd((s) => ({ ...s, amount: e.target.value }))} />
              <select className="inp" style={{ width: 80, height: 40 }} value={nd.currency} onChange={(e) => setNd((s) => ({ ...s, currency: e.target.value }))}>
                <option value="EGP">ج</option><option value="USD">$</option>
              </select>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={addDiploma} disabled={busy} style={{ height: 38 }}>{busy ? "..." : "حفظ"}</button>
            <button className="btn ghost" onClick={() => setAdding(false)} style={{ height: 38 }}>إلغاء</button>
          </div>
        </div>
      )}

      {enrolls.length === 0 && !adding ? (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد اشتراكات.</div>
      ) : enrolls.map((e) => (
        <div key={e.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <b style={{ color: "var(--ink)" }}>{e.diploma}</b>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>باتش: <span className="num">{e.batch}</span></span>
              <button onClick={() => { setMoveFor(moveFor === e.id ? null : e.id); setMoveTo(e.batchId); }}
                style={{ color: "var(--brand)", fontWeight: 700, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>
                نقل
              </button>
            </div>
          </div>
          {moveFor === e.id && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <select className="inp" style={{ flex: 1, height: 36 }} value={moveTo} onChange={(ev) => setMoveTo(ev.target.value)}>
                {batchOpts.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
              </select>
              <button className="btn" onClick={() => doMove(e)} disabled={busy} style={{ height: 36, padding: "0 14px" }}>{busy ? "..." : "نقل"}</button>
              <button className="btn ghost" onClick={() => setMoveFor(null)} style={{ height: 36, padding: "0 12px" }}>إلغاء</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
