"use client";
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import {
  selectAllFilteredIds, bulkSetOwner, bulkSetStage, bulkSignTerms, bulkArchive, bulkExportRows,
  bulkFollowUp, bulkDelete, bulkGetPhones,
} from "./bulkActions";
import type { CustFilterSP } from "@/lib/customerFilter";

type Ctx = {
  sel: Set<string>;
  toggle: (id: string) => void;
  isSel: (id: string) => boolean;
  clear: () => void;
  togglePage: (pageIds: string[], on: boolean) => void;
  pageAllSelected: (pageIds: string[]) => boolean;
  selectAllFiltered: () => Promise<void>;
  loadingAll: boolean;
  count: number;
};

const SelCtx = createContext<Ctx | null>(null);

export function BulkSelectProvider({ filter, children }: { filter: CustFilterSP; children: ReactNode }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [loadingAll, setLoadingAll] = useState(false);
  const tr = useT();

  const toggle = useCallback((id: string) => {
    setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const isSel = useCallback((id: string) => sel.has(id), [sel]);
  const clear = useCallback(() => setSel(new Set()), []);
  const togglePage = useCallback((pageIds: string[], on: boolean) => {
    setSel((prev) => { const n = new Set(prev); pageIds.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  }, []);
  const pageAllSelected = useCallback((pageIds: string[]) => pageIds.length > 0 && pageIds.every((id) => sel.has(id)), [sel]);

  const selectAllFiltered = useCallback(async () => {
    setLoadingAll(true);
    try {
      const ids = await selectAllFilteredIds(filter);
      setSel(new Set(ids));
      toast(tr("bulkSelectedAll").replace("{n}", String(ids.length)));
    } catch { toast(tr("bulkGenericError")); }
    setLoadingAll(false);
  }, [filter, tr]);

  const value = useMemo<Ctx>(() => ({
    sel, toggle, isSel, clear, togglePage, pageAllSelected, selectAllFiltered, loadingAll, count: sel.size,
  }), [sel, toggle, isSel, clear, togglePage, pageAllSelected, selectAllFiltered, loadingAll]);

  return <SelCtx.Provider value={value}>{children}</SelCtx.Provider>;
}

function useSel() {
  const c = useContext(SelCtx);
  if (!c) throw new Error("useSel outside provider");
  return c;
}

export function RowCheck({ id }: { id: string }) {
  const { isSel, toggle } = useSel();
  return (
    <input type="checkbox" checked={isSel(id)} onChange={() => toggle(id)}
      onClick={(e) => e.stopPropagation()}
      style={{ width: 16, height: 16, accentColor: "var(--brand)", cursor: "pointer" }} />
  );
}

export function SelectAllHeader({ pageIds }: { pageIds: string[] }) {
  const { pageAllSelected, togglePage } = useSel();
  const on = pageAllSelected(pageIds);
  return (
    <input type="checkbox" checked={on} onChange={() => togglePage(pageIds, !on)}
      style={{ width: 16, height: 16, accentColor: "var(--brand)", cursor: "pointer" }} />
  );
}

export function BulkBar({ owners, stages, templates, totalFiltered, canManageBatches, canExport, canMessage }: {
  owners: { id: string; name: string }[];
  stages: { key: string; label: string }[];
  templates: { id: string; name: string }[];
  totalFiltered: number;
  canManageBatches: boolean;
  canExport: boolean;
  canMessage: boolean;
}) {
  const { sel, count, clear, selectAllFiltered, loadingAll } = useSel();
  const tr = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<"" | "owner" | "stage" | "follow">("");
  const [waNums, setWaNums] = useState<string[] | null>(null);
  const [fuDate, setFuDate] = useState("");
  const [fuNote, setFuNote] = useState("");
  const [confirmBox, setConfirmBox] = useState<{ msg: string; label: string; danger: boolean; run: () => void } | null>(null);

  if (count === 0) return null;
  const ids = () => Array.from(sel);

  async function run(fn: () => Promise<{ ok: number; error: string | null }>, okMsg: string) {
    setBusy(true); setMenu("");
    try {
      const res = await fn();
      if (res.error) { toast(tr("bulkGenericError")); }
      else { toast(okMsg.replace("{n}", String(res.ok))); clear(); router.refresh(); }
    } catch { toast(tr("bulkGenericError")); }
    setBusy(false);
  }

  function doArchive() {
    setConfirmBox({ msg: tr("bulkArchiveConfirm").replace("{n}", String(count)), label: tr("bulkArchive"), danger: true, run: () => run(() => bulkArchive(ids()), tr("bulkArchivedOk")) });
  }
  function doTerms() {
    setConfirmBox({ msg: tr("bulkTermsConfirm").replace("{n}", String(count)), label: tr("bulkSignTerms"), danger: false, run: () => run(() => bulkSignTerms(ids()), tr("bulkTermsOk")) });
  }
  async function doOwner(ownerId: string | null) { run(() => bulkSetOwner(ids(), ownerId), tr("bulkOwnerOk")); }
  async function doStage(stage: string) { run(() => bulkSetStage(ids(), stage), tr("bulkStageOk")); }

  function doDelete() {
    setConfirmBox({ msg: tr("bulkDeleteConfirm1").replace("{n}", String(count)), label: tr("bulkDelete"), danger: true, run: () => run(() => bulkDelete(ids()), tr("bulkDeletedOk")) });
  }

  async function doFollow() {
    if (!fuDate) { toast(tr("bulkFollowNoDate")); return; }
    setBusy(true); setMenu("");
    try {
      const res = await bulkFollowUp(ids(), new Date(fuDate).toISOString(), fuNote);
      if (res.error) toast(tr("bulkGenericError"));
      else { toast(tr("bulkFollowOk").replace("{n}", String(res.ok))); setFuDate(""); setFuNote(""); clear(); router.refresh(); }
    } catch { toast(tr("bulkGenericError")); }
    setBusy(false);
  }

  async function doWhatsapp() {
    setBusy(true); setMenu("");
    try {
      const nums = await bulkGetPhones(ids());
      setWaNums(nums);
    } catch { toast(tr("bulkGenericError")); }
    setBusy(false);
  }

  async function doExport() {
    setBusy(true);
    try {
      const rows = await bulkExportRows(ids());
      const head = ["name", "phone1", "phone2", "email", "company", "stage"];
      const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = "\uFEFF" + [head.join(","), ...rows.map((r: any) => head.map((h) => esc(r[h])).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast(tr("bulkExportOk").replace("{n}", String(rows.length)));
    } catch { toast(tr("bulkGenericError")); }
    setBusy(false);
  }

  const btn: React.CSSProperties = {
    height: 34, padding: "0 12px", borderRadius: 8, fontWeight: 700, fontSize: 12.5,
    border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", whiteSpace: "nowrap",
  };
  const menuBox: React.CSSProperties = {
    position: "absolute", top: 38, insetInlineStart: 0, zIndex: 20, background: "var(--surface)",
    border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow)", minWidth: 180, maxHeight: 280, overflow: "auto", padding: 4,
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 12px", marginBottom: 12, borderRadius: 10, background: "var(--brand-soft)", border: "1px solid #f6d6b0" }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: "var(--brand-d)" }}>
          {tr("bulkSelectedCount").replace("{n}", String(count))}
        </span>

        {count < totalFiltered && (
          <button style={{ ...btn, borderColor: "var(--brand)", color: "var(--brand)" }} onClick={selectAllFiltered} disabled={loadingAll}>
            {loadingAll ? "..." : tr("bulkSelectAllFiltered").replace("{n}", String(totalFiltered))}
          </button>
        )}
        <button style={btn} onClick={clear}>{tr("bulkClear")}</button>

        <span style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px" }} />

        {/* واتساب جماعي */}
        {canMessage && (
          <button style={{ ...btn, background: "var(--wa)", color: "#fff", borderColor: "var(--wa)" }} disabled={busy} onClick={doWhatsapp}>💬 {tr("bulkWhatsapp")}</button>
        )}

        {/* تعيين مسؤول */}
        <div style={{ position: "relative" }}>
          <button style={btn} disabled={busy} onClick={() => setMenu(menu === "owner" ? "" : "owner")}>👤 {tr("bulkAssignOwner")}</button>
          {menu === "owner" && (
            <div style={menuBox}>
              <button style={{ ...btn, width: "100%", border: "none", textAlign: "start", color: "var(--muted)" }} onClick={() => doOwner(null)}>{tr("unassigned")}</button>
              {owners.map((o) => (
                <button key={o.id} style={{ ...btn, width: "100%", border: "none", textAlign: "start" }} onClick={() => doOwner(o.id)}>{o.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* تغيير المرحلة */}
        <div style={{ position: "relative" }}>
          <button style={btn} disabled={busy} onClick={() => setMenu(menu === "stage" ? "" : "stage")}>🔄 {tr("bulkChangeStage")}</button>
          {menu === "stage" && (
            <div style={{ ...menuBox, minWidth: 160 }}>
              {stages.map((s) => (
                <button key={s.key} style={{ ...btn, width: "100%", border: "none", textAlign: "start" }} onClick={() => doStage(s.key)}>{s.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* متابعة جماعية */}
        <div style={{ position: "relative" }}>
          <button style={btn} disabled={busy} onClick={() => setMenu(menu === "follow" ? "" : "follow")}>🗓️ {tr("bulkFollowUp")}</button>
          {menu === "follow" && (
            <div style={{ ...menuBox, minWidth: 230, padding: 12 }}>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 4 }}>{tr("bulkFollowDate")}</label>
              <input type="datetime-local" className="inp" value={fuDate} onChange={(e) => setFuDate(e.target.value)} style={{ marginBottom: 8 }} />
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 4 }}>{tr("bulkFollowNote")}</label>
              <input className="inp" value={fuNote} onChange={(e) => setFuNote(e.target.value)} placeholder={tr("bulkFollowNotePh")} style={{ marginBottom: 8 }} />
              <button className="btn" style={{ width: "100%", height: 34 }} disabled={busy} onClick={doFollow}>{busy ? "..." : tr("bulkFollowCreate")}</button>
            </div>
          )}
        </div>

        {/* إمضاء الشروط */}
        <button style={btn} disabled={busy} onClick={doTerms}>✍️ {tr("bulkSignTerms")}</button>

        {/* أرشفة */}
        {canManageBatches && <button style={{ ...btn, color: "var(--red)", borderColor: "#f3c9c4" }} disabled={busy} onClick={doArchive}>🗄️ {tr("bulkArchive")}</button>}

        {/* تصدير */}
        {canExport && <button style={btn} disabled={busy} onClick={doExport}>📥 {tr("bulkExport")}</button>}

        {/* حذف نهائي */}
        {canManageBatches && <button style={{ ...btn, background: "var(--red)", color: "#fff", borderColor: "var(--red)" }} disabled={busy} onClick={doDelete}>🗑️ {tr("bulkDelete")}</button>}
      </div>

      {/* مودال أرقام الواتساب */}
      {waNums && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setWaNums(null)}>
          <div className="card" style={{ padding: 20, width: "min(460px,100%)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", marginBottom: 12 }}>💬 {tr("bulkWhatsapp")} — {waNums.length}</div>
            {templates.length > 0 && (
              <div className="fld"><label>{tr("chooseTpl")}</label>
                <select className="inp">{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            )}
            <div className="fld"><label>{tr("numbers")}</label>
              <textarea className="inp num" dir="ltr" rows={5} readOnly value={waNums.join("\n")} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(waNums.join("\n")); toast(tr("copied")); }}>{tr("copyNums")}</button>
              <button className="btn" onClick={() => setWaNums(null)}>{tr("done")}</button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>{tr("watiHint")}</p>
          </div>
        </div>
      )}
      {/* مودال تأكيد داخلي (بدل window.confirm) */}
      {confirmBox && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.45)", zIndex: 70, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setConfirmBox(null)}>
          <div className="card" style={{ padding: 22, width: "min(420px,100%)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", flexShrink: 0, background: confirmBox.danger ? "var(--red-soft)" : "var(--brand-soft)", color: confirmBox.danger ? "var(--red)" : "var(--brand)" }}>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </span>
              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{tr("confirmActionTitle")}</div>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6, margin: "0 0 18px" }}>{confirmBox.msg}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => { const r = confirmBox.run; setConfirmBox(null); r(); }}
                style={confirmBox.danger ? { flex: 1, justifyContent: "center", background: "var(--red)", borderColor: "var(--red)", color: "#fff" } : { flex: 1, justifyContent: "center" }}>
                {confirmBox.label}
              </button>
              <button className="btn ghost" onClick={() => setConfirmBox(null)}>{tr("cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
