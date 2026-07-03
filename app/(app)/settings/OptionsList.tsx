"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Item = { id: string; label: string };

export default function OptionsList({
  title, hint, table, labelCol, initial,
}: {
  title: string; hint: string; table: string; labelCol: string; initial: Item[];
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>(initial);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const v = val.trim();
    if (!v) return;
    if (items.some((i) => i.label === v)) { toast(tr("alreadyExists")); return; }
    setBusy(true);
    const { data, error } = await (supabase.from(table) as any).insert({ [labelCol]: v }).select("id").single();
    setBusy(false);
    if (error) { toast(tr("addFailedShort")); return; }
    setItems((s) => [...s, { id: data!.id, label: v }]);
    setVal(""); toast(tr("added"));
  }

  async function del(it: Item) {
    if (!confirm(`${tr("deleteQ")} «${it.label}»?`)) return;
    setItems((s) => s.filter((x) => x.id !== it.id));
    const { error } = await (supabase.from(table) as any).delete().eq("id", it.id);
    if (error) { toast(tr("deleteFailed")); router.refresh(); return; }
    toast(tr("deletedM"));
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <div className="card-h"><h3>{title}</h3></div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 12px" }}>{hint}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {items.length === 0 && <span style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noItemsYet")}</span>}
        {items.map((it) => (
          <span key={it.id} className="opt-chip">
            {it.label}
            <button onClick={() => del(it)} title={tr("delete")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} style={{ width: 13, height: 13 }}><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </span>
        ))}
      </div>
      <div className="withadd">
        <input className="inp" value={val} placeholder={tr("addNewItem")}
          onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="addbtn" onClick={add} disabled={busy} type="button">{tr("add")}</button>
      </div>
    </div>
  );
}
