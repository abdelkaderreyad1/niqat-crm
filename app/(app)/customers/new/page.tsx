"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewCustomer() {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({ name: "", phone1: "", phone2: "", email: "", company: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }));

  async function save() {
    setErr("");
    if (!f.name.trim()) { setErr("الاسم مطلوب"); return; }
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      name: f.name.trim(),
      phone1: f.phone1.trim() || null,
      phone2: f.phone2.trim() || null,
      email: f.email.trim() || null,
      company: f.company.trim()
    });
    setSaving(false);
    if (error) {
      if ((error as any).code === "23505")
        setErr("العميل ده موجود قبل كده (نفس الموبايل أو الإيميل).");
      else setErr("حصل خطأ: " + error.message);
      return;
    }
    router.push("/customers"); router.refresh();
  }

  const Field = (label: string, k: keyof typeof f, ltr = false) => (
    <div className="fld">
      <label>{label}</label>
      <input className={"inp" + (ltr ? " num" : "")} dir={ltr ? "ltr" : "rtl"}
        value={f[k]} onChange={e => set(k, e.target.value)} />
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-h"><h1>{tr("addCust")}</h1></div>
      <div className="card" style={{ padding: 20 }}>
        {Field("الاسم *", "name")}
        {Field("موبايل ١", "phone1", true)}
        {Field("موبايل ٢", "phone2", true)}
        {Field("الإيميل", "email", true)}
        {Field("الشركة", "company")}
        {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={save} disabled={saving} className="btn">{saving ? "..." : "حفظ"}</button>
          <button onClick={() => router.back()} className="btn ghost">رجوع</button>
        </div>
      </div>
    </div>
  );
}
