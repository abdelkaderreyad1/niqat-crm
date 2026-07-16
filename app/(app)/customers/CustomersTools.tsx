"use client";
import { useState, useRef, useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { getSegmentPhones } from "./segmentPhones";

type Opt = { v: string; label: string };
type Tpl = { id: string; name: string; body: string };
type Filters = { q?: string; stage?: string; owner?: string; company?: string; dip?: string; spec?: string; batch?: string; pay?: string };

// فلتر متعدد الاختيار (checkboxes) — يخزّن القيم كـ CSV في الـ URL
function MultiSel({ label, paramKey, opts }: { label: string; paramKey: string; opts: Opt[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = (sp.get(paramKey) || "").split(",").map((x) => x.trim()).filter(Boolean);
  const [draft, setDraft] = useState<string[]>(selected);

  function commit(next: string[]) {
    const cur = (sp.get(paramKey) || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (JSON.stringify([...cur].sort()) === JSON.stringify([...next].sort())) { setOpen(false); return; }
    const p = new URLSearchParams(sp.toString());
    if (next.length) p.set(paramKey, next.join(",")); else p.delete(paramKey);
    p.delete("page");
    setOpen(false);
    router.push("/customers" + (p.toString() ? "?" + p.toString() : ""));
  }

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) commit(draft); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, draft]);

  const count = selected.length;
  return (
    <div ref={ref} style={{ position: "relative", flex: "0 0 auto" }}>
      <button type="button" className="inp"
        onClick={() => { if (open) commit(draft); else { setDraft(selected); setOpen(true); } }}
        style={{ width: "auto", minWidth: 150, height: 36, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", justifyContent: "space-between" }}>
        <span style={{ color: count ? "var(--ink)" : "var(--muted)", whiteSpace: "nowrap" }}>{label}{count ? " · " + count : ""}</span>
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} style={{ opacity: .6 }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", insetInlineStart: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow)", padding: 6, minWidth: 210, maxHeight: 300, overflow: "auto" }}>
          {opts.map((o) => {
            const on = draft.includes(o.v);
            return (
              <label key={o.v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--ink)" }}>
                <input type="checkbox" checked={on} onChange={() => setDraft((d) => on ? d.filter((x) => x !== o.v) : [...d, o.v])} />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CustomersTools({
  stages, owners, diplomas, specialties, batches, companies, canFinance, canMessage,
  filters, templates, sortBy, sortDir, sortOpts,
}: {
  stages: Opt[]; owners: Opt[]; diplomas: Opt[]; specialties: Opt[]; batches: Opt[]; companies: Opt[];
  canFinance: boolean; canMessage: boolean; filters: Filters; templates: Tpl[];
  sortBy?: string; sortDir?: boolean; sortOpts?: Opt[];
}) {
  const tr = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const [openBulk, setOpenBulk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nums, setNums] = useState<string[]>([]);

  function setSort(v: string) {
    const p = new URLSearchParams(sp.toString());
    const [col, dir] = v.split(":");
    if (col) p.set("sort", col); else p.delete("sort");
    if (dir) p.set("dir", dir); else p.delete("dir");
    p.delete("page");
    router.push("/customers" + (p.toString() ? "?" + p.toString() : ""));
  }
  const sortVal = (sortBy || "") + ":" + (sortDir ? "asc" : "desc");

  async function openBulkSend() {
    if (loading) return;
    setLoading(true);
    try {
      const list = await getSegmentPhones(filters);
      if (!list.length) { toast(tr("noResultsTable")); return; }
      setNums(list);
      setOpenBulk(true);
    } catch {
      toast(tr("errorOccurred"));
    } finally {
      setLoading(false);
    }
  }
  function copyNums() {
    if (navigator.clipboard) navigator.clipboard.writeText(nums.join("\n"));
    toast(tr("copied"));
  }

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <MultiSel label={tr("filterStage")} paramKey="stage" opts={stages} />
        <MultiSel label={tr("filterDip")} paramKey="dip" opts={diplomas} />
        {specialties.length > 0 && <MultiSel label={tr("filterSpec")} paramKey="spec" opts={specialties} />}
        <MultiSel label={tr("filterBatch")} paramKey="batch" opts={batches} />
        {owners.length > 0 && <MultiSel label={tr("filterOwner")} paramKey="owner" opts={owners} />}
        {companies.length > 0 && <MultiSel label={tr("filterCompany")} paramKey="company" opts={companies} />}
        {canFinance && <MultiSel label={tr("filterPay")} paramKey="pay" opts={[
          { v: "bal", label: tr("payBal") }, { v: "due", label: tr("payDue") }, { v: "overdue", label: tr("overdue") },
        ]} />}
        {sortOpts && (
          <select className="inp" style={{ width: "auto", minWidth: 130, height: 36, flex: "0 0 auto" }} value={sortVal} onChange={(e) => setSort(e.target.value)}>
            <option value="created_at:desc">{tr("sortLabel")}: {tr("sortNew")}</option>
            {sortOpts.map((o) => (
              <>
                <option key={o.v + ":asc"} value={o.v + ":asc"}>{tr("sortLabel")}: {o.label} ↑</option>
                <option key={o.v + ":desc"} value={o.v + ":desc"}>{tr("sortLabel")}: {o.label} ↓</option>
              </>
            ))}
          </select>
        )}
        {(sp.toString()) && (
          <button className="btn ghost" style={{ height: 36, padding: "0 12px", fontSize: 12.5 }} onClick={() => router.push("/customers")}>{tr("clearFilters")}</button>
        )}
        {canMessage && (
          <button className="btn wa" disabled={loading} style={{ height: 36, padding: "0 12px", fontSize: 12.5, marginInlineStart: "auto", opacity: loading ? 0.7 : 1 }} onClick={openBulkSend}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z" /></svg>
            {tr("bulkSend")}{loading ? " …" : ""}
          </button>
        )}
      </div>

      {openBulk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setOpenBulk(false)}>
          <div className="card" style={{ padding: 20, width: "min(460px,100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="sec-t" style={{ marginTop: 0 }}>{tr("bulkSend")} — {nums.length}</div>
            <div className="fld"><label>{tr("chooseTpl")}</label>
              <select className="inp" id="bulk_tpl">
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                {templates.length === 0 && <option>{tr("noTemplates")}</option>}
              </select></div>
            <div className="fld"><label>{tr("numbers")}</label>
              <textarea className="inp num" dir="ltr" rows={4} readOnly value={nums.join("\n")} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" onClick={copyNums}>{tr("copyNums")}</button>
              <button className="btn" onClick={() => { toast(tr("copied")); setOpenBulk(false); }}>{tr("done")}</button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>{tr("watiHint")}</p>
          </div>
        </div>
      )}
    </>
  );
}
