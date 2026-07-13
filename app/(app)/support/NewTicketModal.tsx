"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

type Cust = { id: string; name: string; phone1?: string; phone2?: string; email?: string };
const PRIOS = [
  { key: "high", labelKey: "priorityHigh" },
  { key: "medium", labelKey: "priorityMedium" },
  { key: "low", labelKey: "priorityLow" },
];

export default function NewTicketModal({
  open, onClose, problems = [],
}: {
  open: boolean; onClose: () => void; problems?: string[];
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const [results, setResults] = useState<Cust[]>([]);
  const [searching, setSearching] = useState(false);

  // بحث من السيرفر مباشرة — بيدوّر في كل العملاء (مش محدود بـ 1000)، بالاسم/الإيميل/الرقم (آخر ٩ أرقام)
  useEffect(() => {
    if (customerId) return;                 // اختار عميل بالفعل
    const raw = search.trim();
    if (!raw) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const tid = setTimeout(async () => {
      const safe = raw.replace(/[,()%]/g, " ").trim();
      const digits = raw.replace(/\D/g, "");
      const conds: string[] = [];
      if (safe) conds.push(`name.ilike.%${safe}%`, `email.ilike.%${safe}%`);
      if (digits.length >= 3) {
        const d9 = digits.slice(-9);        // يطابق 01xxx و 201xxx معاً
        conds.push(`phone1.ilike.%${d9}%`, `phone2.ilike.%${d9}%`);
      } else if (safe) {
        conds.push(`phone1.ilike.%${safe}%`, `phone2.ilike.%${safe}%`);
      }
      const { data } = await supabase.from("customers")
        .select("id,name,phone1,phone2,email").or(conds.join(",")).limit(20);
      if (!cancelled) { setResults((data as Cust[]) || []); setSearching(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(tid); };
  }, [search, customerId, supabase]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const create = useCallback(async () => {
    setErr("");
    if (!customerId) { setErr(tr("selectCustomerFirst")); return; }
    if (!title.trim()) { setErr(tr("enterSubject")); return; }
    setSaving(true);
    const { error } = await supabase.from("tickets").insert({
      customer_id: customerId, title: title.trim(), priority, status: "open", archived: false,
    }).select("id").single();
    if (error) { setSaving(false); setErr(tr("createFailed") + error.message); return; }
    const tt = title.trim();
    if (tt && !problems.some((p) => p.toLowerCase() === tt.toLowerCase())) {
      const next = [...problems, tt].slice(-50);
      await supabase.from("app_settings").upsert({ key: "ticket_problems", value: next, updated_at: new Date().toISOString() });
    }
    setSaving(false);
    setCustomerId(""); setSearch(""); setTitle(""); setPriority("medium");
    onClose();
    router.refresh();
  }, [customerId, title, priority, problems, supabase, onClose, router]);

  if (!open) return null;

  return (
    <>
      <div className="scrim show" onClick={onClose} />
      <div className="modal show" role="dialog" aria-modal="true">
        <div className="modal-h">
          <h3>{tr("newTicket")}</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-b">
          <div className="fld">
            <label>{tr("customer")}</label>
            <div ref={ref} style={{ position: "relative" }}>
              <input className="inp" value={search}
                onChange={(e) => { setSearch(e.target.value); setDropOpen(true); setCustomerId(""); }}
                onFocus={() => setDropOpen(true)} placeholder={tr("searchCustomerPh")}
                style={{ width: "100%", boxSizing: "border-box" }} />
              {dropOpen && (search.trim() !== "") && (
                <div className="suggest-drop" style={{ position: "absolute", top: "100%", left: 0, right: 0 }}>
                  {searching ? (
                    <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>…</div>
                  ) : results.length === 0 ? (
                    <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>{tr("noResults")}</div>
                  ) : results.map((c) => (
                    <div key={c.id} className="suggest-item" onClick={() => { setCustomerId(c.id); setSearch(c.name); setDropOpen(false); }}>
                      <span>{c.name}</span>
                      <span>
                        {c.phone1 && <span dir="ltr">{c.phone1}</span>}
                        {c.email && <span>{c.email}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="fld">
            <label>{tr("subject")}</label>
            <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} list="probs_modal"
              placeholder={tr("subjectPlaceholder")} />
            <datalist id="probs_modal">{problems.map((p, i) => <option key={i} value={p} />)}</datalist>
          </div>
          <div className="fld">
            <label>{tr("priority")}</label>
            <select className="inp" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIOS.map((p) => <option key={p.key} value={p.key}>{tr(p.labelKey)}</option>)}
            </select>
          </div>
          {err && <div style={{ fontSize: 13, color: "var(--red)" }}>{err}</div>}
        </div>
        <div className="modal-f">
          <button className="btn ghost" type="button" onClick={onClose}>{tr("cancel")}</button>
          <button className="btn" type="button" disabled={saving} style={{ marginInlineStart: "auto" }} onClick={create}>
            {saving ? tr("creating") : tr("createTicket")}
          </button>
        </div>
      </div>
    </>
  );
}
