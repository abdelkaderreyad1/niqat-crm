"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type T = {
  id: string; title: string; due: string; done: boolean;
  custId: string; custName: string; phone: string; assignee: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const waLink = (p: string) => "https://wa.me/" + (p || "").replace(/[^\d]/g, "");

export default function TaskList({ initial }: { initial: T[] }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [tasks, setTasks] = useState<T[]>(initial);

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
          <p>{openCount} مهمة مفتوحة</p>
        </div>
      </div>
      {tasks.length === 0 ? (
        <div className="empty"><b>لا توجد مهام</b></div>
      ) : (
        <>
          {Grp("متأخرة", od, "var(--red)")}
          {Grp("اليوم", td, "var(--green)")}
          {Grp("قادمة", up)}
          {Grp("منتهية", dn, "var(--muted)")}
        </>
      )}
    </div>
  );
}
