"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Tpl = { id: string; name: string; body: string };

const VARS = ["{name}", "{diploma}", "{batch}", "{remaining}"];

export default function TemplatesManager({ initial }: { initial: Tpl[] }) {
  const supabase = createClient();
  const [list, setList] = useState<Tpl[]>(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || !body.trim()) { toast("اكتب الاسم والنص"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("wa_templates")
      .insert({ name: name.trim(), body: body.trim() }).select("id").single();
    setBusy(false);
    if (error) { toast("تعذّر الحفظ"); return; }
    setList((s) => [...s, { id: data!.id, name: name.trim(), body: body.trim() }]);
    setName(""); setBody(""); setOpen(false); toast("اتضاف القالب");
  }

  async function del(t: Tpl) {
    if (!confirm(`حذف قالب «${t.name}»؟`)) return;
    setList((s) => s.filter((x) => x.id !== t.id));
    const { error } = await supabase.from("wa_templates").delete().eq("id", t.id);
    toast(error ? "تعذّر الحذف" : "اتحذف");
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>إدارة قوالب الرسائل</h3>
        <button className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 13 }} onClick={() => setOpen((v) => !v)}>
          {open ? "إغلاق" : "+ قالب"}
        </button>
      </div>

      {open && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, margin: "12px 0", background: "rgba(240,138,36,.05)" }}>
          <div className="fld"><label>اسم القالب</label>
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="fld"><label>نص الرسالة</label>
            <textarea className="inp" rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
            متغيرات: {VARS.map((v) => <code key={v} style={{ marginInlineEnd: 6, color: "var(--brand)" }}>{v}</code>)}
          </div>
          <button onClick={add} disabled={busy} className="btn">{busy ? "..." : "حفظ القالب"}</button>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {list.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد قوالب بعد.</div>}
        {list.map((t) => (
          <div key={t.id} className="tplrow">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <b>{t.name}</b>
              <button onClick={() => del(t)} style={{ color: "var(--red)", fontSize: 12, fontWeight: 700, background: "none" }}>حذف</button>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{t.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
