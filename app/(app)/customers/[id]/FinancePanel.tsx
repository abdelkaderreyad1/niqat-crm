"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Inst = { id: string; amount: number; currency: string; due: string; status: string; paidAt: string | null };
type Enr = { id: string; diploma: string; status: string; free: boolean; freeReason: string; agreed: number; currency: string; installments: Inst[] };

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " ج");
}
const paidOf = (e: Enr) => e.installments.filter((i) => i.status === "paid" || i.paidAt).reduce((s, i) => s + (Number(i.amount) || 0), 0);
const isOverdue = (i: Inst) => !(i.status === "paid" || i.paidAt || !i.due) && new Date(i.due) < new Date(new Date().toDateString());

export default function FinancePanel({ enrollments }: { enrollments: Enr[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [due, setDue] = useState("");

  async function markPaid(id: string) {
    setBusy(id);
    const { error } = await supabase.from("installments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    setBusy(null);
    if (error) return alert("تعذّر التحديث: " + error.message);
    router.refresh();
  }
  async function addInstallment(e: Enr) {
    const a = Number(amt);
    if (!a || a <= 0) return alert("اكتب مبلغ صحيح.");
    setBusy("add");
    const { error } = await supabase.from("installments").insert({ enrollment_id: e.id, amount: a, currency: e.currency || "EGP", due_date: due || null, status: "pending" });
    setBusy(null);
    if (error) return alert("تعذّر إضافة القسط: " + error.message);
    setAddFor(null); setAmt(""); setDue(""); router.refresh();
  }

  const badge = (txt: string, color: string) => (
    <span className="stg" style={{ background: color + "1a", color }}>{txt}</span>
  );

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t">المالية والأقساط 🔒</div>
      {enrollments.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد اشتراكات لهذا العميل.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {enrollments.map((e) => {
          const paid = paidOf(e);
          const remaining = (Number(e.agreed) || 0) - paid;
          return (
            <div key={e.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <b style={{ color: "var(--ink)" }}>{e.diploma}{e.free && <span style={{ color: "var(--brand)", fontSize: 12, marginInlineStart: 6 }}>🎁 هدية</span>}</b>
                <div style={{ display: "flex", gap: 12, fontSize: 12.5 }}>
                  <span style={{ color: "var(--muted)" }}>المتفق: <b className="num" style={{ color: "var(--ink)" }}>{money(e.agreed, e.currency)}</b></span>
                  <span style={{ color: "var(--green)" }}>المدفوع: <b className="num">{money(paid, e.currency)}</b></span>
                  <span style={{ color: "var(--amber)" }}>المتبقّي: <b className="num">{money(remaining, e.currency)}</b></span>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {e.installments.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>لا توجد أقساط مسجّلة.</div>}
                {e.installments.map((i) => {
                  const paidNow = i.status === "paid" || i.paidAt;
                  const over = isOverdue(i);
                  return (
                    <div key={i.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px" }}>
                      <span className="num" dir="ltr" style={{ fontWeight: 700 }}>{money(i.amount, i.currency)}</span>
                      <span className="num" dir="ltr" style={{ color: "var(--muted)", fontSize: 12 }}>{i.due || "—"}</span>
                      {paidNow ? badge("مدفوع", "#18A957") : over ? badge("متأخر", "#E0483B") : badge("مستحق", "#94A2BB")}
                      {!paidNow ? (
                        <button onClick={() => markPaid(i.id)} disabled={busy === i.id} className="btn" style={{ height: 30, padding: "0 12px", fontSize: 12, background: "var(--green)" }}>تم الدفع</button>
                      ) : <span style={{ width: 70 }} />}
                    </div>
                  );
                })}
              </div>
              {addFor === e.id ? (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input className="inp num" style={{ width: 110 }} placeholder="المبلغ" value={amt} onChange={(ev) => setAmt(ev.target.value)} />
                  <input type="date" className="inp num" style={{ width: 150 }} value={due} onChange={(ev) => setDue(ev.target.value)} />
                  <button onClick={() => addInstallment(e)} disabled={busy === "add"} className="btn" style={{ height: 38 }}>حفظ</button>
                  <button onClick={() => setAddFor(null)} className="btn ghost" style={{ height: 38 }}>إلغاء</button>
                </div>
              ) : (
                <button onClick={() => { setAddFor(e.id); setAmt(""); setDue(""); }} style={{ color: "var(--brand)", fontWeight: 700, fontSize: 12.5, marginTop: 10, background: "none" }}>+ قسط</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
