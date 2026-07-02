"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; label: string; done: boolean; done_by: string | null; done_at: string | null };
type Handoff = { id: string; status: string; note: string; assignee: string; by: string; at: string } | null;
type Opt = { id: string; label: string };

export default function AccessPanel({
  customerId, handoff, items, accessOptions, libraries, meId, meName,
}: {
  customerId: string; handoff: Handoff; items: Item[];
  accessOptions: Opt[]; libraries: { id: string; name: string }[]; meId: string; meName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>(accessOptions.map((o) => o.label));
  const [libSel, setLibSel] = useState("");

  async function addLibrary() {
    const name = libSel.trim();
    if (!name || !handoff) return;
    setBusy("lib");
    const { error } = await supabase.from("handoff_items").insert({ handoff_id: handoff.id, label: "مكتبة: " + name, done: false });
    if (!error) await supabase.from("handoffs").update({ status: "pending" }).eq("id", handoff.id);
    setBusy(null);
    if (error) { alert("تعذّر إضافة المكتبة: " + error.message); return; }
    setLibSel("");
    router.refresh();
  }

  async function toggle(it: Item) {
    setBusy(it.id);
    const nowDone = !it.done;
    const { error } = await supabase.from("handoff_items").update({
      done: nowDone, done_by: nowDone ? meId : null, done_at: nowDone ? new Date().toISOString() : null,
    }).eq("id", it.id);
    if (!error && handoff) {
      const allDone = items.every((x) => (x.id === it.id ? nowDone : x.done));
      await supabase.from("handoffs").update({ status: allDone ? "done" : "pending" }).eq("id", handoff.id);
    }
    setBusy(null);
    if (error) { alert("تعذّر التحديث: " + error.message); return; }
    router.refresh();
  }

  async function requestHandoff() {
    if (picked.length === 0) { alert("اختر بند أكسس واحد على الأقل."); return; }
    setBusy("new");
    const { data: h, error } = await supabase.from("handoffs").insert({
      customer_id: customerId, created_by: meId, note: note.trim(), status: "pending",
    }).select("id").single();
    if (error || !h) { setBusy(null); alert("تعذّر إنشاء التسليم: " + (error?.message || "")); return; }
    const rows = picked.map((label) => ({ handoff_id: h.id, label, done: false }));
    const { error: e2 } = await supabase.from("handoff_items").insert(rows);
    setBusy(null);
    if (e2) { alert("تعذّر إضافة بنود الأكسس: " + e2.message); return; }
    setNote("");
    router.refresh();
  }

  const done = items.filter((i) => i.done).length;

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="sec-t" style={{ margin: 0 }}>التفعيل والاعتمادات</div>
        {handoff && (
          <span className="stg" style={
            handoff.status === "done"
              ? { background: "#18A95722", color: "#18A957" }
              : { background: "#E6A70022", color: "#B8860B" }
          }>
            {handoff.status === "done" ? "مكتمل ✓" : "في انتظار التفعيل والاعتماد"}
          </span>
        )}
      </div>

      {!handoff ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
            العميل لسه ماتسلّمش للدعم. علّم الدبلومة اللي هتتفعّل وبنود التفعيل والاعتماد المطلوبة وحوّله.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {accessOptions.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>مفيش خيارات أكسس معرّفة (تتضاف من الإعدادات).</div>}
            {accessOptions.map((o) => {
              const on = picked.includes(o.label);
              return (
                <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={on}
                    onChange={() => setPicked((p) => on ? p.filter((x) => x !== o.label) : [...p, o.label])} />
                  {o.label}
                </label>
              );
            })}
          </div>
          <div className="fld">
            <label>ملاحظة للدعم</label>
            <textarea className="inp" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button onClick={requestHandoff} disabled={busy === "new"} className="btn">
            {busy === "new" ? "..." : "تحويل للدعم"}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
            {done}/{items.length} بند مكتمل
            {handoff.assignee ? <> · المكلّف: <b>{handoff.assignee}</b></> : null}
          </div>
          {handoff.note && (
            <div style={{ fontSize: 13, background: "rgba(240,138,36,.07)", border: "1px solid var(--line)", borderRadius: 8, padding: 8, marginBottom: 10 }}>
              📝 {handoff.note}
            </div>
          )}
          {libraries.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select className="inp" value={libSel} onChange={(e) => setLibSel(e.target.value)}>
                <option value="">+ إضافة مكتبة للـ checklist…</option>
                {libraries.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
              <button className="btn ghost" type="button" disabled={!libSel || busy === "lib"} onClick={addLibrary}>إضافة</button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it) => (
              <label key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", opacity: busy === it.id ? 0.5 : 1 }}>
                <input type="checkbox" checked={it.done} onChange={() => toggle(it)} disabled={busy === it.id} />
                <span style={{ flex: 1, fontWeight: 600, textDecoration: it.done ? "line-through" : "none", color: it.done ? "var(--muted)" : "var(--ink)" }}>{it.label}</span>
                {it.done && it.done_by && <span style={{ fontSize: 11, color: "var(--green)" }}>فعّلها {it.done_by}</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
