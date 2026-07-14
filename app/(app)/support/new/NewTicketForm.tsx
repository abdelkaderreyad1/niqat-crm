"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

type Cust = { id: string; name: string; phone1?: string; phone2?: string; email?: string };

const PRIOS = [
  { key: "high" },
  { key: "medium" },
  { key: "low" },
];

export default function NewTicketForm({
  presetCustomer, presetCustomerName = "", problems = [],
}: {
  presetCustomer: string; presetCustomerName?: string; problems?: string[];
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();

  const [customerId, setCustomerId] = useState(presetCustomer || "");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState(presetCustomerName || "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [results, setResults] = useState<Cust[]>([]);
  const [searching, setSearching] = useState(false);

  const locked = !!presetCustomer;

  // بحث من السيرفر مباشرة — بيدوّر في كل العملاء (مش محدود بـ 1000)، بالاسم/الإيميل/الرقم (آخر ٩ أرقام)
  useEffect(() => {
    if (locked || customerId) return;       // مقفول على preset أو اختار عميل بالفعل
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
  }, [search, customerId, locked, supabase]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function create() {
    setErr("");
    if (!customerId) { setErr(tr("selectCustomerFirst")); return; }
    if (!title.trim()) { setErr(tr("enterSubject")); return; }
    setSaving(true);
    const { data, error } = await supabase.from("tickets").insert({
      customer_id: customerId, title: title.trim(), priority, status: "open", archived: false,
    }).select("id").single();
    if (error) { setSaving(false); setErr(tr("createFailed") + error.message); return; }
    const tt = title.trim();
    if (tt && !problems.some((p) => p.toLowerCase() === tt.toLowerCase())) {
      const next = [...problems, tt].slice(-50);
      await supabase.from("app_settings").upsert({ key: "ticket_problems", value: next, updated_at: new Date().toISOString() });
    }
    setSaving(false);
    router.push(`/support/${data!.id}`);
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 560 }}>
      <div className="fld">
        <label>{tr("customer")}</label>
        <div ref={ref} style={{ position: "relative" }}>
          <input className="inp" value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); if (!locked) setCustomerId(""); }}
            onFocus={() => setOpen(true)} placeholder={tr("selectCustomer")} disabled={locked}
            style={{ width: "100%", boxSizing: "border-box", ...(locked ? { background: "var(--muted-soft)" } : {}) }} />
          {open && !locked && (search.trim() !== "") && (
            <div className="suggest-drop" style={{ position: "absolute", top: "100%", left: 0, right: 0 }}>
              {searching ? (
                <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>…</div>
              ) : results.length === 0 ? (
                <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>{tr("noResults")}</div>
              ) : results.map((c) => (
                <div key={c.id} className="suggest-item" onClick={() => { setCustomerId(c.id); setSearch(c.name); setOpen(false); }}>
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

      {problems.length > 0 && (
        <div className="fld">
          <label>{tr("frequentIssues")}</label>
          <select className="inp" value="" onChange={(e) => e.target.value && setTitle(e.target.value)}>
            <option value="">{tr("selectSavedIssue")}</option>
            {problems.map((p, i) => <option key={i} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      <div className="fld">
        <label>{tr("subject")}</label>
        <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} list="probs"
          placeholder={tr("subjectPlaceholder")} />
        <datalist id="probs">{problems.map((p, i) => <option key={i} value={p} />)}</datalist>
      </div>

      <div className="fld">
        <label>{tr("priority")}</label>
        <select className="inp" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIOS.map((p) => <option key={p.key} value={p.key}>{tr(p.key)}</option>)}
        </select>
      </div>

      {err && <div style={{ fontSize: 13, color: "var(--red)", marginBottom: 10 }}>{err}</div>}

      <button onClick={create} disabled={saving} className="btn">
        {saving ? tr("creating") : tr("newTicket")}
      </button>
    </div>
  );
}
