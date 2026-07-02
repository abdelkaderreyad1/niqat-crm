"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Refund = { id: string; amount: number; currency: string; reason: string; shot_url: string; status: string; created_at: string } | null;

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " ج");
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  requested: { label: "طلب ريفند — منتظر التحويل", color: "#E6A700", bg: "#FFF6E0" },
  refunded: { label: "تم الريفند — بانتظار إغلاق الأكسس", color: "#2F6BFF", bg: "#E8F0FF" },
  closed: { label: "مؤرشف (تم الإغلاق)", color: "#94A2BB", bg: "#EEF1F6" },
};

export default function RefundPanel({
  customerId, refund, meId, tableMissing,
}: {
  customerId: string; refund: Refund; meId: string; tableMissing: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadShot(): Promise<string> {
    if (!file) return "";
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${customerId}/refund-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (up.error) { toast("تعذّر رفع الصورة"); return ""; }
    return supabase.storage.from("receipts").getPublicUrl(path).data?.publicUrl || "";
  }

  async function request() {
    const a = Number(amount) || 0;
    if (a <= 0) { alert("اكتب مبلغ الاسترداد."); return; }
    setBusy(true);
    const { data: rf, error } = await supabase.from("refunds").insert({
      customer_id: customerId, reason: reason.trim(),
      status: "requested", requested_by: meId,
    }).select("id").single();
    if (!error && rf) {
      await supabase.from("refund_finance").insert({ refund_id: rf.id, amount: a, currency });
      await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action: "refund_request", detail: "طلب استرداد" });
    }
    setBusy(false);
    if (error) { alert("تعذّر تسجيل الطلب: " + error.message); return; }
    setAmount(""); setReason("");
    toast("اتسجّل طلب الريفند"); router.refresh();
  }

  async function setStatus(status: string, archive = false, withShot = false) {
    if (!refund) return;
    setBusy(true);
    if (withShot) { const u = await uploadShot(); if (u) await supabase.from("refund_finance").update({ shot_url: u }).eq("refund_id", refund.id); }
    const { error } = await supabase.from("refunds").update({ status }).eq("id", refund.id);
    if (!error && archive) await supabase.from("customers").update({ archived: true }).eq("id", customerId);
    if (!error) await supabase.from("audit_log").insert({
      customer_id: customerId, actor_id: meId || null,
      action: archive ? "refunded" : "refund_request",
      detail: status === "refunded" ? "تم تحويل الاسترداد" : status === "closed" ? "قفل الأكسس وأرشفة العميل" : status,
    });
    setBusy(false);
    if (error) { alert("تعذّر التحديث: " + error.message); return; }
    toast("اتحدّث"); router.refresh();
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>منتظر التحويل (أول 10 أيام بالشهر). بعد التحويل ارفع السكرين وعلّم تم.</div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--brand)", fontWeight: 700, cursor: "pointer" }}>
                  🖼️ {file ? file.name : "صورة تحويل الاسترداد"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                <button onClick={() => setStatus("refunded", false, true)} disabled={busy} className="btn">{busy ? "..." : "تم التحويل + رفع السكرين"}</button>
              </div>
            )}
            {refund.status === "refunded" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>الدعم: اقفل الأكسس من «التفعيل والاعتمادات» ثم اضغط أرشفة.</div>
                <button onClick={() => setStatus("closed", true)} disabled={busy} className="btn ghost">تم قفل الأكسس — أرشفة العميل</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
