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

  // ===== أرصدة مستحقة لكل العملاء (دالة القاعدة — تتجاوز حد الصفحة) =====
  const remMap = new Map<string, number>();
  const curMap = new Map<string, string>();
  const overdueSet = new Set<string>();
  let balanceIds: string[] = [];
  if (canFinance) {
    const { data: outs } = await supabase.rpc("cust_outstanding");
    for (const o of (outs as any[]) || []) {
      remMap.set(o.customer_id, Number(o.remaining) || 0);
      curMap.set(o.customer_id, o.currency || "EGP");
      if (o.has_overdue) overdueSet.add(o.customer_id);
    }
    balanceIds = Array.from(remMap.keys());
  }

  // العملاء: آخر 100 مسجّلين (الأحدث فوق) + العدد الفعلي الكامل من القاعدة (count exact)
  let cq = supabase.from("customers")
    .select("id,name,phone1,phone2,email,company,stage,owner_id,specialty_id", { count: "exact" })
    .eq("deleted", false);
  if (q) cq = cq.or(`name.ilike.%${q}%,phone1.ilike.%${q}%,email.ilike.%${q}%`);
  if (f.stage) cq = cq.eq("stage", f.stage);
  if (f.spec) cq = cq.eq("specialty_id", f.spec);
  if (f.owner === "none") cq = cq.is("owner_id", null);
  else if (f.owner) cq = cq.eq("owner_id", f.owner);
  if (f.company) cq = cq.eq("company", f.company);
  if (f.pay && canFinance) {
    const ids = f.pay === "over" ? Array.from(overdueSet) : balanceIds;
    cq = cq.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const page = Math.max(1, parseInt(f.page || "1", 10) || 1);
  const offset = (page - 1) * LIST_LIMIT;

  // جلب متوازي
  const [custRes, profRes, dipRes, spRes, btRes] = await Promise.all([
    cq.order("created_at", { ascending: false }).range(offset, offset + LIST_LIMIT - 1),
    supabase.from("profiles").select("id,full_name"),
    supabase.from("diplomas").select("id,name_ar").order("name_ar"),
    supabase.from("specialties").select("id,name_ar").order("name_ar"),
    supabase.from("batches").select("id,code").order("start_date", { ascending: false }),
  ]);

  let customers = (custRes.data as any[]) || [];
  const totalCount = (custRes as any).count ?? customers.length;
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

  // الرصيد المتبقّي + المتأخر: محسوب فوق من دالة cust_outstanding (كل العملاء)

  // فلاتر متقدّمة (على العملاء المعروضين): دبلومة / باتش / حالة الدفع
  if (f.dip) customers = customers.filter((c) => (custDipIds.get(c.id) || []).includes(f.dip!));
  if (f.batch) customers = customers.filter((c) => (custBatchIds.get(c.id) || []).includes(f.batch!));
  // فلتر حالة الدفع اتطبّق على مستوى القاعدة فوق (cq.in) — يشمل كل العملاء مش المعروضين بس

  // العدد المعروض: الإجمالي الفعلي من القاعدة، أو عدد النتائج لما يكون فيه فلتر متقدّم
  const advanced = !!(f.dip || f.batch || f.pay);
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
  const companies = Array.from(new Set(((custRes.data as any[]) || []).map((c) => c.company).filter(Boolean))).map((c) => ({ v: c as string, label: c as string }));
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
                  <td dir="ltr" style={{ textAlign: "start" }}>
                    {spName.get(r.specialty_id) ? <span className="chip">{spName.get(r.specialty_id)}</span> : "—"}
                  </td>
                  <td className="num" dir="ltr">{r.phone1 || "—"}</td>
                  <td><span className="stg" style={{ background: st.color + "1a", color: st.color }}>{tr(st.labelKey)}</span></td>
                  {canFinance && (
                    <td className="num" dir="ltr" style={{ fontWeight: 700 }}>
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
