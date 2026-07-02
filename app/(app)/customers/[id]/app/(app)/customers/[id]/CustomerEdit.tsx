"use client";
import { useState, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Spec = { id: string; name_ar: string };
type C = {
  id: string; name: string; phone1: string | null; phone2: string | null;
  email: string | null; company: string | null; residency: string | null;
  grad_year: number | null; stage: string; specialty_id: string | null;
  lms_status: string | null; source: string | null; affiliate_code: string | null; created_at: string;
  terms_signed?: boolean | null; terms_signed_at?: string | null;
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
function toEngUpper(v: string) { return v.replace(/[\u0600-\u06FF]/g, "").toUpperCase(); }
const hasArabic = (v: string) => /[\u0600-\u06FF]/.test(v);

function CustomerEdit({ customer, specialties }: { customer: C; specialties: Spec[] }) {
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
  const [terms, setTerms] = useState(!!customer.terms_signed);
  const [termsAt, setTermsAt] = useState(customer.terms_signed_at || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const set = useCallback((k: string, v: string) => setF((s) => ({ ...s, [k]: v })), []);
  const setName = useCallback((v: string) => setF((s) => ({ ...s, name: toEngUpper(v) })), []);
  const wa = waLink(f.phone1);

  const toggleTerms = useCallback(async () => {
    const next = !terms;
    const at = next ? new Date().toISOString() : "";
    setTerms(next); setTermsAt(at);
    await supabase.from("customers").update({ terms_signed: next, terms_signed_at: at || null }).eq("id", customer.id);
  }, [terms, supabase, customer.id]);

  const save = useCallback(async () => {
    setErr(""); setMsg("");
    if (!f.name.trim()) { setErr("الاسم مطلوب"); return; }
    if (hasArabic(f.name)) { setErr("اسم العميل لازم يكون إنجليزي فقط."); return; }
    setBusy(true);
    const { error } = await supabase.from("customers").update({
      name: f.name.trim().toUpperCase(), phone1: f.phone1.trim() || null, phone2: f.phone2.trim() || null,
      email: f.email.trim() || null, company: f.company.trim() || null, residency: f.residency.trim() || null,
      grad_year: f.grad_year ? Number(f.grad_year) : null,
      specialty_id: f.specialty_id || null, stage: f.stage,
      affiliate_code: f.affiliate_code.trim(), source: f.source.trim(), lms_status: f.lms_status,
    }).eq("id", customer.id);
    setBusy(false);
    if (error) {
      setErr((error as any).code === "23505" ? "الموبايل أو الإيميل ده موجود عند عميل تاني." : "حصل خطأ: " + error.message);
      return;
    }
    setMsg("اتحفظ ✓");
    router.refresh();
  }, [f, supabase, customer.id, router]);

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t" style={{ marginTop: 0 }}>البيانات الأساسية</div>
      <div className="frow">
        <div className="fld"><label>الاسم (إنجليزي)</label>
          <input className="inp num" dir="ltr" value={f.name} onChange={(e) => setName(e.target.value)} placeholder="AHMED ALI" /></div>
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

      <div className="sec-t">معلومات المبيعات</div>
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

      <div className="sec-t">الشروط والأحكام</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px", background: terms ? "rgba(24,169,87,.06)" : "var(--surface)" }}>
        <div className={"sw" + (terms ? " on" : "")} onClick={toggleTerms} title="تم الإمضاء" style={{ cursor: "pointer" }}><i /></div>
        <div style={{ flex: 1 }}>
          <b style={{ color: terms ? "var(--green)" : "var(--ink)" }}>{terms ? "✓ العميل أمضى على الشروط والأحكام" : "لسه ما أمضاش على الشروط والأحكام"}</b>
          {terms && termsAt && <div style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--fe)" }}>{String(termsAt).replace("T", " ").slice(0, 16)}</div>}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", paddingTop: 10 }}>
        تاريخ الإضافة: {new Date(customer.created_at).toLocaleDateString("ar-EG")}
      </div>

      {err && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{err}</div>}
      {msg && <div style={{ color: "var(--green)", fontSize: 13, marginTop: 8 }}>{msg}</div>}

      <div className="drawer-footer">
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

export default memo(CustomerEdit);
