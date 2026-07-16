"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import { COUNTRIES, DEFAULT_DIAL, combineDialAndNumber, phoneKey } from "@/lib/phone";

type Opt = { id: string; name: string };
type BatchOpt = { id: string; name: string; price?: number; currency?: string; price_egp?: number; price_usd?: number; diploma_id?: string };
const STAGES = [
  ["contacted", "dashStageContacted"], ["interested", "dashStageInterested"],
  ["enrolled", "dashStageEnrolled"], ["lost", "dashStageLost"],
];

type Aff = { name: string; code: string; discount: number };

export default function NewCustomerForm({
  specialties, diplomas, batches, meId, affiliates = [],
}: { specialties: Opt[]; diplomas: Opt[]; batches: BatchOpt[]; meId: string; affiliates?: Aff[] }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    name: "", phone1: "", phone2: "", email: "", company: "", affiliate_code: "",
    specialty_id: "", stage: "interested", residency: "", grad_year: "", source: "",
    follow: "", diploma_id: "", batch_id: "", free: false, note: "",
    amount: "", currency: "EGP",
  });
  // بند 4: كود الدولة لكل رقم (افتراضي مصر)
  const [dial1, setDial1] = useState(DEFAULT_DIAL);
  const [dial2, setDial2] = useState(DEFAULT_DIAL);
  const [saving, setSaving] = useState(false);
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payMode, setPayMode] = useState<"cash" | "installment">("cash");
  const [instCount, setInstCount] = useState("3");
  const [instGap, setInstGap] = useState("1");
  const [payFirstNow, setPayFirstNow] = useState(false);
  const [cashPaidNow, setCashPaidNow] = useState(false); // كاش: هل اتدفع فعلاً دلوقتي؟ (افتراضي لأ)
  const [dup, setDup] = useState<{ id: string; name: string } | null>(null);
  const dupRef = useRef<HTMLDivElement>(null);
  // بند 3: كشف تكرار فوري أثناء الكتابة
  const [liveDup, setLiveDup] = useState<{ id: string; name: string; field: string } | null>(null);
  // بند 2: إظهار قسم الاشتراك (يدوي أو حسب المرحلة)
  const [showSubManual, setShowSubManual] = useState(false);
  // بند 6: المبلغ النهائي بعد الخصم — يُحسب تلقائي، وقابل للتعديل يدوي
  const [netOverride, setNetOverride] = useState<string | null>(null);
  // ===== مودال التفعيل عند الإنشاء (يظهر فقط لو الدفع تمّ بالكامل دلوقتي) =====
  // العميل بيتحفظ الأول، والمودال بيظهر بعد الحفظ. لو اتقفل من غير تأكيد → يفضل محفوظ بدون handoff.
  const [actOpen, setActOpen] = useState(false);
  const [actBusy, setActBusy] = useState(false);
  const [actLibrary, setActLibrary] = useState(true);          // تفعيل المكتبة — مفعّل افتراضياً لكل الدبلومات
  const [actBatchId, setActBatchId] = useState("");            // لو العميل مااختارش باتش في الفورم
  const [actCtx, setActCtx] = useState<{ cid: string; diploma: string; batchId: string; batch: string } | null>(null);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  // بند 3: كشف تكرار فوري أثناء كتابة الموبايل/الإيميل (debounced)
  useEffect(() => {
    const p1 = f.phone1.trim(), p2 = f.phone2.trim(), em = f.email.trim();
    if (!p1 && !p2 && !em) { setLiveDup(null); return; }
    const t = setTimeout(async () => {
      const k1 = phoneKey(p1), k2 = phoneKey(p2);
      const ors: string[] = [];
      // مطابقة بآخر 9 أرقام (تتجاهل اختلاف الكود/الصفر البادئ بين الصيغ)
      if (k1) ors.push(`phone1.like.%${k1}`, `phone2.like.%${k1}`);
      if (k2) ors.push(`phone1.like.%${k2}`, `phone2.like.%${k2}`);
      if (em) ors.push(`email.eq.${em}`);
      if (!ors.length) { setLiveDup(null); return; }
      const { data } = await supabase.from("customers")
        .select("id,name,phone1,phone2,email").eq("deleted", false).or(ors.join(",")).limit(1).maybeSingle();
      if (data) {
        const field = (em && (data as any).email === em) ? tr("email") : tr("phone1");
        setLiveDup({ id: (data as any).id, name: (data as any).name || tr("customer"), field });
      } else setLiveDup(null);
    }, 500);
    return () => clearTimeout(t);
  }, [f.phone1, f.phone2, f.email, dial1, dial2]);

  // بند 5: ملء المبلغ تلقائياً من سعر الباتش بالعملة المختارة (قابل للتعديل يدوي)
  useEffect(() => {
    if (!f.batch_id) return;
    const b = batches.find((x) => x.id === f.batch_id);
    if (!b) return;
    const p = f.currency === "USD" ? Number(b.price_usd) : Number(b.price_egp);
    if (p > 0) setF((s) => ({ ...s, amount: String(p) }));
  }, [f.batch_id, f.currency]);
  // بند 2: قسم الاشتراك يظهر لما المرحلة (عرض سعر/تفاوض/مسجّل) أو بزر يدوي
  const stageOpensSub = f.stage === "enrolled";
  const showSub = stageOpensSub || showSubManual;
  // الاسم: لو إنجليزي خليه CAPITAL تلقائيًا (العربي زي ما هو)
  // الاسم إنجليزي فقط: يشيل أي حروف مش لاتينية (بما فيها العربي) ويحوّل كابيتال أوتوماتيك
  const setName = (v: string) => set("name", v.replace(/[^A-Za-z\s.'-]/g, "").toUpperCase());

  // الافييليت + الخصم
  const affMatch = affiliates.find((a) => a.code.toUpperCase() === f.affiliate_code.trim().toUpperCase());
  const affUnknown = f.affiliate_code.trim() !== "" && !affMatch;
  const gross = Number(f.amount) || 0;
  const discPct = affMatch ? Number(affMatch.discount) || 0 : 0;
  const netAuto = Math.max(0, Math.round(gross - (gross * discPct) / 100));
  // بند 6: لو المستخدم عدّل المبلغ النهائي يدوياً نستخدمه، وإلا المحسوب تلقائياً
  const net = netOverride !== null && netOverride !== "" ? Math.max(0, Number(netOverride) || 0) : netAuto;

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
    if (!f.name.trim()) { toast(tr("nameRequired")); return; }
    if (!f.phone1.trim()) { toast(tr("phoneRequired")); return; }
    if (affUnknown) { toast(tr("affNotInList")); return; }
    setSaving(true);
    setDup(null);

    // بند 4: تطبيع الأرقام لصيغة دولية نظيفة قبل الحفظ
    const phone1 = f.phone1.trim() ? combineDialAndNumber(dial1, f.phone1) : "";
    const phone2 = f.phone2.trim() ? combineDialAndNumber(dial2, f.phone2) : "";

    // منع التكرار: نفس الاسم أو الموبايل (مطابقة بآخر 9 أرقام) أو الإيميل
    const ors: string[] = [`name.eq.${f.name.trim()}`];
    const sk1 = phoneKey(f.phone1), sk2 = phoneKey(f.phone2);
    if (sk1) ors.push(`phone1.like.%${sk1}`, `phone2.like.%${sk1}`);
    if (sk2) ors.push(`phone1.like.%${sk2}`, `phone2.like.%${sk2}`);
    if (f.email.trim()) ors.push(`email.eq.${f.email.trim()}`);
    const { data: exist } = await supabase.from("customers")
      .select("id,name").eq("deleted", false).or(ors.join(",")).limit(1).maybeSingle();
    if (exist) {
      setSaving(false);
      setDup({ id: exist.id as string, name: (exist.name as string) || tr("customer") });
      toast(tr("customerAlreadyExists"));
      setTimeout(() => dupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
      return;
    }

    const { data: cust, error } = await supabase.from("customers").insert({
      name: f.name.trim(), phone1: phone1 || null, phone2: phone2 || null,
      email: f.email.trim() || null, company: f.company.trim(), affiliate_code: f.affiliate_code.trim(),
      specialty_id: f.specialty_id || null, stage: f.stage, residency: f.residency.trim(),
      grad_year: f.grad_year.trim() || null, source: f.source.trim(),
      owner_id: meId || null,
    }).select("id").single();

    if (error || !cust) {
      setSaving(false);
      toast((error as any)?.code === "23505" ? tr("customerAlreadyExists") : tr("errorOccurredShort"));
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
        const url = path; // نخزّن الـ path ونوقّعه وقت العرض
        await supabase.from("customer_docs").insert({ customer_id: cid, url, name: `${tr("transferShot")} — ${tr("agreedWord")} (${payFile.name})` });
      }
    }
    if (f.diploma_id) {
      const { data: enr } = await supabase.from("enrollments").insert({
        customer_id: cid, diploma_id: f.diploma_id, batch_id: f.batch_id || null,
        status: "active", free: f.free, needs_activation: false,
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
            status: cashPaidNow ? "paid" : "due",
            paid_at: cashPaidNow ? new Date().toISOString() : null,
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
                firstShot = p; // نخزّن الـ path ونوقّعه وقت العرض
                await supabase.from("customer_docs").insert({ customer_id: cid, url: firstShot, name: `${tr("instReceipt")} #1 (${payFile.name})` });
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

    // ملاحظة: التحويل للتفعيل بقى من كارت العميل (قسم الماليات) بعد تأكيد الدفع،
    // عشان المبيعات يحدّد الباتش والإضافات بدقة — مفيش تحويل صامت هنا.
    // متابعة
    if (f.follow) {
      await supabase.from("follow_ups").insert({
        customer_id: cid, owner_id: meId, due_at: new Date(f.follow).toISOString(), note: "", done: false,
      });
    } else {
      // بند 7: ليد جديد من غير موعد تواصل → مهمة "مكالمة أولى" تلقائية بعد 7 أيام
      const due = new Date(Date.now() + 7 * 864e5);
      try {
        await supabase.from("tasks").insert({
          customer_id: cid, assignee_id: meId || null,
          title: tr("firstCallTask"), due_at: due.toISOString(), done: false,
        });
      } catch {}
    }
    // ملاحظة أولية
    if (f.note.trim()) {
      await supabase.from("communications").insert({
        customer_id: cid, channel: "note", direction: "out", body: f.note.trim(), by_id: meId,
      });
    }
    setSaving(false);

    // هل الاشتراك اتدفع بالكامل دلوقتي؟ (كاش مدفوع الآن، أو قسط واحد يغطّي الكل، أو هدية)
    const instRows = payMode === "installment" ? buildSchedule(net, Number(instCount), Number(instGap)) : [];
    const firstCoversAll = payFirstNow && instRows.length > 0 && instRows[0].amount >= net;
    const paidInFull = !!f.diploma_id && (
      f.free ||
      (net > 0 && ((payMode === "cash" && cashPaidNow) || (payMode === "installment" && firstCoversAll)))
    );

    if (paidInFull) {
      // العميل اتسجّل بالفعل فوق. نفتح مودال التفعيل. لو اتقفل من غير تأكيد → يفضل بدون handoff.
      const dipName = diplomas.find((d) => d.id === f.diploma_id)?.name || tr("theDiploma");
      const batchName = batches.find((b) => b.id === f.batch_id)?.name || "";
      setActCtx({ cid, diploma: dipName, batchId: f.batch_id, batch: batchName });
      setActBatchId(f.batch_id || "");
      setActLibrary(true);
      setActOpen(true);
      return;
    }

    toast(tr("customerRegistered"));
    router.push(`/customers/${cid}`); router.refresh();
  }

  // تأكيد التفعيل: يبني handoff + بنوده (الدبلومة + المكتبة لو مفعّلة) — نفس منطق كارت العميل بالظبط
  async function confirmActivation() {
    const ctx = actCtx;
    if (!ctx) return;
    setActBusy(true);
    const batchCode = ctx.batch || (batches.find((b) => b.id === actBatchId)?.name || "");
    const labels: string[] = [`${tr("activatePrefix")} ${ctx.diploma}${batchCode ? " — " + batchCode : ""}`];
    if (actLibrary) labels.push(`${tr("activatePrefix")} ${tr("libraryName")}`);

    // handoff موجود؟ نعيد استخدامه، وإلا ننشئ واحد جديد (pending)
    const { data: existingHo } = await supabase.from("handoffs").select("id").eq("customer_id", ctx.cid).limit(1).maybeSingle();
    let hoId = (existingHo as any)?.id as string | undefined;
    if (!hoId) {
      const { data: h, error } = await supabase.from("handoffs").insert({ customer_id: ctx.cid, created_by: meId || null, note: "", status: "pending" }).select("id").single();
      if (error || !h) { setActBusy(false); toast(tr("createHandoffFailed") + (error?.message || "")); return; }
      hoId = (h as any).id;
    } else {
      await supabase.from("handoffs").update({ status: "pending" }).eq("id", hoId);
    }
    // منع تكرار البنود
    const { data: cur } = await supabase.from("handoff_items").select("label").eq("handoff_id", hoId);
    const already = new Set(((cur as any[]) || []).map((x) => x.label));
    const rows = labels.filter((l, i) => labels.indexOf(l) === i).filter((l) => !already.has(l)).map((label) => ({ handoff_id: hoId, label, done: false }));
    if (rows.length) {
      const { error: e2 } = await supabase.from("handoff_items").insert(rows);
      if (e2) { setActBusy(false); toast(tr("addItemsFailed") + e2.message); return; }
    }
    // المرحلة → enrolled + علّم handed_off
    await supabase.from("customers").update({ stage: "enrolled", handed_off: true }).eq("id", ctx.cid);
    await supabase.from("audit_log").insert({ customer_id: ctx.cid, actor_id: meId || null, action: "auto_handoff", detail: labels.join(" · ") });
    setActBusy(false);
    setActOpen(false);
    toast(tr("sentToActivation"));
    router.push(`/customers/${ctx.cid}`); router.refresh();
  }

  // إغلاق المودال من غير تأكيد → العميل محفوظ بدون تحويل (يتحوّل لاحقاً من كارت العميل)
  function dismissActivation() {
    setActOpen(false);
    const cid = actCtx?.cid;
    toast(tr("customerRegistered"));
    if (cid) { router.push(`/customers/${cid}`); router.refresh(); }
  }

  const I = (label: string, k: string, ltr = false) => (
    <div className="fld"><label>{label}</label>
      <input className={"inp" + (ltr ? " num" : "")} dir={ltr ? "ltr" : "rtl"} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} /></div>
  );

  // بند 4: خانة رقم بكود دولة منفصل
  const PhoneField = (label: string, k: string, dial: string, setDial: (v: string) => void) => (
    <div className="fld"><label>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <select className="inp" style={{ width: 96, flexShrink: 0 }} value={dial} onChange={(e) => setDial(e.target.value)}>
          {COUNTRIES.map((c) => <option key={c.code} value={c.dial}>{c.flag} +{c.dial}</option>)}
        </select>
        <input className="inp num" dir="ltr" inputMode="tel" style={{ flex: 1 }}
          value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="sec-t" style={{ marginTop: 0 }}>{tr("basicData")}</div>
      <div className="fld"><label>{tr("name")} *</label>
        <input className="inp" value={f.name} onChange={(e) => setName(e.target.value)} placeholder={tr("nameEnOnlyPh")} dir="ltr" /></div>
      <div className="frow">{PhoneField(tr("phone1"), "phone1", dial1, setDial1)}{PhoneField(tr("phone2"), "phone2", dial2, setDial2)}</div>
      <div className="frow">{I(tr("email"), "email", true)}{I(tr("company"), "company")}</div>

      {/* بند 3: تحذير تكرار فوري أثناء الكتابة */}
      {liveDup && (
        <div style={{ border: "1px solid var(--amber)", background: "rgba(230,167,0,.08)", borderRadius: 10, padding: 10, marginBottom: 8, fontSize: 13 }}>
          ⚠️ <b>{tr("possibleDuplicate")}:</b> {liveDup.name}
          <a href={`/customers/${liveDup.id}`} style={{ color: "var(--brand)", fontWeight: 700, marginInlineStart: 8 }}>{tr("openExistingAccount")} ←</a>
        </div>
      )}

      {I(tr("affiliateCode"), "affiliate_code", true)}
      {affMatch && <div style={{ fontSize: 12.5, color: "var(--green)", marginTop: -6, marginBottom: 8 }}>✓ {affMatch.name} — {tr("discountWord")} {discPct}%</div>}
      {affUnknown && <div style={{ fontSize: 12.5, color: "#E0483B", marginTop: -6, marginBottom: 8 }}>{tr("codeNotInList")}</div>}

      {dup && (
        <div ref={dupRef} style={{ border: "1px solid var(--red)", background: "var(--red-soft)", borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13.5 }}>
          <b style={{ color: "var(--red)" }}>{tr("customerExistsColon")} {dup.name}</b>
          <div style={{ marginTop: 6 }}>
            <a href={`/customers/${dup.id}`} style={{ color: "var(--brand)", fontWeight: 700 }}>{tr("openCustomerCardEdit")} ←</a>
          </div>
        </div>
      )}

      <div className="sec-t">{tr("salesData")}</div>
      <div className="frow">
        <div className="fld"><label>{tr("engSpec")}</label>
          <select className="inp" value={f.specialty_id} onChange={(e) => set("specialty_id", e.target.value)}>
            <option value="">{tr("selectDash")}</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="fld"><label>{tr("stage")}</label>
          <select className="inp" value={f.stage} onChange={(e) => set("stage", e.target.value)}>
            {STAGES.map((s) => <option key={s[0]} value={s[0]}>{tr(s[1])}</option>)}
          </select></div>
      </div>
      <div className="frow">{I(tr("residence"), "residency")}{I(tr("gradYear"), "grad_year", true)}</div>
      <div className="frow">
        {I(tr("source"), "source")}
        <div className="fld"><label>{tr("followUpDate")}</label>
          <input className="inp num" type="datetime-local" dir="ltr" value={f.follow} onChange={(e) => set("follow", e.target.value)} /></div>
      </div>

      {!showSub ? (
        <button type="button" onClick={() => setShowSubManual(true)}
          className="btn ghost" style={{ marginTop: 14, width: "100%", justifyContent: "center" }}>
          ＋ {tr("addSubscription")}
        </button>
      ) : (
      <>
      <div className="sec-t">{tr("subscriptionOpt")}</div>
      <div className="frow">
        <div className="fld"><label>{tr("theDiploma")}</label>
          <select className="inp" value={f.diploma_id} onChange={(e) => {
            const dip = e.target.value;
            set("diploma_id", dip);
            const b = batches.find((x) => x.id === f.batch_id);
            if (b && b.diploma_id && b.diploma_id !== dip) set("batch_id", "");
          }}>
            <option value="">{tr("noneDash")}</option>
            {diplomas.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div className="fld"><label>{tr("theBatch")}</label>
          <select className="inp" value={f.batch_id} onChange={(e) => set("batch_id", e.target.value)} disabled={!f.diploma_id}>
            <option value="">{f.diploma_id ? tr("noneDash") : tr("selectDiplomaFirst")}</option>
            {batches.filter((b) => !b.diploma_id || b.diploma_id === f.diploma_id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></div>
      </div>

      <label className="chkrow"><input type="checkbox" checked={f.free} onChange={(e) => set("free", e.target.checked)} /> {tr("giftFree")}</label>
      {!f.free && (
        <div className="frow" style={{ marginTop: 8 }}>
          <div className="fld"><label>{tr("agreedAmount")}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="inp num" dir="ltr" inputMode="numeric" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
              <select className="inp" style={{ width: 80 }} value={f.currency} onChange={(e) => set("currency", e.target.value)}>
                <option value="EGP">{tr("egpShort")}</option><option value="USD">$</option>
              </select>
            </div>
          </div>
          <div className="fld"><label>{tr("dueAfterDiscount")}{discPct > 0 && <span style={{ color: "var(--green)", fontSize: 11.5, fontWeight: 700 }}> — {tr("discountWord")} {discPct}%</span>}</label>
            <input className="inp num" dir="ltr" inputMode="numeric"
              value={netOverride !== null ? netOverride : String(netAuto)}
              onChange={(e) => setNetOverride(e.target.value)}
              style={{ fontWeight: 700, background: discPct > 0 ? "rgba(24,169,87,.06)" : undefined }} />
            {netOverride !== null && (
              <button type="button" onClick={() => setNetOverride(null)} style={{ fontSize: 11, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", marginTop: 2, padding: 0 }}>
                ↺ {tr("resetToAuto")}
              </button>
            )}
          </div>
        </div>
      )}

      {!f.free && net > 0 && (
        <div className="fld" style={{ marginTop: 8 }}>
          <label>{tr("paymentMethod")}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setPayMode("cash")}
              className={"btn" + (payMode === "cash" ? "" : " ghost")} style={{ flex: 1, justifyContent: "center" }}>
              💵 {tr("cashFull")}
            </button>
            <button type="button" onClick={() => setPayMode("installment")}
              className={"btn" + (payMode === "installment" ? "" : " ghost")} style={{ flex: 1, justifyContent: "center" }}>
              🗓️ {tr("installmentWord")}
            </button>
          </div>

          {payMode === "cash" && (
            <div style={{ marginTop: 8 }}>
              <label className="chkrow" style={{ background: cashPaidNow ? "rgba(24,169,87,.08)" : "transparent", borderRadius: 8, padding: cashPaidNow ? "6px 8px" : "0" }}>
                <input type="checkbox" checked={cashPaidNow} onChange={(e) => setCashPaidNow(e.target.checked)} />
                💵 {tr("paidNow")} — {net} {f.currency === "USD" ? "$" : tr("egpShort")}
              </label>
              <div style={{ fontSize: 11.5, color: cashPaidNow ? "var(--green)" : "var(--muted)", marginTop: 4 }}>
                {cashPaidNow
                  ? `${tr("cashPayNote1")} ${net} ${f.currency === "USD" ? "$" : tr("egpShort")} ${tr("cashPayNote2")}`
                  : `${tr("agreedAmount")}: ${net} ${f.currency === "USD" ? "$" : tr("egpShort")} — ${tr("unpaid")}`}
              </div>
            </div>
          )}

          {payMode === "installment" && (
            <div style={{ marginTop: 10 }}>
              <div className="frow">
                <div className="fld"><label>{tr("installmentCount")}</label>
                  <input className="inp num" dir="ltr" inputMode="numeric" value={instCount} onChange={(e) => setInstCount(e.target.value)} /></div>
                <div className="fld"><label>{tr("installmentGap")}</label>
                  <input className="inp num" dir="ltr" inputMode="numeric" value={instGap} onChange={(e) => setInstGap(e.target.value)} /></div>
              </div>
              {schedule.length > 0 && (
                <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
                    {tr("installmentDatesAuto")}
                  </div>
                  {schedule.map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}>
                      <span>{tr("installmentWord")} {i + 1}{payFirstNow && i === 0 ? " ✅ " + tr("paidNow") : ""}</span>
                      <b className="num" dir="ltr">{s.amount} {f.currency === "USD" ? "$" : tr("egpShort")}</b>
                      <span className="num" dir="ltr" style={{ color: "var(--muted)" }}>{payFirstNow && i === 0 ? tr("today") : s.due}</span>
                    </div>
                  ))}
                </div>
              )}
              <label className="chkrow" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={payFirstNow} onChange={(e) => setPayFirstNow(e.target.checked)} />
                {tr("payFirstNow")}
              </label>
              {payFirstNow && (
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  {tr("payFirstNowHint")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!f.free && (
        <div className="fld" style={{ marginTop: 8 }}>
          <label>{tr("agreedTransferShot")}</label>
          <label className="addshot" style={{ width: "100%" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
            {payFile ? payFile.name : tr("uploadTransferShot")}
            <input type="file" accept="image/*" onChange={(e) => setPayFile(e.target.files?.[0] || null)} />
          </label>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{tr("shotStoredHint")}</div>
        </div>
      )}
      </>
      )}

      <div className="sec-t">{tr("initialNote")}</div>
      <textarea className="inp" rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder={tr("customerNotesPh")} />

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={save} disabled={saving} className="btn">{saving ? "..." : tr("saveCustomer")}</button>
        <button onClick={() => router.back()} className="btn ghost">{tr("back")}</button>
      </div>

      {/* ===== مودال التفعيل عند الإنشاء (دبلومة ثابتة + باتش + تفعيل المكتبة) ===== */}
      {actOpen && actCtx && (
        <div onClick={() => !actBusy && dismissActivation()}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="card"
            style={{ padding: 20, width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto" }}>
            <div className="sec-t" style={{ marginTop: 0, marginBottom: 4 }}>{tr("activationChecklistTitle")}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>{tr("activationChecklistHint")}</div>

            {/* الدبلومة (ثابتة) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: "var(--brand-soft)" }}>
              <input type="checkbox" checked disabled />
              <span style={{ fontWeight: 700, color: "var(--ink)" }}>{tr("activatePrefix")} {actCtx.diploma}</span>
            </div>

            {/* الباتش: تلقائي لو متحدّد في الفورم، وإلا اختيار */}
            <div className="fld" style={{ marginBottom: 8 }}>
              <label>{tr("batch")}</label>
              {actCtx.batchId ? (
                <div className="inp" style={{ display: "flex", alignItems: "center", background: "var(--muted-soft)" }} dir="ltr">{actCtx.batch || "—"}</div>
              ) : (
                <select className="inp" value={actBatchId} onChange={(e) => setActBatchId(e.target.value)}>
                  <option value="">{tr("selectBatchOpt")}</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>

            {/* تفعيل المكتبة — ضروري لكل الدبلومات، مفعّل افتراضياً */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={actLibrary} onChange={(e) => setActLibrary(e.target.checked)} />
              <span style={{ color: "var(--ink)", fontWeight: 700 }}>{tr("activatePrefix")} {tr("libraryName")}</span>
            </label>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={confirmActivation} disabled={actBusy} className="btn" style={{ flex: 1 }}>
                {actBusy ? "..." : tr("confirmActivationBtn")}
              </button>
              <button onClick={dismissActivation} disabled={actBusy} className="btn ghost">{tr("cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
