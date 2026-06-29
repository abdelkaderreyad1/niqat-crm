"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export default function AddBatch() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", start_date: "", capacity: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.code.trim()) { toast("اكتب كود الباتش"); return; }
    setBusy(true);
    const { error } = await supabase.from("batches").insert({
      code: f.code.trim(), start_date: f.start_date || null,
      capacity: f.capacity ? Number(f.capacity) : null, notes: f.notes.trim(), status: "open",
    });
    setBusy(false);
    if (error) { toast((error as any).code === "23505" ? "الكود موجود قبل كده" : "تعذّر الحفظ"); return; }
    setF({ code: "", start_date: "", capacity: "", notes: "" }); setOpen(false);
    toast("اتضاف الباتش"); router.refresh();
  }

  if (!open) return (
    <button className="btn" onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
      إضافة باتش
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setOpen(false)}>
      <div className="card" style={{ padding: 20, width: "min(440px,100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="sec-t" style={{ marginTop: 0 }}>باتش جديد</div>
        <div className="frow">
          <div className="fld"><label>الكود</label><input className="inp num" dir="ltr" placeholder="B25" value={f.code} onChange={(e) => set("code", e.target.value)} /></div>
          <div className="fld"><label>السعة</label><input className="inp num" dir="ltr" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>
        </div>
        <div className="fld"><label>تاريخ البدء</label><input className="inp num" type="date" dir="ltr" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
        <div className="fld"><label>ملاحظات</label><input className="inp" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={save} disabled={busy}>{busy ? "..." : "حفظ"}</button>
          <button className="btn ghost" onClick={() => setOpen(false)}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
