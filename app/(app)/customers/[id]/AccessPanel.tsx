"use client";
import { useState, useMemo } from "react";
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
  const [picked, setPicked] = useState<string[]>([]);   // يبدأ فاضي
  const [q, setQ] = useState("");                        // بحث/كتابة
  const [openAdd, setOpenAdd] = useState(false);         // فتح لوحة التحويل مع وجود handoff

  // البنود المتاحة = خيارات الأكسس + عناصر العميل، ناقص اللي اتبعت قبل كده
  const alreadySent = useMemo(() => new Set(items.map((i) => i.label)), [items]);
  const available = useMemo(
    () => accessOptions.filter((o) => !alreadySent.has(o.label)),
    [accessOptions, alreadySent]
  );
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return available.filter((o) => !s || o.label.toLowerCase().includes(s));
  }, [available, q]);

  function toggle(label: string) {
    setPicked((p) => p.includes(label) ? p.filter((x) => x !== label) : [...p, label]);
  }
  function addCustom() {
    const v = q.trim();
    if (!v) return;
    if (!picked.includes(v)) setPicked((p) => [...p, v]);
    setQ("");
  }

  async function toggleDone(it: Item) {
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

  // تحويل جديد: ينشئ handoff لو مفيش، أو يضيف بنود للموجود
  async function sendToSupport() {
    if (picked.length === 0) { alert("اختر بند واحد على الأقل تفعّله."); return; }
    setBusy("send");
    let hoId = handoff?.id;
    if (!hoId) {
      const { data: h, error } = await supabase.from("handoffs").insert({
        customer_id: customerId, created_by: meId, note: note.trim(), status: "pending",
      }).select("id").single();
      if (error || !h) { setBusy(null); alert("تعذّر إنشاء التسليم: " + (error?.message || "")); return; }
      hoId = h.id;
    } else if (note.trim()) {
      await supabase.from("handoffs").update({ note: note.trim(), status: "pending" }).eq("id", hoId);
    } else {
      await supabase.from("handoffs").update({ status: "pending" }).eq("id", hoId);
    }
    const rows = picked.map((label) => ({ handoff_id: hoId, label, done: false }));
    const { error: e2 } = await supabase.from("handoff_items").insert(rows);
    setBusy(null);
    if (e2) { alert("تعذّر إضافة البنود: " + e2.message); return; }
    setNote(""); setPicked([]); setQ(""); setOpenAdd(false);
    router.refresh();
  }

  const done = items.filter((i) => i.done).length;

  // لوحة اختيار البنود (combobox فاضي) — تُستخدم في الحالتين
  const picker = (
    <div style={{ marginTop: 10 }}>
      <div className="fld">
        <label>اكتب أو اختر اللي عايز تفعّله للعميل</label>
        <input className="inp" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="ابحث باسم الدبلومة/الاعتماد/المشروع… أو اكتب بند جديد" />
      </div>

      {/* المختار */}
      {picked.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {picked.map((p) => (
            <span key={p} className="stg" style={{ background: "var(--brand-soft)", color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {p}
              <b style={{ cursor: "pointer" }} onClick={() => toggle(p)}>×</b>
            </span>
          ))}
        </div>
      )}

      {/* الاقتراحات */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 190, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 6 }}>
        {filtered.length === 0 && q.trim() && (
          <button type="button" onClick={addCustom} style={{ textAlign: "start", fontSize: 13, color: "var(--brand)", fontWeight: 700, padding: "6px 8px", background: "none" }}>
            + إضافة «{q.trim()}» كبند جديد
          </button>
        )}
        {filtered.length === 0 && !q.trim() && (
          <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "6px 8px" }}>كل العناصر اتبعتت للدعم، أو مفيش عناصر — اكتب بند جديد فوق.</div>
        )}
        {filtered.map((o) => {
          const on = picked.includes(o.label);
          return (
            <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", padding: "5px 8px", borderRadius: 6, background: on ? "var(--brand-soft)" : "transparent" }}>
              <input type="checkbox" checked={on} onChange={() => toggle(o.label)} />
              {o.label}
            </label>
          );
        })}
      </div>

      <div className="fld" style={{ marginTop: 10 }}>
        <label>ملاحظة للدعم (اختياري)</label>
        <textarea className="inp" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={sendToSupport} disabled={busy === "send"} className="btn">
          {busy === "send" ? "..." : (handoff ? "إرسال البنود للدعم" : "تحويل للدعم")}
        </button>
        {handoff && <button onClick={() => { setOpenAdd(false); setPicked([]); setQ(""); }} className="btn ghost">إلغاء</button>}
      </div>
    </div>
  );

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
        <>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
            العميل لسه ماتسلّمش للدعم. اختار العناصر اللي هتتفعّل (كل عنصر باسمه) وحوّله للدعم.
          </div>
          {picker}
        </>
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

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it) => (
              <label key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", opacity: busy === it.id ? 0.5 : 1 }}>
                <input type="checkbox" checked={it.done} onChange={() => toggleDone(it)} disabled={busy === it.id} />
                <span style={{ flex: 1, fontWeight: 600, textDecoration: it.done ? "line-through" : "none", color: it.done ? "var(--muted)" : "var(--ink)" }}>{it.label}</span>
                {it.done && it.done_by && <span style={{ fontSize: 11, color: "var(--green)" }}>فعّلها {it.done_by}</span>}
              </label>
            ))}
          </div>

          {/* زر تحويل عناصر جديدة — يفضل ظاهر دايمًا */}
          {!openAdd ? (
            <button onClick={() => setOpenAdd(true)} className="btn ghost" style={{ marginTop: 12 }}>
              ＋ تحويل عناصر جديدة للدعم
            </button>
          ) : picker}
        </div>
      )}
    </div>
  );
}
