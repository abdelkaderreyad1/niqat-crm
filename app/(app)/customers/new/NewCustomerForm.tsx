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
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payMode, setPayMode] = useState<"cash" | "installment">("cash");
  const [instCount, setInstCount] = useState("3");
  const [instGap, setInstGap] = useState("1");
  const [payFirstNow, setPayFirstNow] = useState(false);
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

  // حساب جدول الأقساط: يقسّم المبلغ ويحسب ميعاد كل قسط
  function buildSchedule(total: number, count: number, gapMonths: number) {
    const n = Math.max(1, Math.floor(count) || 1);
    const per = Math.floor(total / n);
    const rows: { amount: number; due: string }[] = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? total - sum : per; // آخر قسط ياخد الباقي (لتجنب الكسور)
      sum += amount;
      const d = new Date();
      d.setMonth(d.getMonth() + (i + 1) * (Math.max(1, Math.floor(gapMonths) || 1)));
      rows.push({ amount, due: d.toISOString().slice(0, 10) });
    }
    return rows;
  }
  const schedule = payMode === "installment" && net > 0 ? buildSchedule(net, Number(instCount), Number(instGap)) : [];

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
    // صورة تحويل الفلوس المتفق عليها → تخزين + تسجيل في المستندات
    // (نتخطّاها لو الإيصال هيتربط بالقسط الأول في وضع التقسيط)
    const receiptGoesToInstallment = payMode === "installment" && payFirstNow;
    if (payFile && !receiptGoesToInstallment) {
      const path = `docs/${cid}/${Date.now()}-${payFile.name}`;
      const up = await supabase.storage.from("receipts").upload(path, payFile, { upsert: false });
      if (!up.error) {
        const url = supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
        await supabase.from("customer_docs").insert({ customer_id: cid, url, name: `صورة تحويل — المبلغ المتفق عليه (${payFile.name})` });
      }
    }
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
        // نظام الدفع: كاش = قسط واحد مدفوع بالكامل / تقسيط = أقساط بمواعيد محسوبة
        if (payMode === "cash") {
          await supabase.from("installments").insert({
            enrollment_id: enr.id, amount: net, currency: f.currency,
            due_date: new Date().toISOString().slice(0, 10),
            status: "paid", paid_at: new Date().toISOString(),
          });
        } else {
          const rows = buildSchedule(net, Number(instCount), Number(instGap));
          if (rows.length) {
            // لو دفع أول قسط دلوقتي: القسط الأول paid + نربط بيه الإيصال المرفوع
            let firstShot: string | null = null;
            if (payFirstNow && payFile) {
              const p = `installments/${cid}/${Date.now()}-${payFile.name}`;
              const u = await supabase.storage.from("receipts").upload(p, payFile, { upsert: false });
              if (!u.error) {
                firstShot = supabase.storage.from("receipts").getPublicUrl(p).data.publicUrl;
                await supabase.from("customer_docs").insert({ customer_id: cid, url: firstShot, name: `إيصال القسط الأول (${payFile.name})` });
              }
            }
            await supabase.from("installments").insert(
              rows.map((r, idx) => ({
                enrollment_id: enr.id, amount: r.amount, currency: f.currency,
                due_date: r.due,
                status: payFirstNow && idx === 0 ? "paid" : "pending",
                paid_at: payFirstNow && idx === 0 ? new Date().toISOString() : null,
                screenshot_url: payFirstNow && idx === 0 ? firstShot : null,
              }))
            );
          }
        }
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
        <div style={{ border: "1px solid var(--red)", background: "var(--red-soft)", borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13.5 }}>
          <b style={{ color: "var(--red)" }}>العميل ده موجود قبل كده: {dup.name}</b>
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
            <input className="inp num" dir="ltr" readOnly value={discPct > 0 ? `${net} (خصم ${discPct}%)` : (gross || "")} style={{ background: "var(--muted-soft)", fontWeight: 700 }} /></div>
        </div>
      )}

      {!f.free && net > 0 && (
        <div className="fld" style={{ marginTop: 8 }}>
          <label>طريقة الدفع</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setPayMode("cash")}
              className={"btn" + (payMode === "cash" ? "" : " ghost")} style={{ flex: 1, justifyContent: "center" }}>
              💵 كاش (دفع كامل)
            </button>
            <button type="button" onClick={() => setPayMode("installment")}
              className={"btn" + (payMode === "installment" ? "" : " ghost")} style={{ flex: 1, justifyContent: "center" }}>
              🗓️ تقسيط
            </button>
          </div>

          {payMode === "cash" && (
            <div style={{ fontSize: 12.5, color: "var(--green)", marginTop: 8, fontWeight: 600 }}>
              هيتسجّل إن العميل دفع {net} {f.currency === "USD" ? "$" : "ج"} كاش، والمتبقّي 0.
            </div>
          )}

          {payMode === "installment" && (
            <div style={{ marginTop: 10 }}>
              <div className="frow">
                <div className="fld"><label>عدد الأقساط</label>
                  <input className="inp num" dir="ltr" inputMode="numeric" value={instCount} onChange={(e) => setInstCount(e.target.value)} /></div>
                <div className="fld"><label>كل قسط بعد كام شهر</label>
                  <input className="inp num" dir="ltr" inputMode="numeric" value={instGap} onChange={(e) => setInstGap(e.target.value)} /></div>
              </div>
              {schedule.length > 0 && (
                <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
                    مواعيد الأقساط (تلقائي):
                  </div>
                  {schedule.map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}>
                      <span>القسط {i + 1}{payFirstNow && i === 0 ? " ✅ مدفوع الآن" : ""}</span>
                      <b className="num" dir="ltr">{s.amount} {f.currency === "USD" ? "$" : "ج"}</b>
                      <span className="num" dir="ltr" style={{ color: "var(--muted)" }}>{payFirstNow && i === 0 ? "النهاردة" : s.due}</span>
                    </div>
                  ))}
                </div>
              )}
              <label className="chkrow" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={payFirstNow} onChange={(e) => setPayFirstNow(e.target.checked)} />
                دفع أول قسط دلوقتي مع التسجيل
              </label>
              {payFirstNow && (
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  القسط الأول هيتسجّل مدفوع، وصورة التحويل اللي تحت هتترّبط بيه وتظهر في المستندات.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!f.free && (
        <div className="fld" style={{ marginTop: 8 }}>
          <label>صورة تحويل الفلوس المتفق عليها (اختياري)</label>
          <label className="addshot" style={{ width: "100%" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
            {payFile ? payFile.name : "ارفع صورة التحويل"}
            <input type="file" accept="image/*" onChange={(e) => setPayFile(e.target.files?.[0] || null)} />
          </label>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>هتتخزّن وتظهر في سكشن المستندات في ملف العميل.</div>
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
