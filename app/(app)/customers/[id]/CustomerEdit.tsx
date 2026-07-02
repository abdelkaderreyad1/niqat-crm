"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Spec = { id: string; name_ar: string };
type C = {
  id: string; name: string; phone1: string | null; phone2: string | null;
  email: string | null; company: string | null; residency: string | null;
  grad_year: number | null; stage: string; specialty_id: string | null;
  lms_status: string | null; source: string | null; affiliate_code: string | null; created_at: string;
};

const STAGES = [
  { key: "new", label: "جديد" },
  { key: "contacted", label: "تم التواصل" },
  { key: "interested", label: "مهتم" },
  { key: "quote", label: "عرض سعر مُرسل" },
  { key: "negotiation", label: "تفاوض" },
  { key: "enrolled", label: "مسجّل / دفع" },
  { key: "lost", label: "مؤجل / مرفوض" },
];

function waLink(phone: string | null) {
  if (!phone) return null;
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return null;
  return "https://wa.me/" + (d.startsWith("0") ? "20" + d.slice(1) : d);
}

export default function CustomerEdit({ customer, specialties }: { customer: C; specialties: Spec[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    name: customer.name || "", phone1: customer.phone1 || "", phone2: customer.phone2 || "",
    email: customer.email || "", company: customer.company || "", residency: customer.residency || "",
    grad_year: customer.grad_year ? String(customer.grad_year) : "",
    specialty_id: customer.specialty_id || "", stage: customer.stage || "new",
    affiliate_code: customer.affiliate_code || "",
    source: customer.source || "", lms_status: customer.lms_status || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const wa = waLink(f.phone1);

  async function save() {
    setErr(""); setMsg("");
    if (!f.name.trim()) { setErr("الاسم مطلوب"); return; }
    setBusy(true);
    const { error } = await supabase.from("customers").update({
      name: f.name.trim(), phone1: f.phone1.trim() || null, phone2: f.phone2.trim() || null,
      email: f.email.trim() || null, company: f.company.trim() || null,
      residency: f.residency.trim() || null,
      grad_year: f.grad_year ? Number(f.grad_year) : null,
      specialty_id: f.specialty_id || null, stage: f.stage,
      affiliate_code: f.affiliate_code.trim(),
      source: f.source.trim(), lms_status: f.lms_status,
    }).eq("id", customer.id);
    setBusy(false);
    if (error) {
      setErr((error as any).code === "23505" ? "الموبايل أو الإيميل ده موجود عند عميل تاني." : "حصل خطأ: " + error.message);
      return;
    }
    setMsg("اتحفظ ✓");
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t">المعلومات الأساسية</div>
      <div className="frow">
        <div className="fld"><label>الاسم</label>
          <input className="inp" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="fld"><label>المرحلة</label>
          <select className="inp" value={f.stage} onChange={(e) => set("stage", e.target.value)}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select></div>
      </div>
      <div className="frow">
        <div className="fld"><label>الموبايل 1</label>
          <input className="inp num" dir="ltr" value={f.phone1} onChange={(e) => set("phone1", e.target.value)} /></div>
        <div className="fld"><label>الموبايل 2</label>
          <input className="inp num" dir="ltr" value={f.phone2} onChange={(e) => set("phone2", e.target.value)} /></div>
      </div>
      <div className="frow">
        <div className="fld"><label>الإيميل</label>
          <input className="inp num" dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div className="fld"><label>الشركة</label>
          <input className="inp" value={f.company} onChange={(e) => set("company", e.target.value)} /></div>
      </div>

      <div className="sec-t" style={{ marginTop: 6 }}>معلومات المبيعات</div>
      <div className="frow">
        <div className="fld"><label>التخصص الهندسي</label>
          <select className="inp" value={f.specialty_id} onChange={(e) => set("specialty_id", e.target.value)}>
            <option value="">— غير محدد —</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
          </select></div>
        <div className="fld"><label>سنة التخرج</label>
          <input className="inp num" dir="ltr" inputMode="numeric" value={f.grad_year} onChange={(e) => set("grad_year", e.target.value)} /></div>
      </div>
      <div className="frow">
        <div className="fld"><label>محل الإقامة</label>
          <input className="inp" value={f.residency} onChange={(e) => set("residency", e.target.value)} /></div>
        <div className="fld"><label>كود الأفيلييت</label>
          <input className="inp num" dir="ltr" value={f.affiliate_code} onChange={(e) => set("affiliate_code", e.target.value)} placeholder="اختياري" /></div>
      </div>
      <div className="frow">
        <div className="fld"><label>مصدر العميل</label>
          <input className="inp" value={f.source} onChange={(e) => set("source", e.target.value)} placeholder="فيسبوك / إحالة / إعلان…" /></div>
        <div className="fld"><label>حالة المنصة (LMS)</label>
          <select className="inp" value={f.lms_status} onChange={(e) => set("lms_status", e.target.value)}>
            <option value="">— غير محدّد —</option>
            <option value="active">مفعّلة</option>
            <option value="pending">قيد التفعيل</option>
            <option value="none">غير مفعّلة</option>
          </select></div>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", paddingTop: 6 }}>
        تاريخ الإضافة: {new Date(customer.created_at).toLocaleDateString("ar-EG")}
      </div>

      {err && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{err}</div>}
      {msg && <div style={{ color: "var(--green)", fontSize: 13, marginTop: 8 }}>{msg}</div>}

      <div style={{
        position: "sticky", bottom: 0, marginTop: 14, paddingTop: 12,
        borderTop: "1px solid var(--line)", background: "var(--surface)",
        display: "flex", gap: 8, alignItems: "center", zIndex: 2,
      }}>
        <button onClick={save} disabled={busy} className="btn">{busy ? "بيحفظ..." : "حفظ التعديلات"}</button>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="btn wa" style={{ textDecoration: "none", marginInlineStart: "auto" }}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.6-4A8 8 0 1 1 20 11.5z"/></svg>
            واتساب
          </a>
        )}
      </div>
    </div>
  );
}
