"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Addon = { id: string; type: string; name: string; amount: number; free: boolean; note: string; paid: boolean; shot_url?: string };

const TYPES = [
  { key: "accred", label: "اعتماد", color: "#7B61FF" },
  { key: "project", label: "مشروع", color: "#0FA3A3" },
  { key: "library", label: "مكتبة", color: "#E6A700" },
];
const typeMeta = (t: string) => TYPES.find((x) => x.key === t) || TYPES[0];

export default function AddonsPanel({
  customerId, initial, accreditations, projects, libraries = [], canFinance, tableMissing,
}: {
  customerId: string; initial: Addon[]; accreditations: string[]; projects: string[]; libraries?: string[];
  canFinance: boolean; tableMissing: boolean;
}) {
  const supabase = createClient();
  const [list, setList] = useState<Addon[]>(initial);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("accred");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [free, setFree] = useState(false);
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const names = type === "accred" ? accreditations : type === "project" ? projects : libraries;

  async function uploadShot(): Promise<string> {
    if (!file) return "";
    const path = `addons/${customerId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (up.error) { toast("تعذّر رفع الاسكرين"); return ""; }
    return supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
  }

  async function add() {
    const nm = name || names[0];
    if (!nm) { toast("اختر العنصر"); return; }
    setBusy(true);
    const shot_url = paid && file ? await uploadShot() : "";
    const amt = free ? 0 : Number(amount) || 0;
    const { data, error } = await supabase.from("customer_addons").insert({
      customer_id: customerId, type, name: nm, amount: amt, free, note: note.trim(), paid, shot_url,
    }).select("id").single();
    setBusy(false);
    if (error) { toast("تعذّر الإضافة: " + error.message); return; }
    setList((s) => [...s, { id: data!.id, type, name: nm, amount: amt, free, note: note.trim(), paid, shot_url }]);
    setName(""); setAmount(""); setFree(false); setNote(""); setPaid(false); setFile(null); setOpen(false);
    toast("اتضافت الإضافة");
  }

  async function togglePaid(a: Addon) {
    setList((s) => s.map((x) => (x.id === a.id ? { ...x, paid: !x.paid } : x)));
    const { error } = await supabase.from("customer_addons").update({ paid: !a.paid }).eq("id", a.id);
    if (error) { setList((s) => s.map((x) => (x.id === a.id ? { ...x, paid: a.paid } : x))); toast("تعذّر التحديث"); }
    else toast(!a.paid ? "اتعلّمت مدفوعة — تتسلّم للدعم" : "اتلغى الدفع");
  }

  async function del(a: Addon) {
    if (!confirm(`حذف «${a.name}»؟`)) return;
    setList((s) => s.filter((x) => x.id !== a.id));
    await supabase.from("customer_addons").delete().eq("id", a.id);
    toast("اتحذفت");
  }

  if (tableMissing) {
    return (
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="sec-t">الإضافات والمدفوعات</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>جدول الإضافات لسه مش متعمل — شغّل batch4-tables.sql في Supabase.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="sec-t" style={{ margin: 0 }}>الإضافات والمدفوعات (اعتماد / مشروع / مكتبة)</div>
        <button onClick={() => setOpen((v) => !v)} className={open ? "btn ghost" : "btn"} style={{ height: 34, padding: "0 14px", fontSize: 13 }}>
          {open ? "إغلاق" : "＋ إضافة عنصر"}
        </button>
      </div>

      {open && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, margin: "12px 0", background: "var(--surface)" }}>
          <div className="frow">
            <div className="fld"><label>النوع</label>
              <select className="inp" value={type} onChange={(e) => { setType(e.target.value); setName(""); }}>
                {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select></div>
            <div className="fld"><label>العنصر</label>
              <select className="inp" value={name} onChange={(e) => setName(e.target.value)}>
                <option value="">— اختر —</option>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </select></div>
          </div>

          <label className="chkrow"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> هدية / مجاني</label>

          {canFinance && !free && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginTop: 8, background: "rgba(24,169,87,.04)" }}>
              <div className="frow" style={{ alignItems: "end" }}>
                <div className="fld" style={{ margin: 0 }}><label>المبلغ المدفوع (ج.م)</label>
                  <input className="inp num" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مثال: 1500" /></div>
                <div className="fld" style={{ margin: 0 }}><label>اسكرين الدفع</label>
                  <label className="addshot" style={{ width: "100%" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
                    {file ? file.name : "ارفع صورة التحويل"}
                    <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label></div>
              </div>
            </div>
          )}

          <div className="fld" style={{ marginTop: 8 }}><label>ملاحظة</label><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <label className="chkrow"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> مدفوع (يتسلّم للدعم للتفعيل)</label>
          <button onClick={add} disabled={busy} className="btn" style={{ marginTop: 10 }}>{busy ? "..." : "إضافة العنصر"}</button>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {list.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد إضافات.</div>}
        {list.map((a) => {
          const m = typeMeta(a.type);
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
              <span className="chip" style={{ background: m.color + "1a", color: m.color }}>{m.label}</span>
              <span style={{ flex: 1, fontWeight: 700, color: "var(--ink)" }}>{a.name}{a.free && <span style={{ color: "var(--green)", fontSize: 12, marginInlineStart: 6 }}>🎁 هدية</span>}</span>
              {canFinance && !a.free && <span className="num" dir="ltr" style={{ fontSize: 13, color: "var(--muted)" }}>{new Intl.NumberFormat("en").format(a.amount)} ج</span>}
              {a.shot_url && <a href={a.shot_url} target="_blank" rel="noreferrer" title="اسكرين الدفع" style={{ color: "var(--blue)", fontSize: 12 }}>🧾</a>}
              <div className={"sw" + (a.paid ? " on" : "")} onClick={() => togglePaid(a)} title="مدفوع"><i /></div>
              <button onClick={() => del(a)} style={{ color: "var(--red)", fontSize: 12, background: "none" }}>حذف</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
