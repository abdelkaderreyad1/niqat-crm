"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import { revalidateCustomers } from "../actions";
import FileDrop from "@/lib/ui/FileDrop";

type Refund = {
  id: string; enrollmentId: string; addonId: string; amount: number; currency: string;
  reason: string; status: string; closesService: boolean; shot_url: string; at: string;
};
type Service = { kind: "enrollment" | "addon"; id: string; name: string; paid: number; currency: string; free: boolean; closed: boolean };

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " EGP");
}

const STATUS: Record<string, { labelKey: string; color: string }> = {
  requested: { labelKey: "refundRequested", color: "#E6A700" },
  refunded: { labelKey: "refundDone", color: "#2F6BFF" },
  closed: { labelKey: "refundClosed", color: "#94A2BB" },
};

export default function RefundPanel({
  customerId, refunds = [], refundServices = [], allServicesClosed = false, meId, tableMissing, accessItems = [],
}: {
  customerId: string; refunds?: Refund[]; refundServices?: Service[]; allServicesClosed?: boolean;
  meId: string; tableMissing: boolean;
  accessItems?: { id: string; label: string; done: boolean }[];
}) {
  const supabase = createClient();
  const tr = useT();
  const router = useRouter();
  const [svcKey, setSvcKey] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [reason, setReason] = useState("");
  const [closes, setCloses] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string>("");

  const openServices = refundServices.filter((s) => !s.closed);
  const svcByKey = (k: string) => refundServices.find((s) => `${s.kind}:${s.id}` === k) || null;
  const selected = svcByKey(svcKey);

  // اسم الخدمة لكل ريفند
  function svcName(r: Refund) {
    const s = refundServices.find((x) => (r.enrollmentId && x.kind === "enrollment" && x.id === r.enrollmentId) || (r.addonId && x.kind === "addon" && x.id === r.addonId));
    return s?.name || tr("refundServiceGone");
  }

  function pickService(k: string) {
    setSvcKey(k);
    const s = svcByKey(k);
    if (s) { setCurrency(s.currency || "EGP"); setAmount(s.free ? "0" : String(s.paid || "")); setCloses(!!s.free); }
  }

  async function uploadShot(): Promise<string> {
    if (!file) return "";
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${customerId}/refund-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (up.error) { toast(tr("imgUploadFailed")); return ""; }
    return path;
  }

  // فتح ريفند لخدمة
  async function request() {
    if (!selected) { toast(tr("selectRefundService")); return; }
    const a = Number(amount) || 0;
    if (a < 0) { alert(tr("enterRefundAmount")); return; }
    if (!selected.free && a <= 0) { alert(tr("enterRefundAmount")); return; }
    setBusy("req");
    const row: any = {
      customer_id: customerId, amount: a, currency, reason: reason.trim(),
      shot_url: "", status: "requested", requested_by: meId, closes_service: closes,
      enrollment_id: selected.kind === "enrollment" ? selected.id : null,
      addon_id: selected.kind === "addon" ? selected.id : null,
    };
    const { error } = await supabase.from("refunds").insert(row);
    if (!error) await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action: "refund_request", detail: `${tr("auditRefundRequest")} ${money(a, currency)} — ${selected.name}` });
    setBusy("");
    if (error) { alert(tr("logRequestFailed") + error.message); return; }
    setSvcKey(""); setAmount(""); setReason(""); setCloses(false);
    toast(tr("refundRequestLogged")); router.refresh();
  }

  // للفري: قفل الخدمة فوراً (ريفند صفر + closes)
  async function closeFreeService(s: Service) {
    setBusy("free:" + s.id);
    const { data: r, error } = await supabase.from("refunds").insert({
      customer_id: customerId, amount: 0, currency: "EGP", reason: tr("freeCloseReason"),
      shot_url: "", status: "requested", requested_by: meId, closes_service: true,
      enrollment_id: s.kind === "enrollment" ? s.id : null,
      addon_id: s.kind === "addon" ? s.id : null,
    }).select("id").single();
    if (error || !r) { setBusy(""); alert(tr("logRequestFailed") + (error?.message || "")); return; }
    // فري: نعدّي على مرحلة "refunded" مباشرة للإغلاق
    await closeService({ id: (r as any).id, enrollmentId: s.kind === "enrollment" ? s.id : "", addonId: s.kind === "addon" ? s.id : "", amount: 0, currency: "EGP", reason: "", status: "refunded", closesService: true, shot_url: "", at: "" });
    setBusy("");
  }

  // اعتماد التحويل (مع اسكرين)
  async function markRefunded(r: Refund) {
    setBusy("ref:" + r.id);
    const patch: any = { status: "refunded" };
    const u = await uploadShot(); if (u) patch.shot_url = u;
    const { error } = await supabase.from("refunds").update(patch).eq("id", r.id);
    if (!error) await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action: "refunded", detail: `${tr("refundTransferred")} — ${svcName(r)}` });
    setBusy(""); setFile(null);
    if (error) { alert(tr("updateFailed") + error.message); return; }
    toast(tr("updated")); router.refresh();
  }

  // إغلاق الخدمة: يقفل الريفند + يعلّم الخدمة (enrollment refunded / addon refunded)
  async function closeService(r: Refund) {
    setBusy("close:" + r.id);
    const { error } = await supabase.from("refunds").update({ status: "closed" }).eq("id", r.id);
    if (error) { setBusy(""); alert(tr("updateFailed") + error.message); return; }
    if (r.closesService) {
      if (r.enrollmentId) await supabase.from("enrollments").update({ status: "refunded" }).eq("id", r.enrollmentId);
      else if (r.addonId) await supabase.from("customer_addons").update({ refunded: true }).eq("id", r.addonId);
    }
    await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action: "refunded", detail: `${tr("serviceClosed")} — ${svcName(r)}` });
    setBusy("");
    await revalidateCustomers();
    toast(tr("serviceClosed")); router.refresh();
  }

  // التحويل للدعم لقفل الأكسس للخدمة دي فقط
  async function sendToSupportForClose(r: Refund) {
    setBusy("ho:" + r.id);
    const LABEL = `${tr("refundCloseAccess")} — ${svcName(r)}`;
    const { data: existingHo } = await supabase.from("handoffs").select("id").eq("customer_id", customerId).limit(1).maybeSingle();
    let hoId = (existingHo as any)?.id as string | undefined;
    if (!hoId) {
      const { data: h, error } = await supabase.from("handoffs").insert({ customer_id: customerId, created_by: meId || null, note: "", status: "pending" }).select("id").single();
      if (error || !h) { setBusy(""); alert(tr("createHandoffFailed") + (error?.message || "")); return; }
      hoId = (h as any).id;
    } else {
      await supabase.from("handoffs").update({ status: "pending" }).eq("id", hoId);
    }
    const { data: cur } = await supabase.from("handoff_items").select("label").eq("handoff_id", hoId);
    const already = new Set(((cur as any[]) || []).map((x) => x.label));
    if (!already.has(LABEL)) {
      const { error: e2 } = await supabase.from("handoff_items").insert({ handoff_id: hoId, label: LABEL, done: false });
      if (e2) { setBusy(""); alert(tr("addItemsFailed") + e2.message); return; }
    }
    await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action: "refund_handoff", detail: `${tr("refundHandoffToSupport")} — ${svcName(r)}` });
    setBusy("");
    toast(tr("sentToSupportForClose")); router.refresh();
  }

  // أرشفة العميل — تظهر فقط لما كل الخدمات مقفولة
  async function archiveCustomer() {
    setBusy("archive");
    const { error } = await supabase.from("customers").update({ archived: true }).eq("id", customerId);
    if (error) { setBusy(""); alert(tr("updateFailed") + error.message); return; }
    await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action: "refunded", detail: tr("closedArchiveBtn") });
    setBusy("");
    await revalidateCustomers();
    toast(tr("customerArchived")); router.refresh();
  }

  if (tableMissing) {
    return <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("refundSqlHint")}</div>;
  }

  return (
    <div>
      {/* ===== فتح ريفند جديد ===== */}
      {openServices.length > 0 ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink)", marginBottom: 10 }}>{tr("newRefundTitle")}</div>
          <div className="fld"><label>{tr("refundService")}</label>
            <select className="inp" value={svcKey} onChange={(e) => pickService(e.target.value)}>
              <option value="">{tr("selectRefundService")}</option>
              {openServices.map((s) => (
                <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>
                  {s.name}{s.free ? ` (${tr("freeWord")})` : ` — ${money(s.paid, s.currency)}`}
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <>
              <div className="frow">
                <div className="fld"><label>{tr("refundAmount")}</label>
                  <input className="inp num" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={selected.free} /></div>
                <div className="fld"><label>{tr("currency")}</label>
                  <select className="inp" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={selected.free}>
                    <option value="EGP">{tr("egp")}</option><option value="USD">{tr("usd")}</option>
                  </select></div>
              </div>
              {!selected.free && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink)", margin: "2px 0 10px", cursor: "pointer" }}>
                  <input type="checkbox" checked={closes} onChange={(e) => setCloses(e.target.checked)} />
                  {tr("closesServiceLabel")}
                </label>
              )}
              {!closes && !selected.free && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{tr("partialRefundHint")}</div>}
              <div className="fld"><label>{tr("refundReason")}</label>
                <textarea className="inp" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
              <button onClick={request} disabled={busy === "req"} className="btn danger">{busy === "req" ? "..." : tr("refundRequestBtn")}</button>
            </>
          )}
        </div>
      ) : refundServices.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>{tr("noRefundServices")}</div>
      ) : null}

      {/* ===== قفل خدمة مجانية بدون ريفند ===== */}
      {openServices.some((s) => s.free) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{tr("freeCloseHint")}</div>
          {openServices.filter((s) => s.free).map((s) => (
            <div key={`free:${s.id}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink)" }}>{s.name} <span className="stg" style={{ background: "var(--muted-soft)", color: "var(--muted-d)" }}>{tr("freeWord")}</span></span>
              <button onClick={() => closeFreeService(s)} disabled={busy === "free:" + s.id} className="btn ghost" style={{ fontSize: 12 }}>{busy === "free:" + s.id ? "..." : tr("closeServiceBtn")}</button>
            </div>
          ))}
        </div>
      )}

      {/* ===== قايمة كل الريفندات ===== */}
      {refunds.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink)", margin: "4px 0 8px" }}>{tr("refundsListTitle")} ({refunds.length})</div>
          {refunds.map((r) => {
            const st = STATUS[r.status] || STATUS.requested;
            const closeItem = accessItems.find((i) => i.label === `${tr("refundCloseAccess")} — ${svcName(r)}`) || null;
            return (
              <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13 }}>{svcName(r)}</span>
                  {r.closesService ? <span className="stg" style={{ background: "var(--red-soft)", color: "var(--red)" }}>{tr("fullRefundTag")}</span>
                    : <span className="stg" style={{ background: "var(--muted-soft)", color: "var(--muted-d)" }}>{tr("partialTag")}</span>}
                  <span className="stg" style={{ background: st.color + "22", color: st.color, marginInlineStart: "auto" }}>{tr(st.labelKey)}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", fontSize: 12.5, color: "var(--muted-d)", marginTop: 6 }}>
                  <span>{tr("amount")}: <b className="num" dir="ltr">{money(r.amount, r.currency)}</b></span>
                  {r.reason && <span>{tr("reason")}: {r.reason}</span>}
                  <span className="num">{r.at}</span>
                </div>
                {r.shot_url && <a href={r.shot_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)", fontWeight: 700, display: "inline-block", marginTop: 4 }}>📎 {tr("transferShot")}</a>}

                {/* إجراءات حسب الحالة */}
                <div style={{ marginTop: 8 }}>
                  {r.status === "requested" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <FileDrop style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--brand)", fontWeight: 700 }} accept="image/*" onFile={setFile}>
                        🖼️ {file ? file.name : tr("refundTransferShot")}
                      </FileDrop>
                      <button onClick={() => markRefunded(r)} disabled={busy === "ref:" + r.id} className="btn" style={{ fontSize: 12.5 }}>{busy === "ref:" + r.id ? "..." : tr("refundTransfer")}</button>
                    </div>
                  )}
                  {r.status === "refunded" && r.closesService && (
                    !closeItem ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{tr("supportWillCloseHint")}</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => sendToSupportForClose(r)} disabled={busy === "ho:" + r.id} className="btn ghost" style={{ fontSize: 12 }}>{busy === "ho:" + r.id ? "..." : tr("refundHandoffToSupport")}</button>
                          <button onClick={() => closeService(r)} disabled={busy === "close:" + r.id} className="btn danger" style={{ fontSize: 12 }}>{busy === "close:" + r.id ? "..." : tr("closeServiceBtn")}</button>
                        </div>
                      </div>
                    ) : !closeItem.done ? (
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>⏳ {tr("awaitingSupportClose")}</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 12, color: "var(--green)" }}>✓ {tr("accDone")}</div>
                        <button onClick={() => closeService(r)} disabled={busy === "close:" + r.id} className="btn danger" style={{ fontSize: 12 }}>{busy === "close:" + r.id ? "..." : tr("closeServiceBtn")}</button>
                      </div>
                    )
                  )}
                  {r.status === "refunded" && !r.closesService && (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{tr("partialDoneHint")}</div>
                  )}
                  {r.status === "closed" && (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>✓ {tr("serviceClosedDone")}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== أرشفة — فقط لو كل الخدمات مقفولة ===== */}
      {allServicesClosed && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--green)", marginBottom: 6 }}>✓ {tr("allServicesClosedHint")}</div>
          <button onClick={archiveCustomer} disabled={busy === "archive"} className="btn danger" style={{ width: "100%" }}>{busy === "archive" ? "..." : "🗄️ " + tr("closedArchiveBtn")}</button>
        </div>
      )}
      {!allServicesClosed && refundServices.some((s) => s.closed) && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--muted)" }}>{tr("someServicesActiveHint")}</div>
      )}
    </div>
  );
}
