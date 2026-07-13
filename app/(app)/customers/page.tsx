import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import ExportButton from "./ExportButton";
import CustomersTools from "./CustomersTools";
import CustomerBrief from "./CustomerBrief";

export const dynamic = "force-dynamic";

const STAGES: Record<string, { labelKey: string; color: string }> = {
  new: { labelKey: "dashStageNew", color: "#2F6BFF" }, contacted: { labelKey: "dashStageContacted", color: "#0FA3A3" },
  interested: { labelKey: "dashStageInterested", color: "#7B61FF" }, quote: { labelKey: "dashStageQuote", color: "#E6A700" },
  negotiation: { labelKey: "dashStageNegotiation", color: "#F08A24" },
  enrolled: { labelKey: "dashStageEnrolled", color: "#18A957" }, onhold: { labelKey: "dashStageOnhold", color: "#E6A700" },
  lost: { labelKey: "dashStageLost", color: "#94A2BB" },
};
const money = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));
const todayStr = () => new Date().toISOString().slice(0, 10);

type SP = { q?: string; stage?: string; owner?: string; dip?: string; spec?: string; batch?: string; company?: string; pay?: string; page?: string };

const LIST_LIMIT = 50;

export default async function Customers({ searchParams }: { searchParams: SP }) {
  const STAGE_OPTS = Object.entries(STAGES).map(([v, x]) => ({ v, label: tr(x.labelKey) }));
  const q = (searchParams?.q || "").trim();
  const f = searchParams || {};
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meProf } = await supabase.from("profiles")
    .select("can_export,can_see_finance,can_message").eq("id", user?.id || "").maybeSingle();
  const canExport = !!meProf?.can_export;
  const canFinance = !!meProf?.can_see_finance;
  const canMessage = !!meProf?.can_message;

  // ===== مجموعات فلتر الدفع (تُحسب فقط لما يكون فلتر الدفع مفعّل) =====
  // (installments محميّة بالـ RLS؛ يشوفها من عنده can_see_finance فقط)
  // استعلام مستهدف على الأقساط غير المدفوعة (status <> 'paid') — بدون مسح كامل للجداول.
  const remMap = new Map<string, number>();      // customer_id → المتبقّي (للصفوف المعروضة)
  const curMap = new Map<string, string>();      // customer_id → العملة (للصفوف المعروضة)
  const overdueSet = new Set<string>();          // متأخر (للصفوف المعروضة — وسم الجدول)
  const payBalanceSet = new Set<string>();       // فلتر: عليه مبلغ متبقّي
  const payDueSet = new Set<string>();           // فلتر: عليه قسط بتاريخ استحقاق
  const payOverdueSet = new Set<string>();       // فلتر: متأخر
  if (f.pay && canFinance) {
    const PAGE = 1000, CAP = 60000, CHUNK = 150, today = todayStr();
    // (1) الأقساط غير المدفوعة → أعلام لكل اشتراك
    const enrFlags = new Map<string, { due: boolean; over: boolean }>();
    for (let from = 0; from < CAP; from += PAGE) {
      const { data, error } = await supabase.from("installments")
        .select("enrollment_id,due_date,paid_at,status").neq("status", "paid").range(from, from + PAGE - 1);
      if (error) break;
      const rows = (data as any[]) || [];
      for (const i of rows) {
        if (i.paid_at) continue;                 // مدفوع فعلياً — تجاهل
        const eid = i.enrollment_id; if (!eid) continue;
        const fl = enrFlags.get(eid) || { due: false, over: false };
        if (i.due_date) { fl.due = true; if (String(i.due_date).slice(0, 10) < today) fl.over = true; }
        enrFlags.set(eid, fl);
      }
      if (rows.length < PAGE) break;
    }
    // (2) الاشتراك → العميل (فقط للاشتراكات اللي عليها أقساط غير مدفوعة)
    const enrIds = Array.from(enrFlags.keys());
    for (let c = 0; c < enrIds.length; c += CHUNK) {
      const { data } = await supabase.from("enrollments").select("id,customer_id").in("id", enrIds.slice(c, c + CHUNK));
      for (const e of (data as any[]) || []) {
        const cid = e.customer_id; if (!cid) continue;
        const fl = enrFlags.get(e.id); if (!fl) continue;
        payBalanceSet.add(cid);                  // أي قسط غير مدفوع = عليه متبقّي
        if (fl.due) payDueSet.add(cid);
        if (fl.over) payOverdueSet.add(cid);
      }
    }
  }

  // فلتر الدفع: بنحسبه بمجموعة IDs — منجيبش كلهم في .in() واحد (URL بيطول ويفشل)
  const payActive = !!(f.pay && canFinance);
  const payIds = payActive
    ? Array.from((f.pay === "overdue" || f.pay === "over") ? payOverdueSet
        : f.pay === "due" ? payDueSet : payBalanceSet)
    : [];

  const page = Math.max(1, parseInt(f.page || "1", 10) || 1);
  const offset = (page - 1) * LIST_LIMIT;

  // البيانات المساعدة (صغيرة)
  const [profRes, dipRes, spRes, btRes] = await Promise.all([
    supabase.from("profiles").select("id,full_name"),
    supabase.from("diplomas").select("id,name_ar").order("name_ar"),
    supabase.from("specialties").select("id,name_ar").order("name_ar"),
    supabase.from("batches").select("id,code").order("start_date", { ascending: false }),
  ]);

  let customers: any[] = [];
  let totalCount = 0;
  if (payActive) {
    // جلب العملاء المطابقين على دفعات (≤ 100 id للـ URL) + باقي الفلاتر، ثم ترتيب وتقسيم صفحات في الـ JS
    if (payIds.length) {
      const CH = 100;
      let all: any[] = [];
      for (let i = 0; i < payIds.length; i += CH) {
        let sub = supabase.from("customers")
          .select("id,name,phone1,phone2,email,company,stage,owner_id,specialty_id,created_at")
          .eq("deleted", false).in("id", payIds.slice(i, i + CH));
        if (q) sub = sub.or(`name.ilike.%${q}%,phone1.ilike.%${q}%,email.ilike.%${q}%`);
        if (f.stage) sub = sub.eq("stage", f.stage);
        if (f.spec) sub = sub.eq("specialty_id", f.spec);
        if (f.owner === "none") sub = sub.is("owner_id", null);
        else if (f.owner) sub = sub.eq("owner_id", f.owner);
        if (f.company) sub = sub.eq("company", f.company);
        const { data } = await sub;
        all = all.concat((data as any[]) || []);
      }
      all.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      totalCount = all.length;
      customers = all.slice(offset, offset + LIST_LIMIT);
    }
  } else {
    let cq = supabase.from("customers")
      .select("id,name,phone1,phone2,email,company,stage,owner_id,specialty_id", { count: "exact" })
      .eq("deleted", false);
    if (q) cq = cq.or(`name.ilike.%${q}%,phone1.ilike.%${q}%,email.ilike.%${q}%`);
    if (f.stage) cq = cq.eq("stage", f.stage);
    if (f.spec) cq = cq.eq("specialty_id", f.spec);
    if (f.owner === "none") cq = cq.is("owner_id", null);
    else if (f.owner) cq = cq.eq("owner_id", f.owner);
    if (f.company) cq = cq.eq("company", f.company);
    const custRes = await cq.order("created_at", { ascending: false }).range(offset, offset + LIST_LIMIT - 1);
    customers = (custRes.data as any[]) || [];
    totalCount = (custRes as any).count ?? customers.length;
  }

  const custIds = customers.map((c) => c.id);
  const enrRes = custIds.length
    ? await supabase.from("enrollments").select("id,customer_id,diploma_id,batch_id, diplomas(name_ar), batches(code)").in("customer_id", custIds)
    : ({ data: [] } as any);

  const pName = new Map(((profRes.data as any[]) || []).map((p) => [p.id, p.full_name]));
  const spName = new Map(((spRes.data as any[]) || []).map((s) => [s.id, s.name_ar]));
  const enrollments = (enrRes.data as any[]) || [];

  // خرايط الدبلومات/الباتشات للعميل
  const custDips = new Map<string, string[]>();
  const custBatchIds = new Map<string, string[]>();
  const custDipIds = new Map<string, string[]>();
  for (const e of enrollments) {
    const cid = e.customer_id;
    if (e.diplomas?.name_ar) { const a = custDips.get(cid) || []; if (!a.includes(e.diplomas.name_ar)) a.push(e.diplomas.name_ar); custDips.set(cid, a); }
    if (e.batch_id) { const a = custBatchIds.get(cid) || []; a.push(e.batch_id); custBatchIds.set(cid, a); }
    if (e.diploma_id) { const a = custDipIds.get(cid) || []; a.push(e.diploma_id); custDipIds.set(cid, a); }
  }

  // الرصيد المتبقّي + العملة + وسم "متأخر" — للصفوف المعروضة فقط (سريع، ≤ صفحة واحدة)
  if (canFinance && enrollments.length) {
    const CHUNK = 150, today = todayStr();
    const enrToCust = new Map(enrollments.map((e: any) => [e.id, e.customer_id]));
    const enrIds = enrollments.map((e: any) => e.id);
    const paidByCust = new Map<string, number>();
    const unpaidByCust = new Map<string, number>();
    const agreedByCust = new Map<string, number>();
    for (let c = 0; c < enrIds.length; c += CHUNK) {
      const slice = enrIds.slice(c, c + CHUNK);
      const [insR, efR] = await Promise.all([
        supabase.from("installments").select("enrollment_id,amount,currency,paid_at,due_date,status").in("enrollment_id", slice),
        supabase.from("enrollment_finance").select("enrollment_id,agreed_amount,currency").in("enrollment_id", slice),
      ]);
      for (const i of (insR.data as any[]) || []) {
        const cid = enrToCust.get(i.enrollment_id); if (!cid) continue;
        if (i.currency && !curMap.has(cid)) curMap.set(cid, i.currency);
        const amt = Number(i.amount) || 0;
        const isPaid = !!i.paid_at || i.status === "paid";
        if (isPaid) { paidByCust.set(cid, (paidByCust.get(cid) || 0) + amt); continue; }
        unpaidByCust.set(cid, (unpaidByCust.get(cid) || 0) + amt);
        if (i.due_date && String(i.due_date).slice(0, 10) < today) overdueSet.add(cid);
      }
      for (const ef of (efR.data as any[]) || []) {
        const cid = enrToCust.get(ef.enrollment_id); if (!cid) continue;
        if (ef.currency && !curMap.has(cid)) curMap.set(cid, ef.currency);
        agreedByCust.set(cid, (agreedByCust.get(cid) || 0) + (Number(ef.agreed_amount) || 0));
      }
    }
    for (const cid of custIds) {
      const agreed = agreedByCust.get(cid) || 0, paid = paidByCust.get(cid) || 0;
      let rem = agreed > 0 ? agreed - paid : (unpaidByCust.get(cid) || 0);
      if (rem <= 0 && unpaidByCust.has(cid)) rem = unpaidByCust.get(cid) || 0;
      remMap.set(cid, Math.max(0, rem));
      if (!curMap.has(cid)) curMap.set(cid, "EGP");
    }
  }

  // فلاتر متقدّمة (على العملاء المعروضين): دبلومة / باتش / حالة الدفع
  if (f.dip) customers = customers.filter((c) => (custDipIds.get(c.id) || []).includes(f.dip!));
  if (f.batch) customers = customers.filter((c) => (custBatchIds.get(c.id) || []).includes(f.batch!));
  // فلتر حالة الدفع اتطبّق على مستوى القاعدة فوق (cq.in) — يشمل كل العملاء مش المعروضين بس

  // العدد المعروض: الإجمالي الفعلي من القاعدة، أو عدد النتائج لما يكون فيه فلتر متقدّم
  // فلاتر الدفع بتتحسب على مستوى القاعدة (العدد + الصفحات صح)؛ دبلومة/باتش بس اللي على الصفحة المعروضة
  const advanced = !!(f.dip || f.batch);
  const shownCount = advanced ? customers.length : totalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / LIST_LIMIT));

  // بناء رابط مع الحفاظ على الفلاتر الحالية (مع تعديل مفاتيح محددة)
  const qs = (over: Partial<SP>) => {
    const base: Record<string, string | undefined> = { q, stage: f.stage, owner: f.owner, company: f.company, dip: f.dip, batch: f.batch, pay: f.pay, page: f.page, ...over };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, String(v));
    const s = p.toString();
    return s ? `/customers?${s}` : "/customers";
  };
  // شيب سريع: نشط لو المفتاح مطابق
  const chip = (label: string, key: keyof SP, val: string, active: boolean) => (
    <Link href={active ? qs({ [key]: undefined, page: undefined } as Partial<SP>) : qs({ [key]: val, page: undefined } as Partial<SP>)}
      className="opt-chip" style={active ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" } : undefined}>
      {label}
    </Link>
  );

  // قوائم الفلاتر
  const owners = Array.from(new Set(((profRes.data as any[]) || []).map((p) => p.id))).map((id) => ({ v: id as string, label: pName.get(id) || "—" }));
  const companies = Array.from(new Set(customers.map((c) => c.company).filter(Boolean))).map((c) => ({ v: c as string, label: c as string }));
  const dipOpts = ((dipRes.data as any[]) || []).map((d) => ({ v: d.id, label: d.name_ar }));
  const spOpts = ((spRes.data as any[]) || []).map((s) => ({ v: s.id, label: s.name_ar }));
  const btOpts = ((btRes.data as any[]) || []).map((b) => ({ v: b.id, label: b.code }));

  // قوالب الإرسال الجماعي
  const { data: tplRows } = await supabase.from("wa_templates").select("id,name,body").order("created_at");

  // تصدير (بالأعمدة المالية لو متاح)
  const exportRows = customers.map((c) => ({
    name: c.name || "", diploma: (custDips.get(c.id) || []).join(" / "),
    specialty: spName.get(c.specialty_id) || "",
    phone1: c.phone1 || "", phone2: c.phone2 || "", email: c.email || "", company: c.company || "",
    stage: tr((STAGES[c.stage] || STAGES.new).labelKey), owner: pName.get(c.owner_id) || tr("unassigned"),
    ...(canFinance ? { remaining: money(remMap.get(c.id) || 0) + " " + (curMap.get(c.id) || "EGP") } : {}),
  }));
  const exportHeaders: [string, string][] = [
    ["name", tr("name")], ["diploma", tr("diplomas")], ["specialty", tr("specialty")], ["phone1", tr("phone1")], ["phone2", tr("phone2")],
    ["email", tr("email")], ["company", tr("company")], ["stage", tr("stage")], ["owner", tr("owner")],
    ...(canFinance ? [["remaining", tr("remaining")]] as [string, string][] : []),
  ];

  return (
    <div>
      <div className="page-h">
        <div><h1>{tr("customers")}</h1><p>{shownCount} {tr("customersPl")}{q ? <> · {tr("searchColon")} «{q}»</> : null}</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          {canExport && <ExportButton rows={exportRows} headers={exportHeaders} />}
          <Link className="btn" href="/customers/new">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
            {tr("addCust")}
          </Link>
        </div>
      </div>

      <CustomersTools stages={STAGE_OPTS} owners={owners} diplomas={dipOpts} specialties={spOpts} batches={btOpts}
        companies={companies} canFinance={canFinance} canMessage={canMessage}
        filters={{ q, stage: f.stage, owner: f.owner, company: f.company, dip: f.dip, spec: f.spec, batch: f.batch, pay: f.pay }}
        templates={(tplRows as any) || []} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 14px" }}>
        {chip(tr("dashStageInterested"), "stage", "interested", f.stage === "interested")}
        {chip(tr("dashStageOnhold"), "stage", "onhold", f.stage === "onhold")}
        {chip(tr("unassigned"), "owner", "none", f.owner === "none")}
        {canFinance && chip(tr("overdueWord"), "pay", "over", f.pay === "over")}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("name")}</th><th>{tr("diplomas")}</th><th>{tr("specialty")}</th><th>{tr("phone")}</th><th>{tr("stage")}</th>
              {canFinance && <th>{tr("remaining")}</th>}<th>{tr("owner")}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((r) => {
              const st = STAGES[r.stage] || STAGES.new;
              const dips = custDips.get(r.id) || [];
              const rem = remMap.get(r.id) || 0;
              const od = overdueSet.has(r.id);
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/customers/${r.id}`} style={{ color: "var(--blue)", fontWeight: 700 }}>
                      <div className="cust-name">{r.name}</div>
                    </Link>
                    {r.company ? <div className="cust-sub"><span className="grouptag">🏢 {r.company}</span></div>
                      : <div className="cust-sub" dir="ltr">{r.email || ""}</div>}
                  </td>
                  <td>
                    {dips.length ? (
                      <>
                        <span className="chip">{dips[0]}</span>
                        {dips.length > 1 && <span className="chip" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>+{dips.length - 1}</span>}
                      </>
                    ) : "—"}
                  </td>
                  <td dir="ltr" style={{ textAlign: "end" }}>
                    {spName.get(r.specialty_id) ? <span className="chip">{spName.get(r.specialty_id)}</span> : "—"}
                  </td>
                  <td className="num" dir="ltr" style={{ textAlign: "end" }}>{r.phone1 || "—"}</td>
                  <td><span className="stg" style={{ background: st.color + "1a", color: st.color }}>{tr(st.labelKey)}</span></td>
                  {canFinance && (
                    <td className="num" dir="ltr" style={{ fontWeight: 700, textAlign: "end" }}>
                      {rem > 0 ? (curMap.get(r.id) === "USD" ? "$" + money(rem) : money(rem) + " " + tr("egpShort")) : "—"}
                      {od && <span className="stg" style={{ background: "#FDECEA", color: "#E0483B", marginInlineStart: 6, fontSize: 10 }}>{tr("overdueTag")}</span>}
                    </td>
                  )}
                  <td>{pName.get(r.owner_id) || tr("unassigned")}</td>
                  <td style={{ textAlign: "end" }}><CustomerBrief customerId={r.id} canFinance={canFinance} /></td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr><td colSpan={canFinance ? 8 : 7} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>{tr("noResultsTable")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!advanced && totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
          {page > 1
            ? <Link className="btn ghost" href={qs({ page: String(page - 1) })} style={{ height: 36 }}>‹</Link>
            : <span className="btn ghost" style={{ height: 36, opacity: 0.4, pointerEvents: "none" }}>‹</span>}
          <span className="num" style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>{page} / {totalPages}</span>
          {page < totalPages
            ? <Link className="btn ghost" href={qs({ page: String(page + 1) })} style={{ height: 36 }}>›</Link>
            : <span className="btn ghost" style={{ height: 36, opacity: 0.4, pointerEvents: "none" }}>›</span>}
        </div>
      )}
    </div>
  );
}
