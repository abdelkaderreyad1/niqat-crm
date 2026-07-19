"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import FileDrop from "@/lib/ui/FileDrop";

type Opt = { v: string; label: string; price?: number; currency?: string; price_egp?: number; price_usd?: number };
type Enr = { id: string; diploma: string; batch: string; diplomaId: string; batchId: string };
type Addon = { id: string; type: string; name: string; amount: number; free: boolean; note: string; paid: boolean; shot_url?: string };

const SV_TYPES = [
  { key: "diploma", labelKey: "svTypeDiploma", color: "#F08A24", icon: "📜" },
  { key: "accred", labelKey: "svTypeAccred", color: "#7B61FF", icon: "✅" },
  { key: "project", labelKey: "svTypeProject", color: "#0FA3A3", icon: "📋" },
  { key: "library", labelKey: "svTypeLibrary", color: "#E6A700", icon: "📚" },
];
const stMeta = (k: string) => SV_TYPES.find((t) => t.key === k) || SV_TYPES[0];

export default function ServicesPanel({
  customerId, meId, enrolls, dipOpts, batchOpts, addons, accreditations, projects, libraries, canFinance,
}: {
  customerId: string; meId: string; enrolls: Enr[];
  dipOpts: Opt[]; batchOpts: Opt[]; addons: Addon[];
  accreditations: string[]; projects: string[]; libraries: string[]; canFinance: boolean;
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [svType, setSvType] = useState("diploma");
  const [svDip, setSvDip] = useState("");
  const [svBatch, setSvBatch] = useState("");
  const [svName, setSvName] = useState("");
  const [svAmount, setSvAmount] = useState("");
  const [svCurrency, setSvCurrency] = useState("EGP");
  const [svFree, setSvFree] = useState(false);
  const [svNote, setSvNote] = useState("");
  const [svPaid, setSvPaid] = useState(false);
  const [svNeedsAct, setSvNeedsAct] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [moveFee, setMoveFee] = useState("");
  const [moveCur, setMoveCur] = useState("EGP");
  const [moveGift, setMoveGift] = useState(false);
  const [moveFile, setMoveFile] = useState<File | null>(null);

  const svNames = svType === "diploma" ? dipOpts : svType === "accred" ? accreditations.map((n) => ({ v: n, label: n })) : svType === "project" ? projects.map((n) => ({ v: n, label: n })) : libraries.map((n) => ({ v: n, label: n }));
  const batchLabel = (id: string) => batchOpts.find((b) => b.v === id)?.label || "—";

  // بند 5: ملء المبلغ تلقائياً من سعر الباتش بالعملة المختارة (قابل للتعديل)
  useEffect(() => {
    if (!svBatch) return;
    const b = batchOpts.find((x) => x.v === svBatch);
    if (!b) return;
    const p = svCurrency === "USD" ? Number(b.price_usd) : Number(b.price_egp);
    if (p > 0) setSvAmount(String(p));
  }, [svBatch, svCurrency]);

  async function logAudit(action: string, detail: string) {
    await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action, detail });
  }

  async function uploadShot(): Promise<string> {
    if (!file) return "";
    const path = `services/${customerId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (up.error) { toast(tr("screenshotUploadFailed")); return ""; }
    const url = path; // نخزّن الـ path
    await supabase.from("customer_docs").insert({ customer_id: customerId, url, name: `${tr("svPaymentProof")} — (${file.name})` });
    return url;
  }

  async function addService() {
    if (svType === "diploma" && !svDip) { toast(tr("selectDiploma")); return; }
    if (svType !== "diploma" && !svName) { toast(tr("selectItem")); return; }
    setBusy(true);
    const shot_url = svPaid && file ? await uploadShot() : "";
    const amt = svFree ? 0 : Number(svAmount) || 0;
    const label = svType === "diploma" ? (dipOpts.find((d) => d.v === svDip)?.label || "—") : svName;

    if (svType === "diploma") {
      const { data: ins, error } = await supabase.from("enrollments")
        .insert({ customer_id: customerId, diploma_id: svDip, batch_id: svBatch || null, status: "active", needs_activation: svNeedsAct })
        .select("id").maybeSingle();
      if (error || !ins) { setBusy(false); toast(tr("addDiplomaFailed")); return; }
      if (canFinance && amt > 0) {
        await supabase.from("enrollment_finance").insert({ enrollment_id: ins.id, agreed_amount: amt, currency: svCurrency, screenshot_url: shot_url || null });
      }
      await logAudit("enrollment_add", `${tr("auditEnrollmentAdd")}: ${label}${svBatch ? " — " + batchLabel(svBatch) : ""}`);
    } else {
      const { data, error } = await supabase.from("customer_addons").insert({
        customer_id: customerId, type: svType, name: label, amount: amt, free: svFree, note: svNote.trim(), paid: svPaid, shot_url: shot_url || null, needs_activation: svNeedsAct,
      }).select("id").single();
      if (error) { setBusy(false); toast(tr("addFailed") + error.message); return; }
      await logAudit("addon_add", `${tr("auditAddonAdd")} ${tr(stMeta(svType).labelKey)}: ${label}`);
    }

    setBusy(false); setOpen(false);
    setSvDip(""); setSvBatch(""); setSvName(""); setSvAmount(""); setSvNote(""); setFile(null); setSvFree(false); setSvPaid(false); setSvNeedsAct(false);
    toast(tr("serviceAdded")); router.refresh();
  }

  function resetMove() { setMoveFor(null); setMoveTo(""); setMoveFee(""); setMoveCur("EGP"); setMoveGift(false); setMoveFile(null); }

  async function doMove(e: Enr) {
    if (!moveTo || moveTo === e.batchId) { toast(tr("selectTargetBatch")); return; }
    const fee = Number(moveFee) || 0;
    if (!moveGift && fee <= 0) { toast(tr("enterTransferFee")); return; }
    setBusy(true);

    // 1) رفع اسكرين التحويل (لو مرفوع)
    let shotUrl = "";
    if (!moveGift && moveFile) {
      const path = `transfers/${customerId}/${Date.now()}-${moveFile.name}`;
      const up = await supabase.storage.from("receipts").upload(path, moveFile, { upsert: false });
      if (up.error) { setBusy(false); toast(tr("screenshotUploadFailed")); return; }
      shotUrl = path;
      await supabase.from("customer_docs").insert({ customer_id: customerId, url: path, name: `${tr("transferFeeProof")} — (${moveFile.name})` });
    }

    // 2) رسوم النقل كقسط مدفوع (يدخل التحصيل) — إلا لو هدية
    if (!moveGift && fee > 0) {
      const { error: finErr } = await supabase.from("installments").insert({
        enrollment_id: e.id, amount: fee, currency: moveCur, status: "paid",
        paid_at: new Date().toISOString(), screenshot_url: shotUrl || null,
      });
      if (finErr) { setBusy(false); toast(tr("transferFailed")); return; }
    }

    // 3) النقل الفعلي للباتش الجديد (موديل أ — فوري بعد الدفع)
    const fromLabel = e.batch || batchLabel(e.batchId);
    const toLabel = batchLabel(moveTo);
    const { error: mvErr } = await supabase.from("enrollments").update({ batch_id: moveTo }).eq("id", e.id);
    if (mvErr) { setBusy(false); toast(tr("transferFailed")); return; }

    // 4) تذكرة للدعم لتفعيل الخدمات الخارجية (LMS / جروب واتساب)
    await supabase.from("tickets").insert({
      customer_id: customerId,
      title: `${tr("transferTicketTitle")} — ${e.diploma}`,
      body: `${tr("transferTicketBody")}\n${e.diploma}: ${fromLabel} → ${toLabel}\n${moveGift ? tr("transferGiftNote") : tr("transferFeeLabel") + ": " + fee + " " + (moveCur === "USD" ? "$" : tr("egpShort"))}`,
      status: "open", priority: "normal",
    });

    // 5) تسجيل في التايم لاين
    await logAudit("batch_transfer", `${e.diploma}: ${tr("auditBatchTransfer")} ${fromLabel} → ${toLabel}${moveGift ? " (" + tr("giftWord") + ")" : " — " + tr("transferFeeLabel") + " " + fee + " " + (moveCur === "USD" ? "$" : tr("egpShort"))}`);

    setBusy(false); resetMove();
    toast(tr("transferredToSupport")); router.refresh();
  }

  async function togglePaid(a: Addon) {
    const next = !a.paid;
    const { error } = await supabase.from("customer_addons").update({ paid: next }).eq("id", a.id);
    if (error) { toast(tr("updateFailedShort")); return; }
    toast(next ? tr("markedPaid") : tr("paymentCancelled")); router.refresh();
  }

  async function delAddon(a: Addon) {
    if (!confirm(`${tr("deleteQ")} «${a.name}»؟`)) return;
    await supabase.from("customer_addons").delete().eq("id", a.id);
    toast(tr("deleted")); router.refresh();
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="sec-t" style={{ margin: 0 }}>{tr("servicesTitle")}</div>
        <button onClick={() => setOpen((v) => !v)} className={open ? "btn ghost" : "btn"} style={{ height: 34, padding: "0 14px", fontSize: 13 }}>
          {open ? tr("close") : "＋ " + tr("addServiceBtn")}
        </button>
      </div>

      {open && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, margin: "12px 0", background: "var(--surface)" }}>
          <div className="frow">
            <div className="fld"><label>{tr("serviceType")}</label>
              <select className="inp" value={svType} onChange={(e) => { setSvType(e.target.value); setSvName(""); setSvDip(""); }}>
                {SV_TYPES.map((t) => <option key={t.key} value={t.key}>{t.icon} {tr(t.labelKey)}</option>)}
              </select></div>
            <div className="fld"><label>{svType === "diploma" ? tr("theDiploma") : tr("theItem")}</label>
              {svType === "diploma" ? (
                <select className="inp" value={svDip} onChange={(e) => setSvDip(e.target.value)}>
                  <option value="">{tr("selectDiploma")}</option>
                  {dipOpts.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
                </select>
              ) : (
                <select className="inp" value={svName} onChange={(e) => setSvName(e.target.value)}>
                  <option value="">{tr("selectDash")}</option>
                  {svNames.map((n) => <option key={n.v} value={n.v}>{n.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {svType === "diploma" && (
            <div className="frow">
              <div className="fld"><label>{tr("theBatch")}</label>
                <select className="inp" value={svBatch} onChange={(e) => setSvBatch(e.target.value)}>
                  <option value="">{tr("noBatch")}</option>
                  {batchOpts.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
                </select></div>
            </div>
          )}

          <label className="chkrow"><input type="checkbox" checked={svFree} onChange={(e) => setSvFree(e.target.checked)} /> {tr("freeGift")}</label>

          <label className="chkrow" style={{ background: svNeedsAct ? "rgba(24,169,87,.08)" : "transparent", borderRadius: 8, padding: svNeedsAct ? "6px 8px" : "0" }}>
            <input type="checkbox" checked={svNeedsAct} onChange={(e) => setSvNeedsAct(e.target.checked)} />
            🎯 {tr("svNeedsActivation")}
          </label>

          {canFinance && !svFree && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginTop: 8, background: "rgba(24,169,87,.04)" }}>
              <div className="frow" style={{ alignItems: "end" }}>
                <div className="fld" style={{ margin: 0 }}><label>{tr("agreedAmount")}</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="inp num" dir="ltr" style={{ flex: 1 }} value={svAmount} onChange={(e) => setSvAmount(e.target.value)} placeholder={tr("amountPh")} />
                    <select className="inp" style={{ width: 70 }} value={svCurrency} onChange={(e) => setSvCurrency(e.target.value)}>
                      <option value="EGP">{tr("egpShort")}</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
                <div className="fld" style={{ margin: 0 }}><label>{tr("paymentProof")}</label>
                  <FileDrop className="addshot" style={{ width: "100%" }} accept="image/*" onFile={setFile}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
                    {file ? file.name : tr("uploadTransferShot")}
                  </FileDrop>
                </div>
              </div>
            </div>
          )}

          {svType !== "diploma" && (
            <div className="fld" style={{ marginTop: 8 }}><label>{tr("note")}</label><input className="inp" value={svNote} onChange={(e) => setSvNote(e.target.value)} /></div>
          )}

          {svType !== "diploma" && (
            <label className="chkrow"><input type="checkbox" checked={svPaid} onChange={(e) => setSvPaid(e.target.checked)} /> {tr("paidHandoffHint")}</label>
          )}

          <button onClick={addService} disabled={busy} className="btn" style={{ marginTop: 10, width: "100%" }}>{busy ? "..." : tr("addServiceSubmit")}</button>
        </div>
      )}

      {/* الدبلومات (الاشتراكات) */}
      {enrolls.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>{tr("diplomas")}</div>
          {enrolls.map((e) => {
            const m = stMeta("diploma");
            return (
              <div key={e.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="chip" style={{ background: m.color + "1a", color: m.color }}>{m.icon} {tr(m.labelKey)}</span>
                    <b style={{ color: "var(--ink)", fontSize: 13 }}>{e.diploma}</b>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{tr("batchColon")} <span className="num">{e.batch}</span></span>
                    <button onClick={() => { if (moveFor === e.id) { resetMove(); } else { resetMove(); setMoveFor(e.id); setMoveTo(e.batchId); } }}
                      style={{ color: "var(--brand)", fontWeight: 700, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>
                      {tr("moveTransfer")}
                    </button>
                  </div>
                </div>
                {moveFor === e.id && (
                  <div style={{ marginTop: 10, padding: 12, border: "1px solid var(--line)", borderRadius: 10, background: "var(--muted-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>{tr("targetBatch")}</label>
                      <select className="inp" style={{ width: "100%", height: 38 }} value={moveTo} onChange={(ev) => setMoveTo(ev.target.value)}>
                        {batchOpts.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
                      </select>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={moveGift} onChange={(ev) => setMoveGift(ev.target.checked)} />
                      <span>{tr("transferGift")}</span>
                    </label>

                    {!moveGift && (
                      <>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>{tr("transferFeeLabel")}</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input className="inp num" dir="ltr" placeholder="0" style={{ flex: 1, height: 38 }} value={moveFee} onChange={(ev) => setMoveFee(ev.target.value)} />
                            <select className="inp" style={{ width: 84, height: 38 }} value={moveCur} onChange={(ev) => setMoveCur(ev.target.value)}>
                              <option value="EGP">{tr("egpShort")}</option><option value="USD">$</option>
                            </select>
                          </div>
                        </div>
                        <FileDrop className="btn ghost" style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5 }} accept="image/*" onFile={setMoveFile}>
                          📎 {moveFile ? moveFile.name : tr("uploadTransferShot")}
                        </FileDrop>
                      </>
                    )}

                    <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>{tr("transferHint")}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn" onClick={() => doMove(e)} disabled={busy} style={{ height: 38, flex: 1 }}>{busy ? "..." : tr("confirmTransfer")}</button>
                      <button className="btn ghost" onClick={resetMove} style={{ height: 38, padding: "0 14px" }}>{tr("cancel")}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* الإضافات (اعتماد / مشروع / مكتبة) */}
      {addons.length > 0 && (
        <div style={{ marginTop: enrolls.length > 0 ? 12 : 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>{tr("addonsLabel")}</div>
          {addons.map((a) => {
            const m = stMeta(a.type);
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                <span className="chip" style={{ background: m.color + "1a", color: m.color }}>{m.icon} {tr(m.labelKey)}</span>
                <span style={{ flex: 1, fontWeight: 700, color: "var(--ink)", fontSize: 13 }}>{a.name}{a.free && <span style={{ color: "var(--green)", fontSize: 11, marginInlineStart: 6 }}>🎁 {tr("free")}</span>}</span>
                {canFinance && !a.free && <span className="num" dir="ltr" style={{ fontSize: 13, color: "var(--muted)" }}>{new Intl.NumberFormat("en").format(a.amount)} {tr("egpShort")}</span>}
                {a.shot_url && <a href={a.shot_url} target="_blank" rel="noreferrer" title={tr("paymentProof")} style={{ color: "var(--blue)", fontSize: 12 }}>🧾</a>}
                <div className={"sw" + (a.paid ? " on" : "")} onClick={() => togglePaid(a)} title={a.paid ? tr("paid") : tr("unpaid")}><i /></div>
                <button onClick={() => delAddon(a)} style={{ color: "var(--red)", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {enrolls.length === 0 && addons.length === 0 && !open && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{tr("noServices")}</div>
      )}
    </div>
  );
}
