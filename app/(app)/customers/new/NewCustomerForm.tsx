"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Opt = { id: string; name: string };
const STAGES = [
  ["new", "جديد"], ["contacted", "تم التواصل"], ["interested", "مهتم"],
  ["negotiation", "تفاوض"], ["quote", "عرض سعر مُرسل"], ["enrolled", "مسجّل / دفع"], ["onhold", "معلّق"], ["lost", "مؤجل / مرفوض"],
];

type Aff = { name: string; code: string; discount: number };

export default function NewCustomerForm({
  specialties, diplomas, batches, meId, affiliates = [],
}: { specialties: Opt[]; diplomas: Opt[]; batches: Opt[]; meId: string; affiliates?: Aff[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    name: "", phone1: "", phone2: "", email: "", company: "", affiliate_code: "",
    specialty_id: "", stage: "new", residency: "", grad_year: "", source: "", onhold_reason: "",
    follow: "", diploma_id: "", batch_id: "", note: "",
    curMode: "EGP",
    amount: "", free_reason: "",
    firstPay: "", firstPayDate: "", dueDate: "",
  });
  const [firstPayFile, setFirstPayFile] = useState<File | null>(null);
  const [specs, setSpecs] = useState<Opt[]>(specialties);
  const [dips, setDips] = useState<Opt[]>(diplomas);
  const [addSpecOpen, setAddSpecOpen] = useState(false);
  const [addSpecVal, setAddSpecVal] = useState("");
  const [addDipOpen, setAddDipOpen] = useState(false);
  const [addDipVal, setAddDipVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [dup, setDup] = useState<{ id: string; name: string } | null>(null);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  const setName = (v: string) => set("name", /[A-Za-z]/.test(v) ? v.toUpperCase() : v);

  const freeMode = f.curMode === "FREE";
  const affMatch = affiliates.find((a) => a.code.toUpperCase() === f.affiliate_code.trim().toUpperCase());
  const affUnknown = f.affiliate_code.trim() !== "" && !affMatch;
  const gross = Number(f.amount) || 0;
  const discPct = affMatch ? Number(affMatch.discount) || 0 : 0;
  const net = Math.max(0, Math.round(gross - (gross * discPct) / 100));

  async function addSpecialty() {
    const val = addSpecVal.trim();
    if (!val) return;
    const { data } = await supabase.from("specialties").insert({ name_ar: val }).select("id").maybeSingle();
    if (data) {
      const newOpt = { id: data.id, name: val };
      setSpecs((s) => [...s, newOpt]);
      set("specialty_id", data.id);
    }
    setAddSpecVal("");
    setAddSpecOpen(false);
  }

  async function addDiploma() {
    const val = addDipVal.trim();
    if (!val) return;
    const { data } = await supabase.from("diplomas").insert({ name_ar: val }).select("id").maybeSingle();
    if (data) {
      const newOpt = { id: data.id, name: val };
      setDips((s) => [...s, newOpt]);
      set("diploma_id", data.id);
    }
    setAddDipVal("");
    setAddDipOpen(false);
  }

  async function uploadFirstPayShot(): Promise<string> {
    if (!firstPayFile) return "";
    const ext = (firstPayFile.name.split(".").pop() || "jpg").toLowerCase();
    const path = `firstpay-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("receipts").upload(path, firstPayFile, { upsert: false });
    if (up.error) { toast("تعذّر رفع صورة الدفعة"); return ""; }
    return supabase.storage.from("receipts").getPublicUrl(path).data?.publicUrl || "";
  }

  async function save() {
    if (!f.name.trim()) { toast("الاسم مطلوب"); return; }
    if (affUnknown) { toast("كود الأفيلييت غير موجود — راجعه أو سيبه فاضي"); return; }
    setSaving(true);
    setDup(null);

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
      onhold_reason: f.stage === "onhold" ? (f.onhold_reason.trim() || null) : null,
    }).select("id").single();

    if (error || !cust) {
      setSaving(false);
      toast((error as any)?.code === "23505" ? "العميل موجود قبل كده" : "حصل خطأ");
      return;
    }
    const cid = cust.id;

    if (f.diploma_id) {
      const { data: enr } = await supabase.from("enrollments").insert({
        customer_id: cid, diploma_id: f.diploma_id, batch_id: f.batch_id || null,
        status: "active", free: freeMode, free_reason: freeMode ? f.free_reason.trim() : "",
      }).select("id").maybeSingle();

      if (enr) {
        if (!freeMode && net > 0) {
          await supabase.from("enrollment_finance").insert({
            enrollment_id: enr.id, agreed_amount: net, currency: f.curMode,
          });
        }

        const shotUrl = await uploadFirstPayShot();
        if (f.firstPay && Number(f.firstPay) > 0) {
          await supabase.from("installments").insert({
            enrollment_id: enr.id, amount: Number(f.firstPay), currency: f.curMode,
            paid_at: f.firstPayDate ? new Date(f.firstPayDate).toISOString() : new Date().toISOString(),
            screenshot_url: shotUrl || null, status: "paid",
          });
        }

        if (!freeMode && f.dueDate) {
          const remaining = Math.max(0, net - (Number(f.firstPay) || 0));
          if (remaining > 0) {
            await supabase.from("installments").insert({
              enrollment_id: enr.id, amount: remaining, currency: f.curMode,
              due_date: f.dueDate || null, status: "due",
            });
          }
        }
      }
    }

    if (f.follow) {
      await supabase.from("follow_ups").insert({
        customer_id: cid, owner_id: meId, due_at: new Date(f.follow).toISOString(), note: "", done: false,
      });
    }
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

  const curModes = [
    { key: "EGP", label: "ج" },
    { key: "USD", label: "$" },
    { key: "FREE", label: "🎁" },
  ];

  return (
    <div className="card" style={{ padding: 20, maxWidth: 600 }}>
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
          <div className="withadd">
            <select className="inp" value={f.specialty_id} onChange={(e) => set("specialty_id", e.target.value)}>
              <option value="">— اختر —</option>
              {specs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" className="addbtn" onClick={() => setAddSpecOpen(true)} title="إضافة تخصص جديد">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>
        <div className="fld"><label>المرحلة</label>
          <select className="inp" value={f.stage} onChange={(e) => set("stage", e.target.value)}>
            {STAGES.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
          </select></div>
      </div>

      {f.stage === "onhold" && (
        <div className="fld"><label>سبب التعليق</label>
          <input className="inp" value={f.onhold_reason} onChange={(e) => set("onhold_reason", e.target.value)}
            placeholder="مثلاً: عملية الدفع معلّقة من البنك" /></div>
      )}

      {addSpecOpen && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <input className="inp" style={{ flex: 1, height: 36 }} placeholder="اسم التخصص الجديد" value={addSpecVal} onChange={(e) => setAddSpecVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSpecialty()} />
          <button className="btn sm" onClick={addSpecialty}>إضافة</button>
          <button className="btn ghost sm" onClick={() => { setAddSpecOpen(false); setAddSpecVal(""); }}>إلغاء</button>
        </div>
      )}

      <div className="frow">{I("محل الإقامة", "residency")}{I("سنة التخرج", "grad_year", true)}</div>
      <div className="frow">
        {I("المصدر", "source")}
        <div className="fld"><label>موعد المتابعة</label>
          <input className="inp num" type="datetime-local" dir="ltr" value={f.follow} onChange={(e) => set("follow", e.target.value)} /></div>
      </div>

      <div className="sec-t">الاشتراك (اختياري)</div>
      <div className="frow">
        <div className="fld"><label>الدبلومة</label>
          <div className="withadd">
            <select className="inp" value={f.diploma_id} onChange={(e) => set("diploma_id", e.target.value)}>
              <option value="">— بدون —</option>
              {dips.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="button" className="addbtn" onClick={() => setAddDipOpen(true)} title="إضافة دبلومة جديدة">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>
        <div className="fld"><label>الباتش</label>
          <select className="inp" value={f.batch_id} onChange={(e) => set("batch_id", e.target.value)}>
            <option value="">— بدون —</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></div>
      </div>

      {addDipOpen && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <input className="inp" style={{ flex: 1, height: 36 }} placeholder="اسم الدبلومة الجديدة" value={addDipVal} onChange={(e) => setAddDipVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDiploma()} />
          <button className="btn sm" onClick={addDiploma}>إضافة</button>
          <button className="btn ghost sm" onClick={() => { setAddDipOpen(false); setAddDipVal(""); }}>إلغاء</button>
        </div>
      )}

      <div className="fld"><label>العملة</label>
        <div className="curtog">
          {curModes.map((m) => (
            <button key={m.key} type="button" className={f.curMode === m.key ? "on" : ""} onClick={() => set("curMode", m.key)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {freeMode ? (
        <div className="fld"><label>سبب المجانية (هدية / خصم تسويقي / شراكة…)</label>
          <input className="inp" value={f.free_reason} onChange={(e) => set("free_reason", e.target.value)} placeholder="اختياري" /></div>
      ) : (
        <div className="frow">
          <div className="fld"><label>المبلغ المتفق عليه</label>
            <input className="inp num" dir="ltr" inputMode="numeric" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></div>
          <div className="fld"><label>المستحق بعد الخصم</label>
            <input className="inp num" dir="ltr" readOnly value={discPct > 0 ? `${net} (خصم ${discPct}%)` : (gross || "")} style={{ background: "#f4f6fa", fontWeight: 700 }} /></div>
        </div>
      )}

      {!freeMode && (
        <div className="frow">
          <div className="fld"><label>الدفعة الأولى (اختياري)</label>
            <input className="inp num" dir="ltr" inputMode="numeric" value={f.firstPay} onChange={(e) => set("firstPay", e.target.value)} /></div>
          <div className="fld"><label>تاريخ الدفعة</label>
            <input className="inp num" type="date" dir="ltr" value={f.firstPayDate} onChange={(e) => set("firstPayDate", e.target.value)} /></div>
        </div>
      )}
      {!freeMode && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--blue)", fontWeight: 700, cursor: "pointer" }}>
            🖼️ صورة التحويل
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFirstPayFile(e.target.files?.[0] || null)} />
          </label>
          {firstPayFile && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ {firstPayFile.name}</span>}
        </div>
      )}

      {!freeMode && (
        <div className="fld"><label>تاريخ استحقاق المتبقّي (اختياري)</label>
          <input className="inp num" type="date" dir="ltr" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
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
