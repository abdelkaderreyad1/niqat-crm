"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import { autoHandoffIfNeeded } from "@/lib/handoff";

type Inst = { id: string; amount: number; currency: string; due: string; status: string; paidAt: string | null; shot: string | null };
type Enr = { id: string; diploma: string; status: string; free: boolean; freeReason: string; agreed: number; currency: string; installments: Inst[] };

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " EGP");
}
const paidOf = (e: Enr) => e.installments.filter((i) => i.status === "paid" || i.paidAt).reduce((s, i) => s + (Number(i.amount) || 0), 0);
const isOverdue = (i: Inst) => !(i.status === "paid" || i.paidAt || !i.due) && new Date(i.due) < new Date(new Date().toDateString());
// استنتاج نوع الدفع: كاش = قسط واحد مدفوع بالكامل | تقسيط = أكتر من قسط
function payMode(e: Enr): "cash" | "installment" | "none" {
  const n = e.installments.length;
  if (n === 0) return "none";
  const allPaid = e.installments.every((i) => i.status === "paid" || i.paidAt);
  if (n === 1 && allPaid) return "cash";
  return "installment";
}

export default function FinancePanel({ enrollments, customerId, meId }: { enrollments: Enr[]; customerId: string; meId: string }) {
  const tr = useT();
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [due, setDue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payFile, setPayFile] = useState<File | null>(null);
  const [editAgreedId, setEditAgreedId] = useState<string | null>(null);
  const [editAgreedVal, setEditAgreedVal] = useState("");

  async function logAudit(action: string, detail: string) {
    await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action, detail });
  }
  async function uploadShot(f?: File | null, label?: string): Promise<string | null> {
    const theFile = f ?? file;
    if (!theFile) return null;
    const ext = (theFile.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${customerId}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("receipts").upload(path, theFile, { upsert: false });
    if (up.error) { toast(tr("imgUploadFailed")); return null; }
    const url = supabase.storage.from("receipts").getPublicUrl(path).data?.publicUrl || null;
    // تسجيل نسخة في المستندات عشان تظهر في سكشن المستندات
    if (url) await supabase.from("customer_docs").insert({ customer_id: customerId, url, name: label || `${tr("instReceipt")} (${theFile.name})` });
    return url;
  }

  async function markPaid(id: string, f?: File | null, enr?: Enr) {
    setBusy(id);
    let shotUrl: string | null = null;
    if (f) shotUrl = await uploadShot(f, `${tr("instReceipt")} (${f.name})`);
    const patch: any = { status: "paid", paid_at: new Date().toISOString() };
    if (shotUrl) patch.screenshot_url = shotUrl;
    const { error } = await supabase.from("installments").update(patch).eq("id", id);
    if (error) { setBusy(null); return alert(tr("updateFailed") + error.message); }
    await logAudit("installment_paid", tr("auditInstallmentPaid") + (shotUrl ? " + " + tr("receipt") : ""));

    // شبكة الأمان: لو الدفعة دي كمّلت المبلغ المتفق عليه → تحويل تلقائي للدعم
    if (enr && Number(enr.agreed) > 0) {
      const paidNow = enr.installments.reduce((s, i) => {
        const isPaid = i.id === id ? true : (i.status === "paid" || i.paidAt);
        return s + (isPaid ? (Number(i.amount) || 0) : 0);
      }, 0);
      if (paidNow >= Number(enr.agreed)) {
        try { await autoHandoffIfNeeded(supabase, customerId, meId); } catch {}
      }
    }

    setBusy(null);
    setPayFor(null); setPayFile(null);
    toast(tr("paymentLogged")); router.refresh();
  }
  async function addInstallment(e: Enr) {
    const a = Number(amt);
    if (!a || a <= 0) return alert(tr("enterValidAmount"));
    setBusy("add");
    const shotUrl = await uploadShot();
    const { error } = await supabase.from("installments").insert({ enrollment_id: e.id, amount: a, currency: e.currency || "EGP", due_date: due || null, status: "pending", screenshot_url: shotUrl });
    if (error) { setBusy(null); return alert(tr("addInstallmentFailed") + error.message); }
    await logAudit("installment_add", `${tr("auditInstallmentAdd")} ${money(a, e.currency)}${shotUrl ? " + " + tr("transferShot") : ""}`);
    setBusy(null); setAddFor(null); setAmt(""); setDue(""); setFile(null);
    toast(tr("installmentAdded")); router.refresh();
  }
  async function saveAgreed(e: Enr) {
    const amt = Number(editAgreedVal);
    if (isNaN(amt) || amt < 0) return alert(tr("enterValidAmount"));
    setBusy("agreed");
    const { error } = await supabase.from("enrollment_finance")
      .upsert({ enrollment_id: e.id, agreed_amount: amt, currency: e.currency || "EGP" }, { onConflict: "enrollment_id" });
    setBusy(null);
    if (error) return alert(tr("updateFailed") + error.message);
    await logAudit("agreed_edit", `${tr("agreedAmountUpdated")}: ${money(e.agreed, e.currency)} → ${money(amt, e.currency)}`);
    setEditAgreedId(null);
    toast(tr("agreedAmountUpdated"));
    router.refresh();
  }

  const badge = (txt: string, color: string) => (
    <span className="stg" style={{ background: color + "1a", color }}>{txt}</span>
  );

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t">{tr("financeAndInstallments")}</div>
      {enrollments.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noEnrolls")}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {enrollments.map((e) => {
          const paid = paidOf(e);
          const remaining = (Number(e.agreed) || 0) - paid;
          const mode = payMode(e);
          const instTotal = e.installments.length;
          const instPaid = e.installments.filter((i) => i.status === "paid" || i.paidAt).length;
          return (
            <div key={e.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <b style={{ color: "var(--ink)" }}>{e.diploma}
                  {e.free && <span style={{ color: "var(--brand)", fontSize: 12, marginInlineStart: 6 }}>🎁 {tr("gift")}</span>}
                  {!e.free && mode === "cash" && <span style={{ color: "var(--green)", fontSize: 11.5, marginInlineStart: 6, fontWeight: 700 }}>💵 {tr("cashBadge")}</span>}
                  {!e.free && mode === "installment" && <span style={{ color: "var(--amber)", fontSize: 11.5, marginInlineStart: 6, fontWeight: 700 }}>🗓️ {tr("installmentBadge")} ({instPaid}/{instTotal})</span>}
                </b>
                <div style={{ display: "flex", gap: 12, fontSize: 12.5 }}>
                  <span style={{ color: "var(--muted)" }}>{tr("agreed")}: {editAgreedId === e.id ? (
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <input className="inp num" style={{ width: 100, height: 32, fontSize: 13 }} value={editAgreedVal} onChange={ev => setEditAgreedVal(ev.target.value)} />
                      <button onClick={() => saveAgreed(e)} disabled={busy === "agreed"} className="btn" style={{ height: 32, padding: "0 10px", fontSize: 12 }}>{tr("save")}</button>
                      <button onClick={() => setEditAgreedId(null)} className="btn ghost" style={{ height: 32, padding: "0 10px", fontSize: 12 }}>{tr("cancel")}</button>
                    </span>
                  ) : (
                    <b className="num" style={{ color: "var(--ink)", cursor: "pointer" }} onClick={() => { setEditAgreedId(e.id); setEditAgreedVal(String(e.agreed)); }}>{money(e.agreed, e.currency)}</b>
                  )}</span>
                  <span style={{ color: "var(--green)" }}>{tr("paid")}: <b className="num">{money(paid, e.currency)}</b></span>
                  <span style={{ color: "var(--amber)" }}>{tr("remaining")}: <b className="num">{money(remaining, e.currency)}</b></span>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {e.installments.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{tr("noInstallments")}</div>}
                {e.installments.map((i) => {
                  const paidNow = i.status === "paid" || i.paidAt;
                  const over = isOverdue(i);
                  return (
                    <div key={i.id} style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px" }}>
                     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span className="num" dir="ltr" style={{ fontWeight: 700 }}>{money(i.amount, i.currency)}</span>
                      <span className="num" dir="ltr" style={{ color: "var(--muted)", fontSize: 12 }}>{i.due || "—"}</span>
                      {i.shot && <a href={i.shot} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 700 }}>{tr("receipt")}</a>}
                      {paidNow ? badge(tr("paid"), "#18A957") : over ? badge(tr("overdue"), "#E0483B") : badge(tr("pending"), "#94A2BB")}
                      {!paidNow ? (
                        <button onClick={() => { setPayFor(payFor === i.id ? null : i.id); setPayFile(null); }} disabled={busy === i.id} className="btn" style={{ height: 30, padding: "0 12px", fontSize: 12, background: "var(--green)" }}>{tr("paid")}</button>
                      ) : <span style={{ width: 70 }} />}
                     </div>
                     {payFor === i.id && !paidNow && (
                       <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, borderTop: "1px dashed var(--line)", paddingTop: 8 }}>
                         <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--brand)", fontWeight: 700, cursor: "pointer" }}>
                           🖼️ {payFile ? payFile.name : tr("uploadReceiptOpt")}
                           <input type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => setPayFile(ev.target.files?.[0] || null)} />
                         </label>
                         <button onClick={() => markPaid(i.id, payFile, e)} disabled={busy === i.id} className="btn" style={{ height: 30, padding: "0 12px", fontSize: 12, background: "var(--green)" }}>{busy === i.id ? "..." : tr("confirmPayment")}</button>
                         <button onClick={() => { setPayFor(null); setPayFile(null); }} className="btn ghost" style={{ height: 30, padding: "0 10px", fontSize: 12 }}>{tr("cancel")}</button>
                       </div>
                     )}
                    </div>
                  );
                })}
              </div>
              {addFor === e.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input className="inp num" style={{ width: 110 }} placeholder={tr("instAmount")} value={amt} onChange={(ev) => setAmt(ev.target.value)} />
                    <input type="date" className="inp num" style={{ width: 150 }} value={due} onChange={(ev) => setDue(ev.target.value)} />
                  </div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--brand)", fontWeight: 700, cursor: "pointer" }}>
                    🖼️ {file ? file.name : tr("addShot")}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => setFile(ev.target.files?.[0] || null)} />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => addInstallment(e)} disabled={busy === "add"} className="btn" style={{ height: 38 }}>{busy === "add" ? tr("saving") : tr("save")}</button>
                    <button onClick={() => { setAddFor(null); setFile(null); }} className="btn ghost" style={{ height: 38 }}>{tr("cancel")}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAddFor(e.id); setAmt(""); setDue(""); }} style={{ color: "var(--brand)", fontWeight: 700, fontSize: 12.5, marginTop: 10, background: "none" }}>{tr("addInst")}</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
