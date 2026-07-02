"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Inst = { id: string; amount: number; currency: string; due: string; status: string; paidAt: string | null; shot: string | null };
type Enr = { id: string; diploma: string; status: string; free: boolean; freeReason: string; agreed: number; currency: string; installments: Inst[] };

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " ج");
}
const paidOf = (e: Enr) => e.installments.filter((i) => i.status === "paid" || i.paidAt).reduce((s, i) => s + (Number(i.amount) || 0), 0);
const isOverdue = (i: Inst) => !(i.status === "paid" || i.paidAt || !i.due) && new Date(i.due) < new Date(new Date().toDateString());

export default function FinancePanel({ enrollments, customerId, meId }: { enrollments: Enr[]; customerId: string; meId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [due, setDue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editAgreedId, setEditAgreedId] = useState<string | null>(null);
  const [editAgreedVal, setEditAgreedVal] = useState("");

  async function logAudit(action: string, detail: string) {
    await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action, detail });
  }
  async function uploadShot(): Promise<string | null> {
    if (!file) return null;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${customerId}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (up.error) { toast("تعذّر رفع الصورة"); return null; }
    const { data } = supabase.storage.from("receipts").getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function markPaid(id: string) {
    setBusy(id);
    const { error } = await supabase.from("installments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    setBusy(null);
    if (error) return alert("تعذّر التحديث: " + error.message);
    await logAudit("installment_paid", "تأكيد دفع قسط");
    toast("اتسجّل الدفع"); router.refresh();
  }
  async function addInstallment(e: Enr) {
    const a = Number(amt);
    if (!a || a <= 0) return alert("اكتب مبلغ صحيح.");
    setBusy("add");
    const shotUrl = await uploadShot();
    const { error } = await supabase.from("installments").insert({ enrollment_id: e.id, amount: a, currency: e.currency || "EGP", due_date: due || null, status: "pending", screenshot_url: shotUrl });
    if (error) { setBusy(null); return alert("تعذّر إضافة القسط: " + error.message); }
    await logAudit("installment_add", `إضافة قسط ${money(a, e.currency)}${shotUrl ? " + صورة تحويل" : ""}`);
    setBusy(null); setAddFor(null); setAmt(""); setDue(""); setFile(null);
    toast("اتضاف القسط"); router.refresh();
  }
  async function saveAgreed(e: Enr) {
    const amt = Number(editAgreedVal);
    if (isNaN(amt) || amt < 0) return alert("أدخل مبلغ صحيح");
    setBusy("agreed");
    const { error } = await supabase.from("enrollment_finance")
      .upsert({ enrollment_id: e.id, agreed_amount: amt, currency: e.currency || "EGP" }, { onConflict: "enrollment_id" });
    setBusy(null);
    if (error) return alert("تعذّر التحديث: " + error.message);
    await logAudit("agreed_edit", `تعديل المبلغ المتفق من ${money(e.agreed, e.currency)} إلى ${money(amt, e.currency)}`);
    setEditAgreedId(null);
    toast("تم تعديل المبلغ المتفق عليه");
    router.refresh();
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
                  <span style={{ color: "var(--muted)" }}>المتفق: {editAgreedId === e.id ? (
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <input className="inp num" style={{ width: 100, height: 32, fontSize: 13 }} value={editAgreedVal} onChange={ev => setEditAgreedVal(ev.target.value)} />
                      <button onClick={() => saveAgreed(e)} disabled={busy === "agreed"} className="btn" style={{ height: 32, padding: "0 10px", fontSize: 12 }}>حفظ</button>
                      <button onClick={() => setEditAgreedId(null)} className="btn ghost" style={{ height: 32, padding: "0 10px", fontSize: 12 }}>إلغاء</button>
                    </span>
                  ) : (
                    <b className="num" style={{ color: "var(--ink)", cursor: "pointer" }} onClick={() => { setEditAgreedId(e.id); setEditAgreedVal(String(e.agreed)); }}>{money(e.agreed, e.currency)}</b>
                  )}</span>
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
                      {i.shot && <a href={i.shot} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 700 }}>إيصال</a>}
                      {paidNow ? badge("مدفوع", "#18A957") : over ? badge("متأخر", "#E0483B") : badge("مستحق", "#94A2BB")}
                      {!paidNow ? (
                        <button onClick={() => markPaid(i.id)} disabled={busy === i.id} className="btn" style={{ height: 30, padding: "0 12px", fontSize: 12, background: "var(--green)" }}>تم الدفع</button>
                      ) : <span style={{ width: 70 }} />}
                    </div>
                  );
                })}
              </div>
              {addFor === e.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input className="inp num" style={{ width: 110 }} placeholder="المبلغ" value={amt} onChange={(ev) => setAmt(ev.target.value)} />
                    <input type="date" className="inp num" style={{ width: 150 }} value={due} onChange={(ev) => setDue(ev.target.value)} />
                  </div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--brand)", fontWeight: 700, cursor: "pointer" }}>
                    🖼️ {file ? file.name : "صورة التحويل (اختياري)"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => setFile(ev.target.files?.[0] || null)} />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => addInstallment(e)} disabled={busy === "add"} className="btn" style={{ height: 38 }}>{busy === "add" ? "جاري الحفظ..." : "حفظ"}</button>
                    <button onClick={() => { setAddFor(null); setFile(null); }} className="btn ghost" style={{ height: 38 }}>إلغاء</button>
                  </div>
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
