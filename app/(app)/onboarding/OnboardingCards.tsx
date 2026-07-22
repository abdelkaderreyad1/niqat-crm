"use client";
import { useState, useCallback, useMemo, memo } from "react";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { revalidateCustomers } from "../customers/actions";
import EmptyState from "../EmptyState";

type Item = { id: string; label: string; done: boolean; by: string | null; at: string };
const REFUND_CLOSE_LABEL = "قفل الأكسس (ريفند)";
type Card = {
  handoffId: string; custId: string; name: string; phone: string;
  status: string; note: string; onholdReason: string; createdAt: string;
  assignee: string; diplomas: string[]; batches: string[]; items: Item[];
  kind: string; meta: any;
};

function initials(name: string) {
  const p = (name || "?").trim().split(/\s+/);
  return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2);
}
const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
function avColor(id: string) { let h = 0; for (const c of id || "") h += c.charCodeAt(0); return AV[h % AV.length]; }
function waLink(phone: string) { const d = (phone || "").replace(/\D/g, ""); return d ? "https://wa.me/" + d : "#"; }
function ageHours(iso: string) { if (!iso) return 0; return (Date.now() - Date.parse(iso)) / 3600000; }

const CardView = memo(function CardView({
  c, confirming, holding, holdReason, setHoldReason,
  onToggle, onAskComplete, onCancelComplete, onComplete,
  onAskHold, onCancelHold, onHold, onResume, onArchive, onConfirmTransfer,
}: {
  c: Card; confirming: boolean; holding: boolean; holdReason: string; setHoldReason: (v: string) => void;
  onToggle: (hid: string, iid: string) => void;
  onAskComplete: (hid: string) => void; onCancelComplete: () => void; onComplete: (hid: string, custId: string) => void;
  onAskHold: (hid: string) => void; onCancelHold: () => void; onHold: (hid: string) => void; onResume: (hid: string) => void;
  onArchive: (custId: string, handoffId: string) => void;
  onConfirmTransfer: (hid: string, custId: string, meta: any) => void;
}) {
  const tr = useT();

  // كارت مخصّص لطلب النقل بين الباتشات (kind=batch_transfer)
  if (c.kind === "batch_transfer") {
    const m = c.meta || {};
    const onHoldNow = c.status === "onhold";
    return (
      <div className="onb-card" style={{ background: "var(--surface)", borderTop: "3px solid #2F6BFF" }}>
        <div className="oh">
          <span className="av" style={{ background: avColor(c.custId), width: 40, height: 40 }}>{initials(c.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ color: "var(--ink)" }}>{c.name}</b>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--fe)", direction: "ltr" }}>{c.phone || "—"}</div>
          </div>
          <span className="chip" style={{ background: "rgba(47,107,255,.12)", color: "#2F6BFF" }}>{tr("batchTransferChip")}</span>
        </div>
        <div className="ob">
          <div style={{ fontSize: 13, color: "var(--ink)", marginBottom: 10, fontWeight: 700 }}>
            {m.diploma ? m.diploma + " — " : ""}
            <span dir="ltr" style={{ color: "var(--muted)" }}>{m.from_label || "?"}</span>
            {" → "}
            <span dir="ltr" style={{ color: "#2F6BFF" }}>{m.to_label || "?"}</span>
          </div>
          {c.note && <div className="onb-note" style={{ marginBottom: 12 }}>📝 {c.note}</div>}
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12 }}>{tr("batchTransferHint")}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <a className="btn wa sm" style={{ textDecoration: "none" }} href={waLink(c.phone)} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z" /></svg>
            </a>
            <Link className="btn ghost sm" href={`/customers/${c.custId}`}>{tr("theFile")}</Link>
            {confirming ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginInlineStart: "auto" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{tr("confirmTransferQ")}</span>
                <button className="btn sm" onClick={() => onConfirmTransfer(c.handoffId, c.custId, m)}>{tr("confirmTransferBtn")}</button>
                <button className="btn ghost sm" onClick={onCancelComplete}>{tr("cancel")}</button>
              </div>
            ) : (
              !onHoldNow && (
                <button className="btn sm" style={{ marginInlineStart: "auto" }} onClick={() => onAskComplete(c.handoffId)}>
                  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>
                  {tr("confirmTransferBtn")}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }
  const total = c.items.length;
  const dn = c.items.filter((i) => i.done).length;
  const allDone = total > 0 && dn === total;
  const refundCloseDone = c.items.some((i) => i.label === REFUND_CLOSE_LABEL && i.done);
  const onHoldNow = c.status === "onhold";
  const hrs = ageHours(c.createdAt);
  const stale = !onHoldNow && !allDone && hrs > 48;
  const accent = onHoldNow ? "#E6A700" : allDone ? "#18A957" : "";

  return (
    <div className="onb-card" style={{ background: "var(--surface)", opacity: onHoldNow ? 0.9 : 1, borderTop: accent ? `3px solid ${accent}` : undefined }}>
      <div className="oh">
        <span className="av" style={{ background: avColor(c.custId), width: 40, height: 40 }}>{initials(c.name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ color: "var(--ink)" }}>{c.name}</b>
          <div style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--fe)", direction: "ltr" }}>{c.phone || "—"}</div>
        </div>
        <span className="chip" style={{
          background: onHoldNow ? "rgba(230,167,0,.14)" : allDone ? "rgba(24,169,87,.12)" : "var(--brand-soft)",
          color: onHoldNow ? "#B7860B" : allDone ? "var(--green)" : "var(--brand)",
        }}>
          {onHoldNow ? tr("onHoldLabel") : allDone ? tr("readyToComplete") : tr("needsActivation")}
        </span>
      </div>
      <div className="ob">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
          {c.assignee && <span>👤 {tr("activationOwner")}: <b style={{ color: "var(--ink)" }}>{c.assignee}</b></span>}
          {c.createdAt && <span className="num" dir="ltr">🗓 {String(c.createdAt).slice(0, 10)}</span>}
          {stale && <span className="chip" style={{ background: "rgba(224,72,59,.12)", color: "#E0483B" }}>{tr("overdueWord")}</span>}
        </div>

        {(c.diplomas.length > 0 || c.batches.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {c.diplomas.map((d, i) => <span className="chip" key={"d" + i}>{d}</span>)}
            {c.batches.map((b, i) => <span className="chip" key={"b" + i} style={{ background: "var(--brand-soft)", color: "var(--brand)" }} dir="ltr">{b}</span>)}
          </div>
        )}

        {onHoldNow && (
          <div className="onb-note" style={{ marginBottom: 12, background: "rgba(230,167,0,.1)", borderColor: "#E6A700" }}>
            ⏸ {tr("onHoldLabel")}{c.onholdReason ? ": " + c.onholdReason : ""}
          </div>
        )}
        {c.note && <div className="onb-note" style={{ marginBottom: 12 }}>📝 {c.note}</div>}

        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>{dn}/{total} {tr("doneWord")}</div>
        <div className="prog"><i style={{ width: (total ? (dn / total) * 100 : 0) + "%" }} /></div>
        <div style={{ marginTop: 12 }}>
          {c.items.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{tr("noActivationTasks")}</div>}
          {c.items.map((it) => (
            <div className={"task" + (it.done ? " done" : "")} style={{ marginBottom: 8 }} key={it.id}>
              <div className={"cb" + (it.done ? " on" : "")} onClick={() => onToggle(c.handoffId, it.id)} style={{ cursor: "pointer" }}>
                {it.done && <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tt">{it.label}</div>
                {it.done && it.by && <div className="tinfo">{tr("activatedBy")} <b>{it.by}</b>{it.at ? " • " + it.at : ""}</div>}
              </div>
            </div>
          ))}
        </div>

        {holding && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input className="inp" autoFocus placeholder={tr("onHoldReasonPh")} value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)} style={{ flex: 1, height: 36 }} />
            <button className="btn sm" onClick={() => onHold(c.handoffId)} style={{ background: "#E6A700" }}>{tr("save")}</button>
            <button className="btn ghost sm" onClick={onCancelHold}>{tr("cancel")}</button>
          </div>
        )}

        {!holding && (
          <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
            <a className="btn wa sm" style={{ textDecoration: "none" }} href={waLink(c.phone)} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z" /></svg>
            </a>
            <Link className="btn ghost sm" href={`/customers/${c.custId}`}>{tr("theFile")}</Link>
            {onHoldNow ? (
              <button className="btn ghost sm" onClick={() => onResume(c.handoffId)}>▶ {tr("resume")}</button>
            ) : (
              <button className="btn ghost sm" onClick={() => onAskHold(c.handoffId)}>⏸ {tr("putOnHold")}</button>
            )}
            {allDone && !onHoldNow && !confirming && (
              <button className="btn sm" style={{ marginInlineStart: "auto" }} onClick={() => onAskComplete(c.handoffId)}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>
                {tr("completeActivation")}
              </button>
            )}
            {refundCloseDone && (
              <button className="btn danger sm" style={{ marginInlineStart: allDone ? undefined : "auto" }}
                onClick={() => onArchive(c.custId, c.handoffId)}>
                🗄️ {tr("closedArchiveBtn")}
              </button>
            )}
            {confirming && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginInlineStart: "auto" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{tr("confirmComplete")}</span>
                <button className="btn sm" onClick={() => onComplete(c.handoffId, c.custId)}>{tr("completeActivation")}</button>
                <button className="btn ghost sm" onClick={onCancelComplete}>{tr("cancel")}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default function OnboardingCards({ cards: initial }: { cards: Card[] }) {
  const tr = useT();
  const supabase = createClient();
  const [cards, setCards] = useState<Card[]>(initial);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "notready" | "onhold">("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState("");

  const toggle = useCallback(async (hid: string, iid: string) => {
    let next = false;
    setCards((cs) => cs.map((c) => {
      if (c.handoffId !== hid) return c;
      return { ...c, items: c.items.map((x) => { if (x.id !== iid) return x; next = !x.done; return { ...x, done: next }; }) };
    }));
    await supabase.from("handoff_items").update({ done: next, done_at: next ? new Date().toISOString() : null }).eq("id", iid);
  }, [supabase]);

  const complete = useCallback(async (hid: string, custId: string) => {
    setConfirmId(null);
    setCards((cs) => cs.filter((c) => c.handoffId !== hid));
    await supabase.from("handoffs").update({ status: "done" }).eq("id", hid);
    // النقل الفعلي بيتمّ هنا — لما الدعم يأكّد
    if (custId) {
      await supabase.from("customers").update({ stage: "enrolled", handed_off: true }).eq("id", custId);
      await supabase.from("audit_log").insert({ customer_id: custId, action: "handoff_confirmed", detail: "confirmed_by_support" });
    }
  }, [supabase]);

  // تأكيد النقل بين الباتشات — دلوقتي بس بيتغيّر الباتش فعلياً
  const confirmTransfer = useCallback(async (hid: string, custId: string, meta: any) => {
    setConfirmId(null);
    setCards((cs) => cs.filter((c) => c.handoffId !== hid));
    const eid = meta?.enrollment_id; const target = meta?.target_batch_id;
    if (eid && target) {
      await supabase.from("enrollments").update({ batch_id: target }).eq("id", eid);
    }
    await supabase.from("handoffs").update({ status: "done" }).eq("id", hid);
    if (custId) {
      await supabase.from("audit_log").insert({ customer_id: custId, action: "batch_transfer_confirmed", detail: `${meta?.from_label || "?"} → ${meta?.to_label || "?"}` });
    }
  }, [supabase]);

  const doHold = useCallback(async (hid: string) => {
    const reason = holdReason.trim();
    setCards((cs) => cs.map((c) => (c.handoffId === hid ? { ...c, status: "onhold", onholdReason: reason } : c)));
    setHoldId(null); setHoldReason("");
    await supabase.from("handoffs").update({ status: "onhold", onhold_reason: reason }).eq("id", hid);
  }, [supabase, holdReason]);

  const resume = useCallback(async (hid: string) => {
    setCards((cs) => cs.map((c) => (c.handoffId === hid ? { ...c, status: "pending", onholdReason: "" } : c)));
    await supabase.from("handoffs").update({ status: "pending", onhold_reason: null }).eq("id", hid);
  }, [supabase]);

  const archiveCustomer = useCallback(async (custId: string, hid: string) => {
    if (!confirm(tr("archiveCustomerQ"))) return;
    setCards((cs) => cs.filter((c) => c.handoffId !== hid));
    const { error } = await supabase.from("customers").update({ archived: true }).eq("id", custId);
    if (error) { alert(tr("archiveFailed") + error.message); return; }
    // قفل الريفند (best-effort — الفلترة بالأرشفة بتخفيه برضه)
    await supabase.from("refunds").update({ status: "closed" }).eq("customer_id", custId).neq("status", "closed");
    await revalidateCustomers();
  }, [supabase, tr]);

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const isReady = (c: Card) => c.status !== "onhold" && (c.kind === "batch_transfer" || (c.items.length > 0 && c.items.every((i) => i.done)));
    let list = cards.filter((c) => c.status !== "done");
    if (qq) list = list.filter((c) => (c.name || "").toLowerCase().includes(qq));
    if (filter === "ready") list = list.filter(isReady);
    else if (filter === "notready") list = list.filter((c) => c.status !== "onhold" && !isReady(c));
    else if (filter === "onhold") list = list.filter((c) => c.status === "onhold");
    const rank = (c: Card) => (c.status === "onhold" ? 2 : isReady(c) ? 0 : 1);
    return [...list].sort((a, b) => rank(a) - rank(b) || String(a.createdAt).localeCompare(String(b.createdAt)));
  }, [cards, q, filter]);

  const chipBtn = (key: typeof filter, label: string) => (
    <button onClick={() => setFilter(key)} className="opt-chip"
      style={filter === key ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" } : undefined}>
      {label}
    </button>
  );

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input className="inp" placeholder={tr("searchByNamePh")} value={q} onChange={(e) => setQ(e.target.value)}
          style={{ height: 38, maxWidth: 240 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chipBtn("all", tr("chipAll"))}
          {chipBtn("ready", tr("filterReady"))}
          {chipBtn("notready", tr("filterNotReady"))}
          {chipBtn("onhold", tr("onHoldLabel"))}
        </div>
      </div>

      {shown.length ? (
        <div className="onb-grid">
          {shown.map((c) => (
            <CardView key={c.handoffId} c={c}
              confirming={confirmId === c.handoffId}
              holding={holdId === c.handoffId}
              holdReason={holdReason} setHoldReason={setHoldReason}
              onToggle={toggle}
              onAskComplete={setConfirmId} onCancelComplete={() => setConfirmId(null)} onComplete={complete}
              onAskHold={(hid) => { setHoldId(hid); setHoldReason(""); }} onCancelHold={() => setHoldId(null)}
              onHold={doHold} onResume={resume} onArchive={archiveCustomer} onConfirmTransfer={confirmTransfer} />
          ))}
        </div>
      ) : (
        <EmptyState text={tr("funNoOnboarding") + " 🎉"} />
      )}
    </>
  );
}
