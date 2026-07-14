"use client";
import { useState, useRef, useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "../EmptyState";

type T = {
  id: string; title: string; due: string; done: boolean;
  custId: string; custName: string; phone: string; assignee: string;
};
type Person = { id: string; name: string };
type Cust = { id: string; name: string; phone1?: string; phone2?: string; email?: string };
const today = () => new Date().toISOString().slice(0, 10);
const waLink = (p: string) => "https://wa.me/" + (p || "").replace(/[^\d]/g, "");

export default function TaskList({ initial, meId, people = [] }: { initial: T[]; meId: string; people?: Person[] }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [tasks, setTasks] = useState<T[]>(initial);
  const [nt, setNt] = useState("");
  const [ntDue, setNtDue] = useState("");
  const [adding, setAdding] = useState(false);

  // ربط بعميل (بحث سيرفر) + تكليف موظف
  const [assigneeId, setAssigneeId] = useState(meId);
  const [custId, setCustId] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [custResults, setCustResults] = useState<Cust[]>([]);
  const [custOpen, setCustOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const custRef = useRef<HTMLDivElement>(null);
  const meName = people.find((p) => p.id === meId)?.name || "";

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setCustOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // بحث العملاء من السيرفر (كل العملاء، مش محدود بـ 1000): اسم/إيميل/رقم (آخر ٩ أرقام)
  useEffect(() => {
    if (custId) return;
    const raw = custSearch.trim();
    if (!raw) { setCustResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const tid = setTimeout(async () => {
      const safe = raw.replace(/[,()%]/g, " ").trim();
      const digits = raw.replace(/\D/g, "");
      const conds: string[] = [];
      if (safe) conds.push(`name.ilike.%${safe}%`, `email.ilike.%${safe}%`);
      if (digits.length >= 3) { const d9 = digits.slice(-9); conds.push(`phone1.ilike.%${d9}%`, `phone2.ilike.%${d9}%`); }
      else if (safe) conds.push(`phone1.ilike.%${safe}%`, `phone2.ilike.%${safe}%`);
      const { data } = await supabase.from("customers").select("id,name,phone1,phone2,email").or(conds.join(",")).limit(20);
      if (!cancelled) { setCustResults((data as Cust[]) || []); setSearching(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(tid); };
  }, [custSearch, custId, supabase]);

  async function addMine() {
    const title = nt.trim();
    if (!title) return;
    setAdding(true);
    const { data, error } = await supabase.from("tasks")
      .insert({ title, assignee_id: assigneeId || meId, customer_id: custId || null, due_at: ntDue ? new Date(ntDue).toISOString() : null, done: false })
      .select("id").maybeSingle();
    setAdding(false);
    if (error || !data) return;
    const cust = custResults.find((c) => c.id === custId);
    setTasks((l) => [{
      id: data.id as string, title, due: ntDue || "", done: false,
      custId: custId || "", custName: cust?.name || "", phone: cust?.phone1 || "",
      assignee: people.find((p) => p.id === (assigneeId || meId))?.name || "",
    }, ...l]);
    setNt(""); setNtDue(""); setCustId(""); setCustSearch(""); setCustResults([]); setAssigneeId(meId);
  }

  async function toggle(id: string) {
    const cur = tasks.find((t) => t.id === id);
    if (!cur) return;
    const next = !cur.done;
    setTasks((l) => l.map((t) => (t.id === id ? { ...t, done: next } : t)));
    const { error } = await supabase.from("tasks").update({ done: next }).eq("id", id);
    if (error) setTasks((l) => l.map((t) => (t.id === id ? { ...t, done: cur.done } : t)));
  }

  const t0 = today();
  const od = tasks.filter((k) => !k.done && k.due && k.due < t0);
  const td = tasks.filter((k) => !k.done && k.due === t0);
  const up = tasks.filter((k) => !k.done && (!k.due || k.due > t0));
  const dn = tasks.filter((k) => k.done);
  const openCount = tasks.filter((k) => !k.done).length;

  const Row = (k: T) => (
    <div key={k.id} className={"task" + (k.done ? " done" : "")}>
      <div className={"cb" + (k.done ? " on" : "")} onClick={() => toggle(k.id)}>
        {k.done ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 12l5 5L20 7" />
          </svg>
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tt">{k.title}</div>
        <div className="tinfo">
          {k.custName && (
            <span
              style={{ color: "var(--blue)", cursor: "pointer", fontWeight: 700 }}
              onClick={() => router.push(`/customers/${k.custId}`)}
            >
              {k.custName}
            </span>
          )}
          {k.due && <span className="num">{k.due}</span>}
          {k.assignee && <span>{k.assignee}</span>}
        </div>
      </div>
      {k.phone && (
        <a className="btn wa sm" style={{ textDecoration: "none" }} href={waLink(k.phone)} target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.6-4A8 8 0 1 1 20 11.5z"/></svg>
        </a>
      )}
    </div>
  );

  const Grp = (title: string, arr: T[], color?: string) =>
    arr.length ? (
      <div key={title}>
        <div className="sec-t" style={{ color: color || "var(--brand)" }}>
          {title} ({arr.length})
        </div>
        {arr.map(Row)}
      </div>
    ) : null;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("myTasks")}</h1>
          <p>{openCount} {tr("openTasks")}</p>
        </div>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className="inp" placeholder={tr("newTaskPh")} style={{ flex: 1, minWidth: 180 }} value={nt}
          onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMine()} />

        {/* ربط بعميل (اختياري) — بحث سيرفر */}
        <div ref={custRef} style={{ position: "relative", minWidth: 190, flex: "0 1 220px" }}>
          <input className="inp" placeholder={tr("linkCustomerOpt")} value={custSearch}
            onChange={(e) => { setCustSearch(e.target.value); setCustOpen(true); setCustId(""); }}
            onFocus={() => setCustOpen(true)} style={{ width: "100%", boxSizing: "border-box" }} />
          {custOpen && custSearch.trim() !== "" && (
            <div className="suggest-drop" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20 }}>
              {searching ? (
                <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>…</div>
              ) : custResults.length === 0 ? (
                <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>{tr("noResults")}</div>
              ) : custResults.map((c) => (
                <div key={c.id} className="suggest-item" onClick={() => { setCustId(c.id); setCustSearch(c.name); setCustOpen(false); }}>
                  <span>{c.name}</span>
                  <span>{c.phone1 && <span dir="ltr">{c.phone1}</span>}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* تكليف موظف */}
        {people.length > 0 && (
          <select className="inp" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={{ width: 160 }}>
            {!people.some((p) => p.id === meId) && <option value={meId}>{meName || tr("me")}</option>}
            {people.map((p) => <option key={p.id} value={p.id}>{p.id === meId ? (p.name + " (" + tr("me") + ")") : p.name}</option>)}
          </select>
        )}

        <input className="inp num" type="date" dir="ltr" style={{ width: 150 }} value={ntDue} onChange={(e) => setNtDue(e.target.value)} />
        <button className="btn" onClick={addMine} disabled={adding} style={{ height: 40 }}>{adding ? "..." : tr("add")}</button>
      </div>
      {tasks.length === 0 ? (
        <EmptyState text={tr("funNoTasks")} />
      ) : (
        <>
          {Grp(tr("overdueTasks"), od, "var(--red)")}
          {Grp(tr("todayTasks"), td, "var(--green)")}
          {Grp(tr("upcomingTasks"), up)}
          {Grp(tr("doneTasks"), dn, "var(--muted)")}
        </>
      )}
    </div>
  );
}
