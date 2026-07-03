"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export default function AddBatch({ diplomas = [] }: { diplomas?: { id: string; name: string }[] }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", diploma_id: "", start_date: "", end_date: "", capacity: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.code.trim()) { toast(tr("enterBatchNo")); return; }
    setBusy(true);
    const base: any = {
      code: f.code.trim(), start_date: f.start_date || null,
      capacity: f.capacity ? Number(f.capacity) : null, notes: f.notes.trim(), status: "open",
    };
    const full = { ...base, end_date: f.end_date || null, diploma_id: f.diploma_id || null };
    let error = (await supabase.from("batches").insert(full)).error;
    if (error && /end_date|diploma_id/.test((error as any).message || "")) {
      error = (await supabase.from("batches").insert(base)).error; // أعمدة لسه مش موجودة
    }
    setBusy(false);
    if (error) { toast((error as any).code === "23505" ? tr("codeExists") : tr("saveFailed")); return; }
    setF({ code: "", diploma_id: "", start_date: "", end_date: "", capacity: "", notes: "" }); setOpen(false);
    toast(tr("batchAdded")); router.refresh();
  }

  if (!open) return (
    <button className="btn" onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
      {tr("addBatch")}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setOpen(false)}>
      <div className="card" style={{ padding: 20, width: "min(440px,100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="sec-t" style={{ marginTop: 0 }}>{tr("newBatch")}</div>
        <div className="fld"><label>{tr("theDiploma")}</label>
          <select className="inp" value={f.diploma_id} onChange={(e) => set("diploma_id", e.target.value)}>
            <option value="">{tr("selectDiplomaDash")}</option>
            {diplomas.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div className="frow">
          <div className="fld"><label>{tr("batchNo")}</label><input className="inp num" dir="ltr" placeholder="B22" value={f.code} onChange={(e) => set("code", e.target.value)} /></div>
          <div className="fld"><label>{tr("capacity")}</label><input className="inp num" dir="ltr" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>
        </div>
        <div className="frow">
          <div className="fld"><label>{tr("startDate")}</label><input className="inp num" type="date" dir="ltr" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
          <div className="fld"><label>{tr("endDate")}</label><input className="inp num" type="date" dir="ltr" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
        </div>
        <div className="fld"><label>{tr("notes")}</label><input className="inp" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={save} disabled={busy}>{busy ? "..." : tr("save")}</button>
          <button className="btn ghost" onClick={() => setOpen(false)}>{tr("cancel")}</button>
        </div>
      </div>
    </div>
  );
}
