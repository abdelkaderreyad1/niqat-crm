"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Opt = { id: string; name: string };
const STAGES = [
  ["new", "جديد"], ["contacted", "تم التواصل"], ["interested", "مهتم"],
  ["quote", "عرض سعر مُرسل"], ["negotiation", "تفاوض"], ["enrolled", "مسجّل / دفع"], ["lost", "مؤجل / مرفوض"],
];

type Aff = { name: string; code: string; discount: number };

export default function NewCustomerForm({
  specialties, diplomas, batches, meId, affiliates = [],
}: { specialties: Opt[]; diplomas: Opt[]; batches: Opt[]; meId: string; affiliates?: Aff[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    name: "", phone1: "", phone2: "", email: "", company: "", affiliate_code: "",
    specialty_id: "", stage: "new", residency: "", grad_year: "", source: "",
    follow: "", diploma_id: "", batch_id: "", free: false, note: "",
    amount: "", currency: "EGP",
  });
  const [saving, setSaving] = useState(false);
  const [dup, setDup] = useState<{ id: string; name: string } | null>(null);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  // الاسم: لو إنجليزي خليه CAPITAL تلقائيًا (العربي زي ما هو)
  const setName = (v: string) => set("name", /[A-Za-z]/.test(v) ? v.toUpperCase() : v);

  // الافييليت + الخصم
  const affMatch = affiliates.find((a) => a.code.toUpperCase() === f.affiliate_code.trim().toUpperCase());
  const affUnknown = f.affiliate_code.trim() !== "" && !affMatch;
  const gross = Number(f.amount) || 0;
  const discPct = affMatch ? Number(affMatch.discount) || 0 : 0;
  const net = Math.max(0, Math.round(gross - (gross * discPct) / 100));

  async function save() {
    if (!f.name.trim()) { toast("الاسم مطلوب"); return; }
    if (affUnknown) { toast("كود الأفيلييت غير موجود في القائمة — راجعه أو سيبه فاضي"); return; }
    setSaving(true);
    setDup(null);

    // منع التكرار: نفس الاسم أو الموبايل أو الإيميل
    const ors: string[] = [`name.eq.${f.name.trim()}`];
    if (f.phone1.trim()) ors.push(`phone1.eq.${f.phone1.trim()}`, `phone2.eq.${f.phone1.trim()}`);
    if (f.phone2.trim()) ors.push(`phone1.eq.${f.phone2.trim()}`, `phone2.eq.${f.phone2.trim()}`);
    if (f.email.trim()) ors.push(`email.eq.${f.email.trim()}`);
    const { data: exist } = await supabase.from("customers")
      .select("id,name").eq("deleted", false).or(ors.join(",")).limit(1).maybeSingle();
    if (exist) {
      setSaving(false);
      setDup({ id: exist.id as string, name: (exist.name as string) || "العميل" });
      toast("العميل ده مسجّل قبل كده");
      return;
    }

    const { data: cust, error } = await supabase.from("customers").insert({
      name: f.name.trim(), phone1: f.phone1.trim() || null, phone2: f.phone2.trim() || null,
      email: f.email.trim() || null, company: f.company.trim(), affiliate_code: f.affiliate_code.trim(),
      specialty_id: f.specialty_id || null, stage: f.stage, residency: f.residency.trim(),
      grad_year: f.grad_year.trim() || null, source: f.source.trim(),
    }).select("id").single();

    if (error || !cust) {
      setSaving(false);
      toast((error as any)?.code === "23505" ? "العميل موجود قبل كده" : "حصل خطأ");
      return;
    }
    const cid = cust.id;
    // اشتراك
    if (f.diploma_id) {
      const { data: enr } = await supabase.from("enrollments").insert({
        customer_id: cid, diploma_id: f.diploma_id, batch_id: f.batch_id || null,
        status: "active", free: f.free,
      }).select("id").maybeSingle();
      // المالية: المبلغ المستحق بعد الخصم
      if (enr && !f.free && net > 0) {
        await supabase.from("enrollment_finance").insert({
          enrollment_id: enr.id, agreed_amount: net, currency: f.currency,
        });
      }
    }
    // متابعة
    if (f.follow) {
      await supabase.from("follow_ups").insert({
        customer_id: cid, owner_id: meId, due_at: new Date(f.follow).toISOString(), note: "", done: false,
      });
    }
    // ملاحظة أولية
    if (f.note.trim()) {
      await supabase.from("communications").insert({
        customer_id: cid, channel: "note", direction: "out", body: f.note.trim(), by_id: meId,
      });
    }
    setSaving(false);
    toast("اتسجّل العميل ✓");
    router.push(`/customers/${cid}`); router.refresh();
  }

  const I = (label: string, k: string, ltr = false) => (
    <div className="fld"><label>{label}</label>
      <input className={"inp" + (ltr ? " num" : "")} dir={ltr ? "ltr" : "rtl"} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="sec-t" style={{ marginTop: 0 }}>البيانات الأساسية</div>
      <div className="fld"><label>الاسم *</label>
        <input className="inp" value={f.name} onChange={(e) => setName(e.target.value)} placeholder="عربي أو English" /></div>
      <div className="frow">{I("موبايل ١", "phone1", true)}{I("موبايل ٢", "phone2", true)}</div>
      <div className="frow">{I("الإيميل", "email", true)}{I("الشركة", "company")}</div>
      {I("كود الأفيلييت", "affiliate_code", true)}
      {affMatch && <div style={{ fontSize: 12.5, color: "var(--green)", marginTop: -6, marginBottom: 8 }}>✓ {affMatch.name} — خصم {discPct}%</div>}
      {affUnknown && <div style={{ fontSize: 12.5, color: "#E0483B", marginTop: -6, marginBottom: 8 }}>الكود ده مش في القائمة</div>}

      {dup && (
        <div style={{ border: "1px solid #E0483B", background: "#FBE9E7", borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13.5 }}>
          <b style={{ color: "#E0483B" }}>العميل ده موجود قبل كده: {dup.name}</b>
          <div style={{ marginTop: 6 }}>
            <a href={`/customers/${dup.id}`} style={{ color: "var(--brand)", fontWeight: 700 }}>افتح كارت العميل وعدّل عليه ←</a>
          </div>
        </div>
      )}

      <div className="sec-t">بيانات المبيعات</div>
      <div className="frow">
        <div className="fld"><label>التخصص الهندسي</label>
          <select className="inp" value={f.specialty_id} onChange={(e) => set("specialty_id", e.target.value)}>
            <option value="">— اختر —</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="fld"><label>المرحلة</label>
          <select className="inp" value={f.stage} onChange={(e) => set("stage", e.target.value)}>
            {STAGES.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
          </select></div>
      </div>
      <div className="frow">{I("محل الإقامة", "residency")}{I("سنة التخرج", "grad_year", true)}</div>
      <div className="frow">
        {I("المصدر", "source")}
        <div className="fld"><label>موعد المتابعة</label>
          <input className="inp num" type="datetime-local" dir="ltr" value={f.follow} onChange={(e) => set("follow", e.target.value)} /></div>
      </div>

      <div className="sec-t">الاشتراك (اختياري)</div>
      <div className="frow">
        <div className="fld"><label>الدبلومة</label>
          <select className="inp" value={f.diploma_id} onChange={(e) => set("diploma_id", e.target.value)}>
            <option value="">— بدون —</option>
            {diplomas.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div className="fld"><label>الباتش</label>
          <select className="inp" value={f.batch_id} onChange={(e) => set("batch_id", e.target.value)}>
            <option value="">— بدون —</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></div>
      </div>
      <label className="chkrow"><input type="checkbox" checked={f.free} onChange={(e) => set("free", e.target.checked)} /> هدية / مجاني</label>
      {!f.free && (
        <div className="frow" style={{ marginTop: 8 }}>
          <div className="fld"><label>المبلغ المتفق عليه</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="inp num" dir="ltr" inputMode="numeric" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
              <select className="inp" style={{ width: 80 }} value={f.currency} onChange={(e) => set("currency", e.target.value)}>
                <option value="EGP">ج</option><option value="USD">$</option>
              </select>
            </div>
          </div>
          <div className="fld"><label>المستحق بعد الخصم</label>
            <input className="inp num" dir="ltr" readOnly value={discPct > 0 ? `${net} (خصم ${discPct}%)` : (gross || "")} style={{ background: "#f4f6fa", fontWeight: 700 }} /></div>
        </div>
      )}

      <div className="sec-t">ملاحظة أولية</div>
      <textarea className="inp" rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="ملاحظات عن العميل…" />

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={save} disabled={saving} className="btn">{saving ? "..." : "حفظ العميل"}</button>
        <button onClick={() => router.back()} className="btn ghost">رجوع</button>
      </div>
    </div>
  );
}
