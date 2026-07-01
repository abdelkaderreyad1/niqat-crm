"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChecklistToggle({
  items: initial, handoffId,
}: {
  items: { id: string; done: boolean }[];
  handoffId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(initial);
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function toggle(it: { id: string; done: boolean }) {
    const next = !it.done;
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, done: next } : x)));
    const { error } = await supabase.from("handoff_items").update({ done: next }).eq("id", it.id);
    if (error) {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, done: !next } : x)));
    } else {
      router.refresh();
    }
  }

  if (total === 0) return null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
        <span style={{ fontWeight: 700 }}>التفعيل</span>
        <span className="num">{done}/{total}</span>
      </div>
      <div className="prog" style={{ marginBottom: 10 }}>
        <i style={{ width: pct + "%", background: pct === 100 ? "var(--green)" : "var(--brand)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
        {items.map((it, idx) => (
          <div
            key={it.id}
            className={`task ${it.done ? "done" : ""}`}
            style={{ padding: "7px 10px", cursor: "pointer" }}
            onClick={() => toggle(it)}
          >
            <div className={`cb ${it.done ? "on" : ""}`}>
              {it.done && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
            <div className="tt" style={{ fontSize: 12.5 }}>بند {idx + 1}</div>
          </div>
        ))}
      </div>
    </>
  );
}
