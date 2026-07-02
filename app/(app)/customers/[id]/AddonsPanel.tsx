"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Addon = { id: string; type: string; name: string; amount: number; free: boolean; note: string; paid: boolean };

export default function AddonsPanel({
  customerId, initial, accreditations, projects, canFinance, tableMissing,
}: {
  customerId: string; initial: Addon[]; accreditations: string[]; projects: string[];
  canFinance: boolean; tableMissing: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [list, setList] = useState<Addon[]>(initial);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("accred");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [free, setFree] = useState(false);
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);

  const names = type === "accred" ? accreditations : projects;

  async function add() {
    const nm = name || names[0];
    if (!nm) { toast("اختر العنصر"); return; }
    setBusy(true);
    const amt = free ? 0 : Number(amount) || 0;
    const { data, error } = await supabase.from("customer_addons").insert({
      customer_id: customerId, type, name: nm, free, note: note.trim(), paid,
    }).select("id").single();
    if (!error && data && canFinance && !free && amt > 0) {
      await supabase.from("addon_finance").insert({ customer_addon_id: data.id, amount: amt, currency: "EGP" });
    }
    setBusy(false);
    if (error) { toast("تعذّر الإضافة"); return; }
    setList((s) => [...s, { id: data!.id, type, name: nm, amount: amt, free, note: note.trim(), paid }]);
    setName(""); setAmount(""); setFree(false); setNote(""); setPaid(false); setOpen(false);
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
        <div className="sec-t">الإضافات (اعتمادات / مشاريع)</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>جدول الإضافات لسه مش متعمل — شغّل batch4-tables.sql في Supabase.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="sec-t" style={{ margin: 0 }}>الإضافات (اعتمادات / مشاريع)</div>
        <button onClick={() => setOpen((v) => !v)} className="btn ghost" style={{ height: 30, padding: "0 10px", fontSize: 12.5 }}>{open ? "إغلاق" : "+ إضافة"}</button>
      </div>

      {open && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, margin: "10px 0", background: "rgba(240,138,36,.05)" }}>
          <div className="frow">
            <div className="fld"><label>النوع</label>
              <select className="inp" value={type} onChange={(e) => { setType(e.target.value); setName(""); }}>
                <option value="accred">اعتماد</option><option value="project">مشروع</option>
              </select></div>
            <div className="fld"><label>العنصر</label>
              <select className="inp" value={name} onChange={(e) => setName(e.target.value)}>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </select></div>
          </div>
          {canFinance && !free && (
            <div className="fld"><label>المبلغ</label>
              <input className="inp num" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          )}
          <label className="chkrow"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> هدية / مجاني</label>
          <div className="fld"><label>ملاحظة</label><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <label className="chkrow"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> مدفوع (يتسلّم للدعم للتفعيل)</label>
          <button onClick={add} disabled={busy} className="btn" style={{ marginTop: 8 }}>{busy ? "..." : "إضافة"}</button>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {list.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد إضافات.</div>}
        {list.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
            <span className="chip" style={{ background: a.type === "accred" ? "#7B61FF1a" : "#0FA3A31a", color: a.type === "accred" ? "#7B61FF" : "#0FA3A3" }}>
              {a.type === "accred" ? "اعتماد" : "مشروع"}
            </span>
            <span style={{ flex: 1, fontWeight: 700, color: "var(--ink)" }}>{a.name}{a.free && <span style={{ color: "var(--green)", fontSize: 12, marginInlineStart: 6 }}>🎁 هدية</span>}</span>
            {canFinance && !a.free && <span className="num" dir="ltr" style={{ fontSize: 13, color: "var(--muted)" }}>{new Intl.NumberFormat("en").format(a.amount)} ج</span>}
            <div className={"sw" + (a.paid ? " on" : "")} onClick={() => togglePaid(a)} title="مدفوع"><i /></div>
            <button onClick={() => del(a)} style={{ color: "var(--red)", fontSize: 12, background: "none" }}>حذف</button>
          </div>
        ))}
      </div>
    </div>
  );
}
