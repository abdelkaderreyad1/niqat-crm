"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Refund = {
  id: string; amount: number; currency: string; reason: string;
  shot_url: string; status: string; created_at: string;
} | null;

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " ج");
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  requested: { label: "في انتظار الريفند", color: "#B8860B", bg: "#FEF6E0" },
  refunded: { label: "تم الريفند — بانتظار إغلاق الأكسس", color: "#2F6BFF", bg: "#E8F0FF" },
  closed: { label: "مؤرشف (تم الإغلاق)", color: "#94A2BB", bg: "#EEF1F6" },
};

export default function RefundPanel({
  customerId, refund, meId, tableMissing,
}: {
  customerId: string; refund: Refund; meId: string; tableMissing: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [reason, setReason] = useState("");
  const [shot, setShot] = useState("");
  const [busy, setBusy] = useState(false);

  async function request() {
    const a = Number(amount) || 0;
    if (a <= 0) { alert("اكتب مبلغ الاسترداد."); return; }
    setBusy(true);
    const { error } = await supabase.from("refunds").insert({
      customer_id: customerId, amount: a, currency, reason: reason.trim(),
      shot_url: shot.trim(), status: "requested", requested_by: meId,
    });
    setBusy(false);
    if (error) { alert("تعذّر تسجيل الطلب: " + error.message); return; }
    setAmount(""); setReason(""); setShot("");
    router.refresh();
  }

  async function setStatus(status: string, archive = false) {
    if (!refund) return;
    setBusy(true);
    const { error } = await supabase.from("refunds").update({ status }).eq("id", refund.id);
    if (!error && archive) await supabase.from("customers").update({ archived: true }).eq("id", customerId);
    setBusy(false);
    if (error) { alert("تعذّر التحديث: " + error.message); return; }
    router.refresh();
  }

  if (tableMissing) {
    return (
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="sec-t">الاسترداد (Refund)</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          جدول الاسترداد لسه مش متعمل في قاعدة البيانات. شغّل SQL الـ refunds مرة واحدة في Supabase وهيشتغل.
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="sec-t" style={{ margin: 0 }}>الاسترداد (Refund)</div>
        {refund && (
          <span className="stg" style={{ background: STATUS[refund.status]?.bg, color: STATUS[refund.status]?.color }}>
            {STATUS[refund.status]?.label || refund.status}
          </span>
        )}
      </div>

      {!refund ? (
        <div style={{ marginTop: 10 }}>
          <div className="frow">
            <div className="fld"><label>مبلغ الاسترداد</label>
              <input className="inp num" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="fld"><label>العملة</label>
              <select className="inp" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="EGP">جنيه</option><option value="USD">دولار</option>
              </select></div>
          </div>
          <div className="fld"><label>سبب الاسترداد</label>
            <textarea className="inp" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="fld"><label>رابط صورة تحويل الاسترداد (اختياري)</label>
            <input className="inp num" dir="ltr" value={shot} onChange={(e) => setShot(e.target.value)} placeholder="https://…" /></div>
          <button onClick={request} disabled={busy} className="btn danger">{busy ? "..." : "طلب ريفند"}</button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", fontSize: 13.5, color: "var(--ink)", marginBottom: 10 }}>
            <span>المبلغ: <b className="num" dir="ltr">{money(refund.amount, refund.currency)}</b></span>
            {refund.reason && <span>السبب: {refund.reason}</span>}
          </div>
          {refund.shot_url && (
            <a href={refund.shot_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--brand)", fontWeight: 700 }}>📎 صورة التحويل</a>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {refund.status === "requested" && (
              <button onClick={() => setStatus("refunded")} disabled={busy} className="btn">تم الريفند</button>
            )}
            {refund.status === "refunded" && (
              <button onClick={() => setStatus("closed", true)} disabled={busy} className="btn ghost">أغلق الأكسس وأرشفة العميل</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
