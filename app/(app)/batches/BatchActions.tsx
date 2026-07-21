"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

type Batch = {
  id: string; code: string; status: string;
  start_date: string | null; end_date: string | null;
  capacity: number | null; notes: string | null;
  price: number | null; currency: string | null;
  price_egp?: number | null; price_usd?: number | null;
};

export default function BatchActions({ batch, enrolledCount, diplomas = [] }: {
  batch: Batch; enrolledCount: number; diplomas?: { id: string; name: string }[];
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<null | "edit" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    code: batch.code || "", start_date: batch.start_date || "", end_date: batch.end_date || "",
    capacity: batch.capacity != null ? String(batch.capacity) : "", notes: batch.notes || "",
    price_egp: batch.price_egp != null ? String(batch.price_egp) : "", price_usd: batch.price_usd != null ? String(batch.price_usd) : "",
    status: batch.status || "open",
  });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function saveEdit() {
    if (!f.code.trim()) { toast(tr("enterBatchNo")); return; }
    const pe = Number(f.price_egp), pu = Number(f.price_usd);
    if (!(pe > 0) || !(pu > 0)) { toast("من فضلك أدخل السعر بالجنيه والدولار (الاتنين إجباري)"); return; }
    setBusy(true);
    const { error } = await supabase.from("batches").update({
      code: f.code.trim(),
      start_date: f.start_date || null,
      end_date: f.end_date || null,
      capacity: f.capacity ? Number(f.capacity) : null,
      notes: f.notes.trim(),
      price_egp: pe,
      price_usd: pu,
      price: pe,
      currency: "EGP",
      status: f.status,
    }).eq("id", batch.id);
    setBusy(false);
    if (error) { toast((error as any).code === "23505" ? tr("codeExists") : tr("saveFailed")); return; }
    setMode(null);
    toast(tr("batchUpdated")); router.refresh();
  }

  async function doDelete() {
    // أمان مزدوج: لو فيه عملاء ممنوع الحذف نهائياً
    if (enrolledCount > 0) { toast(tr("batchHasCustomers")); return; }
    setBusy(true);
    const { error } = await supabase.from("batches").delete().eq("id", batch.id);
    setBusy(false);
    if (error) { toast(tr("deleteFailed")); return; }
    setMode(null);
    toast(tr("batchDeleted")); router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <button onClick={() => setMode("edit")} className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 12.5, flex: 1, justifyContent: "center" }}>
          ✏️ {tr("edit")}
        </button>
        <button onClick={() => setMode("delete")} className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 12.5, color: "var(--red)" }}>
          🗑️ {tr("delete")}
        </button>
      </div>

      {/* نافذة التعديل */}
      {mode === "edit" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setMode(null)}>
          <div className="card" style={{ padding: 20, width: "min(440px,100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="sec-t" style={{ marginTop: 0 }}>{tr("editBatch")}</div>
            <div className="frow">
              <div className="fld"><label>{tr("batchNo")}</label><input className="inp num" dir="ltr" value={f.code} onChange={(e) => set("code", e.target.value)} /></div>
              <div className="fld"><label>{tr("capacity")}</label><input className="inp num" dir="ltr" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>
            </div>
            <div className="frow">
              <div className="fld"><label>{tr("startDate")}</label><input className="inp num" type="date" dir="ltr" value={f.start_date ? String(f.start_date).slice(0, 10) : ""} onChange={(e) => set("start_date", e.target.value)} /></div>
              <div className="fld"><label>{tr("endDate")}</label><input className="inp num" type="date" dir="ltr" value={f.end_date ? String(f.end_date).slice(0, 10) : ""} onChange={(e) => set("end_date", e.target.value)} /></div>
            </div>
            <div className="frow">
              <div className="fld"><label>{tr("batchPrice")} — {tr("egpShort")}</label>
                <input className="inp num" dir="ltr" inputMode="numeric" value={f.price_egp} onChange={(e) => set("price_egp", e.target.value)} /></div>
              <div className="fld"><label>{tr("batchPrice")} — $</label>
                <input className="inp num" dir="ltr" inputMode="numeric" value={f.price_usd} onChange={(e) => set("price_usd", e.target.value)} /></div>
            </div>
            <div className="fld"><label>{tr("status")}</label>
              <select className="inp" value={f.status} onChange={(e) => set("status", e.target.value)}>
                <option value="open">{tr("batchOpen")}</option>
                <option value="closed">{tr("batchEnded")}</option>
              </select>
            </div>
            <div className="fld"><label>{tr("notes")}</label><input className="inp" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={saveEdit} disabled={busy}>{busy ? "..." : tr("save")}</button>
              <button className="btn ghost" onClick={() => setMode(null)}>{tr("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الحذف مع التحذير */}
      {mode === "delete" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setMode(null)}>
          <div className="card" style={{ padding: 22, width: "min(420px,100%)" }} onClick={(e) => e.stopPropagation()}>
            {enrolledCount > 0 ? (
              <>
                <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>⚠️</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--red)", textAlign: "center", marginBottom: 10 }}>
                  {tr("cannotDeleteBatch")}
                </div>
                <div style={{ fontSize: 13.5, color: "var(--ink)", textAlign: "center", lineHeight: 1.7, marginBottom: 16 }}>
                  {tr("batchHasCustomersLong1")} <b style={{ color: "var(--red)" }}>{enrolledCount}</b> {tr("batchHasCustomersLong2")}
                </div>
                <button className="btn ghost" onClick={() => setMode(null)} style={{ width: "100%", justifyContent: "center" }}>{tr("understood")}</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>🗑️</div>
                <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center", marginBottom: 10 }}>
                  {tr("confirmDeleteBatch")}
                </div>
                <div style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", marginBottom: 16 }}>
                  «{batch.code}» — {tr("deleteBatchIrreversible")}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={doDelete} disabled={busy} style={{ flex: 1, justifyContent: "center", background: "var(--red)" }}>
                    {busy ? "..." : tr("confirmDelete")}
                  </button>
                  <button className="btn ghost" onClick={() => setMode(null)} style={{ flex: 1, justifyContent: "center" }}>{tr("cancel")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
