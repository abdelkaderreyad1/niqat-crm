"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

type Inst = { id: string; amount: number; currency: string; due: string; status: string; paidAt: string | null; shot: string | null };
type Enr = { id: string; diploma: string; status: string; free: boolean; freeReason: string; agreed: number; currency: string; installments: Inst[]; batchId?: string; batch?: string };
type Opt = { v: string; label: string };
type Addon = { id: string; name: string; type?: string; paid?: boolean };

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

export default function FinancePanel({ enrollments, customerId, meId, batchOpts = [], addons = [], handedOff = false }: { enrollments: Enr[]; customerId: string; meId: string; batchOpts?: Opt[]; addons?: Addon[]; handedOff?: boolean }) {
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

  // ===== قايمة التفعيل المنبثقة (تظهر بعد اكتمال الدفع، قبل تحويل العميل للدعم) =====
  const [actEnr, setActEnr] = useState<Enr | null>(null);
  const [actBatchId, setActBatchId] = useState("");
  const [actAddons, setActAddons] = useState<Record<string, boolean>>({});
  const [actBusy, setActBusy] = useState(false);

  function openActivation(e: Enr) {
    setActEnr(e);
    setActBatchId(e.batchId || "");
    const preset: Record<string, boolean> = {};
    addons.forEach((a) => { preset[a.id] = true; });   // كل الإضافات المدفوعة معلّمة افتراضياً
    setActAddons(preset);
  }

  async function confirmActivation() {
    if (!actEnr) return;
    setActBusy(true);
    // اسم الباتش: المربوط تلقائياً، وإلا المختار من القائمة
    const batchCode = actEnr.batch || (batchOpts.find((b) => b.v === actBatchId)?.label || "");
    const labels: string[] = [`${tr("activatePrefix")} ${actEnr.diploma}${batchCode ? " — " + batchCode : ""}`];
    addons.forEach((a) => { if (actAddons[a.id]) labels.push(`${tr("activatePrefix")} ${a.name}`); });

    // handoff موجود؟ نعيد استخدامه، وإلا ننشئ واحد جديد (pending) — من غير تغيير المرحلة هنا (نعملها بعدين)
    const { data: existingHo } = await supabase.from("handoffs").select("id").eq("customer_id", customerId).limit(1).maybeSingle();
    let hoId = (existingHo as any)?.id as string | undefined;
    if (!hoId) {
      const { data: h, error } = await supabase.from("handoffs").insert({ customer_id: customerId, created_by: meId || null, note: "", status: "pending" }).select("id").single();
      if (error || !h) { setActBusy(false); alert(tr("createHandoffFailed") + (error?.message || "")); return; }
      hoId = (h as any).id;
    } else {
      await supabase.from("handoffs").update({ status: "pending" }).eq("id", hoId);
    }
    // منع تكرار البنود
    const { data: cur } = await supabase.from("handoff_items").select("label").eq("handoff_id", hoId);
    const already = new Set(((cur as any[]) || []).map((x) => x.label));
    const rows = labels.filter((l, i) => labels.indexOf(l) === i).filter((l) => !already.has(l)).map((label) => ({ handoff_id: hoId, label, done: false }));
    if (rows.length) {
      const { error: e2 } = await supabase.from("handoff_items").insert(rows);
      if (e2) { setActBusy(false); alert(tr("addItemsFailed") + e2.message); return; }
    }
    // المرحلة → enrolled + علّم handed_off
    await supabase.from("customers").update({ stage: "enrolled", handed_off: true }).eq("id", customerId);
    await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action: "auto_handoff", detail: labels.join(" · ") });
    setActBusy(false);
    setActEnr(null);
    toast(tr("sentToActivation")); router.refresh();
  }

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
    const url = path; // نخزّن الـ path
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

    // لو الدفعة دي كمّلت المبلغ المتفق عليه → افتح قايمة التفعيل (بدل التحويل الصامت)
    if (enr && Number(enr.agreed) > 0) {
      const paidNow = enr.installments.reduce((s, i) => {
        const isPaid = i.id === id ? true : (i.status === "paid" || i.paidAt);
        return s + (isPaid ? (Number(i.amount) || 0) : 0);
      }, 0);
      if (paidNow >= Number(enr.agreed)) {
        openActivation(enr);
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
          const fullyPaid = e.free || (Number(e.agreed) > 0 && paid >= Number(e.agreed));
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

              {/* اكتمل الدفع (أو هدية) ولسه ما اتحوّلش للتفعيل → زر واضح يفتح قايمة التفعيل */}
              {fullyPaid && !handedOff && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "rgba(24,169,87,.08)", border: "1px solid var(--green)", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
                  <span style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 700 }}>✓ {tr("fullyPaidReady")}</span>
                  <button onClick={() => openActivation(e)} className="btn" style={{ marginInlineStart: "auto", height: 32, padding: "0 14px", fontSize: 12.5 }}>
                    {tr("sendToActivationBtn")}
                  </button>
                </div>
              )}
              {handedOff && fullyPaid && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>✓ {tr("alreadySentToActivation")}</div>
              )}
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

      {/* ===== مودال قايمة التفعيل ===== */}
      {actEnr && (
        <div onClick={() => !actBusy && setActEnr(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="card"
            style={{ padding: 20, width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto" }}>
            <div className="sec-t" style={{ marginBottom: 4 }}>{tr("activationChecklistTitle")}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>{tr("activationChecklistHint")}</div>

            {/* الدبلومة (ثابتة) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: "var(--brand-soft)" }}>
              <input type="checkbox" checked disabled />
              <span style={{ fontWeight: 700, color: "var(--ink)" }}>{tr("activatePrefix")} {actEnr.diploma}</span>
            </div>

            {/* الباتش: تلقائي لو مربوط، وإلا اختيار */}
            <div className="fld" style={{ marginBottom: 8 }}>
              <label>{tr("batch")}</label>
              {actEnr.batchId ? (
                <div className="inp" style={{ display: "flex", alignItems: "center", background: "var(--muted-soft)" }} dir="ltr">{actEnr.batch || "—"}</div>
              ) : (
                <select className="inp" value={actBatchId} onChange={(e) => setActBatchId(e.target.value)}>
                  <option value="">{tr("selectBatchOpt")}</option>
                  {batchOpts.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
                </select>
              )}
            </div>

            {/* الإضافات المدفوعة (اختيار اللي يتفعّل) */}
            {addons.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12.5, color: "var(--muted)", display: "block", marginBottom: 6 }}>{tr("paidAddons")}</label>
                {addons.map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginBottom: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!actAddons[a.id]} onChange={(e) => setActAddons((m) => ({ ...m, [a.id]: e.target.checked }))} />
                    <span style={{ color: "var(--ink)" }}>{tr("activatePrefix")} {a.name}</span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={confirmActivation} disabled={actBusy} className="btn" style={{ flex: 1 }}>
                {actBusy ? "..." : tr("confirmActivationBtn")}
              </button>
              <button onClick={() => setActEnr(null)} disabled={actBusy} className="btn ghost">{tr("cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
