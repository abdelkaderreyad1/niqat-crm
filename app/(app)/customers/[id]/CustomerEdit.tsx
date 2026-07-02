"use client";
import { useState, useCallback, forwardRef, useImperativeHandle } from "react";
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
  { key: "onhold", label: "معلّق" },
  { key: "enrolled", label: "مسجّل / دفع" },
  { key: "lost", label: "مؤجل / مرفوض" },
];

export type CustomerEditHandle = { save: () => Promise<void> };

const inp = "w-full bg-slate-900 border border-slate-700 rounded-lg p-3.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-150 text-[14px]";
const sel = inp + " appearance-none cursor-pointer";
const lbl = "text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block";

const CustomerEdit = forwardRef<CustomerEditHandle, { customer: C; specialties: Spec[] }>(({ customer, specialties }, ref) => {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"basic" | "sales" | "terms">("basic");
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
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const set = useCallback((k: string, v: string) => setF((s) => ({ ...s, [k]: v })), []);

  const toggleTerms = useCallback(async () => {
    const next = !terms;
    const at = next ? new Date().toISOString() : "";
    setTerms(next); setTermsAt(at);
    await supabase.from("customers").update({ terms_signed: next, terms_signed_at: at || null }).eq("id", customer.id);
  }, [terms, supabase, customer.id]);

  const save = useCallback(async () => {
    setErr(""); setMsg("");
    if (!f.name.trim()) { setErr("الاسم مطلوب"); return; }
    if (/[\u0600-\u06FF]/.test(f.name)) { setErr("اسم العميل لازم يكون إنجليزي فقط."); return; }
    const { error } = await supabase.from("customers").update({
      name: f.name.trim().toUpperCase(), phone1: f.phone1.trim() || null, phone2: f.phone2.trim() || null,
      email: f.email.trim() || null, company: f.company.trim() || null, residency: f.residency.trim() || null,
      grad_year: f.grad_year ? Number(f.grad_year) : null,
      specialty_id: f.specialty_id || null, stage: f.stage,
      affiliate_code: f.affiliate_code.trim(), source: f.source.trim(), lms_status: f.lms_status,
    }).eq("id", customer.id);
    if (error) {
      setErr((error as any).code === "23505" ? "الموبايل أو الإيميل ده موجود عند عميل تاني." : "حصل خطأ: " + error.message);
      return;
    }
    setMsg("اتحفظ ✓");
    router.refresh();
  }, [f, supabase, customer.id, router]);

  useImperativeHandle(ref, () => ({ save }), [save]);

  const TabBtn = ({ val, label }: { val: typeof tab; label: string }) => (
    <button type="button" onClick={() => setTab(val)}
      className={"pb-3 px-1 text-[13px] font-bold transition-all duration-150 border-b-2 " +
        (tab === val ? "border-orange-500 text-orange-500" : "border-transparent text-gray-500 hover:text-gray-300")}>
      {label}
    </button>
  );

  const fld = "flex flex-col gap-1.5";
  const grid2 = "grid grid-cols-2 gap-4";

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex border-b border-gray-800 mb-6 gap-6">
        <TabBtn val="basic" label="بيانات أساسية" />
        <TabBtn val="sales" label="مبيعات" />
        <TabBtn val="terms" label="الشروط" />
      </div>

      <div className="flex-1 space-y-5">
        {tab === "basic" && (
          <>
            <div className={fld}>
              <label className={lbl}>الاسم <span className="text-orange-400/50 font-normal">(إنجليزي)</span></label>
              <input className={inp} dir="ltr" value={f.name} placeholder="AHMED ALI"
                onChange={(e) => setF({...f, name: e.target.value.replace(/[^A-Za-z\s]/g, '').toUpperCase()})} />
            </div>
            <div className={fld}>
              <label className={lbl}>المرحلة</label>
              <select className={sel} value={f.stage} onChange={(e) => set("stage", e.target.value)}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className={grid2}>
              <div className={fld}>
                <label className={lbl}>الموبايل 1</label>
                <input className={inp} dir="ltr" value={f.phone1} onChange={(e) => set("phone1", e.target.value)} />
              </div>
              <div className={fld}>
                <label className={lbl}>الموبايل 2</label>
                <input className={inp} dir="ltr" value={f.phone2} onChange={(e) => set("phone2", e.target.value)} />
              </div>
            </div>
            <div className={fld}>
              <label className={lbl}>الإيميل</label>
              <input className={inp} dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className={grid2}>
              <div className={fld}>
                <label className={lbl}>الشركة</label>
                <input className={inp} value={f.company} onChange={(e) => set("company", e.target.value)} />
              </div>
              <div className={fld}>
                <label className={lbl}>محل الإقامة</label>
                <input className={inp} value={f.residency} onChange={(e) => set("residency", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {tab === "sales" && (
          <>
            <div className={fld}>
              <label className={lbl}>التخصص الهندسي</label>
              <select className={sel} value={f.specialty_id} onChange={(e) => set("specialty_id", e.target.value)}>
                <option value="">— غير محدد —</option>
                {specialties.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
              </select>
            </div>
            <div className={grid2}>
              <div className={fld}>
                <label className={lbl}>سنة التخرج</label>
                <input className={inp} dir="ltr" inputMode="numeric" value={f.grad_year}
                  onChange={(e) => set("grad_year", e.target.value)} />
              </div>
              <div className={fld}>
                <label className={lbl}>كود الأفيلييت</label>
                <input className={inp} dir="ltr" value={f.affiliate_code} placeholder="اختياري"
                  onChange={(e) => set("affiliate_code", e.target.value)} />
              </div>
            </div>
            <div className={fld}>
              <label className={lbl}>مصدر العميل</label>
              <input className={inp} value={f.source} placeholder="فيسبوك / إحالة / إعلان…"
                onChange={(e) => set("source", e.target.value)} />
            </div>
            <div className={fld}>
              <label className={lbl}>حالة المنصة (LMS)</label>
              <select className={sel} value={f.lms_status} onChange={(e) => set("lms_status", e.target.value)}>
                <option value="">— غير محدّد —</option>
                <option value="active">مفعّلة</option>
                <option value="pending">قيد التفعيل</option>
                <option value="none">غير مفعّلة</option>
              </select>
            </div>
          </>
        )}

        {tab === "terms" && (
          <div className="flex items-center gap-4 p-5 rounded-xl border border-slate-700 bg-slate-800/50">
            <button type="button" onClick={toggleTerms}
              className={"relative w-[44px] h-[24px] rounded-full transition-colors flex-shrink-0 " +
                (terms ? "bg-orange-500" : "bg-slate-600")}>
              <span className={"absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all duration-200 " +
                (terms ? "left-[23px]" : "left-[3px]")} />
            </button>
            <div className="flex-1 min-w-0">
              <div className={"text-[14px] font-bold " + (terms ? "text-orange-400" : "text-gray-400")}>
                {terms ? "✓ العميل أمضى على الشروط والأحكام" : "لم يمضِ على الشروط والأحكام بعد"}
              </div>
              {terms && termsAt && (
                <div className="text-[12px] text-gray-500 mt-1 font-num">
                  {String(termsAt).replace("T", " ").slice(0, 16)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {err && (
        <div className="mt-5 text-[13px] text-red-400 bg-red-400/10 rounded-lg px-4 py-2.5 border border-red-400/20">
          {err}
        </div>
      )}
      {msg && (
        <div className="mt-5 text-[13px] text-green-400 bg-green-400/10 rounded-lg px-4 py-2.5 border border-green-400/20">
          {msg}
        </div>
      )}

      <div className="sticky bottom-0 w-full bg-slate-900/80 backdrop-blur-md border-t border-slate-700 p-4 mt-auto">
        <button onClick={save}
          className="w-full h-[46px] bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-[14px] tracking-wide rounded-lg active:scale-[.98] transition-all duration-150 shadow-lg shadow-orange-500/20">
          حفظ التعديلات
        </button>
      </div>
    </div>
  );
});

CustomerEdit.displayName = "CustomerEdit";
export default CustomerEdit;
