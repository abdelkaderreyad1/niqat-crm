"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Tpl = { id: string; name: string; body: string };

const VARS = ["{name}", "{diploma}", "{batch}", "{remaining}"];

export default function TemplatesManager({ initial }: { initial: Tpl[] }) {
  const tr = useT();
  const supabase = createClient();
  const [list, setList] = useState<Tpl[]>(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eBody, setEBody] = useState("");

  function startEdit(t: Tpl) { setEditId(t.id); setEName(t.name); setEBody(t.body); }
  function cancelEdit() { setEditId(null); setEName(""); setEBody(""); }

  async function saveEdit(t: Tpl) {
    if (!eName.trim() || !eBody.trim()) { toast(tr("enterNameAndText")); return; }
    const prev = list;
    const next = { name: eName.trim(), body: eBody.trim() };
    setList((s) => s.map((x) => (x.id === t.id ? { ...x, ...next } : x)));
    cancelEdit();
    const { error } = await supabase.from("wa_templates").update(next).eq("id", t.id);
    if (error) { setList(prev); toast(tr("saveFailed")); return; }
    toast(tr("updated"));
  }

  async function add() {
    if (!name.trim() || !body.trim()) { toast(tr("enterNameAndText")); return; }
    setBusy(true);
    const { data, error } = await supabase.from("wa_templates")
      .insert({ name: name.trim(), body: body.trim() }).select("id").single();
    setBusy(false);
    if (error) { toast(tr("saveFailed")); return; }
    setList((s) => [...s, { id: data!.id, name: name.trim(), body: body.trim() }]);
    setName(""); setBody(""); setOpen(false); toast(tr("templateAdded"));
  }

  async function del(t: Tpl) {
    if (!confirm(`${tr("deleteTemplateQ")} «${t.name}»?`)) return;
    setList((s) => s.filter((x) => x.id !== t.id));
    const { error } = await supabase.from("wa_templates").delete().eq("id", t.id);
    toast(error ? tr("deleteFailed") : tr("deletedM"));
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>{tr("templatesManager")}</h3>
        <button className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 13 }} onClick={() => setOpen((v) => !v)}>
          {open ? tr("close") : "+ " + tr("templateWord")}
        </button>
      </div>

      {open && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, margin: "12px 0", background: "rgba(240,138,36,.05)" }}>
          <div className="fld"><label>{tr("templateName")}</label>
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="fld"><label>{tr("messageText")}</label>
            <textarea className="inp" rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
            {tr("variablesLabel")} {VARS.map((v) => <code key={v} style={{ marginInlineEnd: 6, color: "var(--brand)" }}>{v}</code>)}
          </div>
          <button onClick={add} disabled={busy} className="btn">{busy ? "..." : tr("saveTemplate")}</button>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {list.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noTemplatesYet")}</div>}
        {list.map((t) => (
          <div key={t.id} className="tplrow">
            {editId === t.id ? (
              <div>
                <div className="fld" style={{ marginBottom: 8 }}><label>{tr("templateName")}</label>
                  <input className="inp" value={eName} onChange={(e) => setEName(e.target.value)} /></div>
                <div className="fld" style={{ marginBottom: 8 }}><label>{tr("messageText")}</label>
                  <textarea className="inp" rows={3} value={eBody} onChange={(e) => setEBody(e.target.value)} /></div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
                  {tr("variablesLabel")} {VARS.map((v) => <code key={v} style={{ marginInlineEnd: 6, color: "var(--brand)" }}>{v}</code>)}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => saveEdit(t)} className="btn sm">{tr("save")}</button>
                  <button onClick={cancelEdit} className="btn ghost sm">{tr("cancel")}</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 10 }}>
                  <b>{t.name}</b>
                  <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                    <button onClick={() => startEdit(t)} style={{ color: "var(--brand)", fontSize: 12, fontWeight: 700, background: "none" }}>{tr("edit")}</button>
                    <button onClick={() => del(t)} style={{ color: "var(--red)", fontSize: 12, fontWeight: 700, background: "none" }}>{tr("delete")}</button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{t.body}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
