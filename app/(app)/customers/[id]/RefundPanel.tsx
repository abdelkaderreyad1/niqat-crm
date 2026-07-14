"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

type Refund = { id: string; amount: number; currency: string; reason: string; shot_url: string; status: string; created_at: string } | null;

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " EGP");
}

const STATUS: Record<string, { labelKey: string; color: string; bg: string }> = {
  requested: { labelKey: "refundRequested", color: "#E6A700", bg: "#FFF6E0" },
  refunded: { labelKey: "refundDone", color: "#2F6BFF", bg: "#E8F0FF" },
  closed: { labelKey: "refundClosed", color: "#94A2BB", bg: "#EEF1F6" },
};

export default function RefundPanel({
  customerId, refund, meId, tableMissing,
}: {
  customerId: string; refund: Refund; meId: string; tableMissing: boolean;
}) {
  const supabase = createClient();
  const tr = useT();
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
    if (up.error) { toast(tr("imgUploadFailed")); return ""; }
    return path; // نخزّن الـ path
  }

  async function request() {
    const a = Number(amount) || 0;
    if (a <= 0) { alert(tr("enterRefundAmount")); return; }
    setBusy(true);
    const { error } = await supabase.from("refunds").insert({
      customer_id: customerId, amount: a, currency, reason: reason.trim(),
      shot_url: "", status: "requested", requested_by: meId,
    });
    if (!error) await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action: "refund_request", detail: `${tr("auditRefundRequest")} ${money(a, currency)}` });
    setBusy(false);
    if (error) { alert(tr("logRequestFailed") + error.message); return; }
    setAmount(""); setReason("");
    toast(tr("refundRequestLogged")); router.refresh();
  }

  async function setStatus(status: string, archive = false, withShot = false) {
    if (!refund) return;
    setBusy(true);
    const patch: any = { status };
    if (withShot) { const u = await uploadShot(); if (u) patch.shot_url = u; }
    const { error } = await supabase.from("refunds").update(patch).eq("id", refund.id);
    if (!error && archive) await supabase.from("customers").update({ archived: true }).eq("id", customerId);
    if (!error) await supabase.from("audit_log").insert({
      customer_id: customerId, actor_id: meId || null,
      action: archive ? "refunded" : "refund_request",
      detail: status === "refunded" ? tr("refundTransferred") : status === "closed" ? tr("closeAndArchive") : status,
    });
    setBusy(false);
    if (error) { alert(tr("updateFailed") + error.message); return; }
    toast(tr("updated")); router.refresh();
  }

  // الخيار (أ): بدل الأرشفة المباشرة، نحوّل للدعم لقفل الأكسس.
  // مانستخدمش autoHandoffIfNeeded عشان مايغيّرش المرحلة لـ enrolled. الدعم هو اللي يأرشف بعد القفل.
  async function sendToSupportForClose() {
    if (!refund) return;
    setBusy(true);
    const LABEL = "قفل الأكسس (ريفند)";
    // نعيد استخدام handoff مفتوح لو موجود، وإلا ننشئ واحد جديد (pending)
    const { data: existingHo } = await supabase
      .from("handoffs").select("id").eq("customer_id", customerId).limit(1).maybeSingle();
    let hoId = (existingHo as any)?.id as string | undefined;
    if (!hoId) {
      const { data: h, error } = await supabase.from("handoffs")
        .insert({ customer_id: customerId, created_by: meId || null, note: "", status: "pending" })
        .select("id").single();
      if (error || !h) { setBusy(false); alert(tr("createHandoffFailed") + (error?.message || "")); return; }
      hoId = (h as any).id;
    } else {
      await supabase.from("handoffs").update({ status: "pending" }).eq("id", hoId);
    }
    // منع تكرار نفس البند داخل الـ handoff
    const { data: cur } = await supabase.from("handoff_items").select("label").eq("handoff_id", hoId);
    const already = new Set(((cur as any[]) || []).map((x) => x.label));
    if (!already.has(LABEL)) {
      const { error: e2 } = await supabase.from("handoff_items").insert({ handoff_id: hoId, label: LABEL, done: false });
      if (e2) { setBusy(false); alert(tr("addItemsFailed") + e2.message); return; }
    }
    await supabase.from("audit_log").insert({
      customer_id: customerId, actor_id: meId || null,
      action: "refund_handoff", detail: tr("refundHandoffToSupport"),
    });
    setBusy(false);
    toast(tr("sentToSupportForClose")); router.refresh();
  }

  if (tableMissing) {
    return (
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="sec-t">{tr("refundTitle")}</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          {tr("refundSqlHint")}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="sec-t" style={{ margin: 0 }}>{tr("refundTitle")}</div>
        {refund && (
          <span className="stg" style={{ background: (STATUS[refund.status]?.color || "#94A2BB") + "22", color: STATUS[refund.status]?.color }}>
            {STATUS[refund.status]?.labelKey ? tr(STATUS[refund.status].labelKey) : refund.status}
          </span>
        )}
      </div>

      {!refund ? (
        <div style={{ marginTop: 10 }}>
          <div className="frow">
            <div className="fld"><label>{tr("refundAmount")}</label>
              <input className="inp num" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="fld"><label>{tr("currency")}</label>
              <select className="inp" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="EGP">{tr("egp")}</option><option value="USD">{tr("usd")}</option>
              </select></div>
          </div>
          <div className="fld"><label>{tr("refundReason")}</label>
            <textarea className="inp" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <button onClick={request} disabled={busy} className="btn danger">{busy ? "..." : tr("refundRequestBtn")}</button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", fontSize: 13.5, color: "var(--ink)", marginBottom: 10 }}>
            <span>{tr("amount")}: <b className="num" dir="ltr">{money(refund.amount, refund.currency)}</b></span>
            {refund.reason && <span>{tr("reason")}: {refund.reason}</span>}
          </div>
          {refund.shot_url && (
            <a href={refund.shot_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--brand)", fontWeight: 700 }}>📎 {tr("transferShot")}</a>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {refund.status === "requested" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{tr("awaitTransfer")}</div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--brand)", fontWeight: 700, cursor: "pointer" }}>
                  🖼️ {file ? file.name : tr("refundTransferShot")}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                <button onClick={() => setStatus("refunded", false, true)} disabled={busy} className="btn">{busy ? "..." : tr("refundTransfer")}</button>
              </div>
            )}
            {refund.status === "refunded" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{tr("supportWillCloseHint")}</div>
                <button onClick={sendToSupportForClose} disabled={busy} className="btn">{busy ? "..." : tr("refundHandoffToSupport")}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
