import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import ExportButton from "./ExportButton";
import CustomersTools from "./CustomersTools";

export const dynamic = "force-dynamic";

const STAGES: Record<string, { label: string; color: string }> = {
  new: { label: "جديد", color: "#2F6BFF" }, contacted: { label: "تم التواصل", color: "#0FA3A3" },
  interested: { label: "مهتم", color: "#7B61FF" }, quote: { label: "عرض سعر مُرسل", color: "#E6A700" },
  negotiation: { label: "تفاوض", color: "#F08A24" },
  enrolled: { label: "مسجّل / دفع", color: "#18A957" }, onhold: { label: "معلّق", color: "#E6A700" },
  lost: { label: "مؤجل / مرفوض", color: "#94A2BB" },
};
const STAGE_OPTS = Object.entries(STAGES).map(([v, x]) => ({ v, label: x.label }));
const money = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));
const todayStr = () => new Date().toISOString().slice(0, 10);

type SP = { q?: string; stage?: string; owner?: string; dip?: string; batch?: string; company?: string; pay?: string };

export default async function Customers({ searchParams }: { searchParams: SP }) {
  const q = (searchParams?.q || "").trim();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meProf } = await supabase.from("profiles")
    .select("can_export,can_see_finance,can_message").eq("id", user?.id || "").maybeSingle();
  const canExport = !!meProf?.can_export;
  const canFinance = !!meProf?.can_see_finance;
  const canMessage = !!meProf?.can_message;

  // جلب متوازي
  const [custRes, profRes, enrRes, dipRes, btRes] = await Promise.all([
    (() => { let cq = supabase.from("customers").select("id,name,phone1,phone2,email,company,stage,owner_id").eq("deleted", false);
      if (q) cq = cq.or(`name.ilike.%${q}%,phone1.ilike.%${q}%,email.ilike.%${q}%`);
      return cq.order("created_at", { ascending: false }).limit(300); })(),
    supabase.from("profiles").select("id,full_name"),
    supabase.from("enrollments").select("id,customer_id,diploma_id,batch_id, diplomas(name_ar), batches(code)"),
    supabase.from("diplomas").select("id,name_ar").order("name_ar"),
    supabase.from("batches").select("id,code").order("start_date", { ascending: false }),
  ]);

  let customers = (custRes.data as any[]) || [];
  const pName = new Map(((profRes.data as any[]) || []).map((p) => [p.id, p.full_name]));
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

  // الرصيد المتبقّي + المتأخر (للمالية)
  const remMap = new Map<string, number>();
  const overdueSet = new Set<string>();
  const dueSet = new Set<string>();
  if (canFinance) {
    const enrToCust = new Map(enrollments.map((e) => [e.id, e.customer_id]));
    const { data: insts } = await supabase.from("installments").select("enrollment_id,amount,paid_at,due_date,status");
    for (const i of (insts as any[]) || []) {
      const cid = enrToCust.get(i.enrollment_id); if (!cid) continue;
      const paid = !!i.paid_at || i.status === "paid";
      if (!paid) {
        remMap.set(cid, (remMap.get(cid) || 0) + (Number(i.amount) || 0));
        if (i.due_date) { dueSet.add(cid); if (i.due_date < todayStr()) overdueSet.add(cid); }
      }
    }
  }

  // فلاتر
  const f = searchParams || {};
  if (f.stage) customers = customers.filter((c) => c.stage === f.stage);
  if (f.owner) customers = customers.filter((c) => c.owner_id === f.owner);
  if (f.company) customers = customers.filter((c) => c.company === f.company);
  if (f.dip) customers = customers.filter((c) => (custDipIds.get(c.id) || []).includes(f.dip!));
  if (f.batch) customers = customers.filter((c) => (custBatchIds.get(c.id) || []).includes(f.batch!));
  if (f.pay && canFinance) customers = customers.filter((c) =>
    f.pay === "bal" ? (remMap.get(c.id) || 0) > 0 : f.pay === "due" ? dueSet.has(c.id) : overdueSet.has(c.id));

  // قوائم الفلاتر
  const owners = Array.from(new Set(((profRes.data as any[]) || []).map((p) => p.id))).map((id) => ({ v: id as string, label: pName.get(id) || "—" }));
  const companies = Array.from(new Set(((custRes.data as any[]) || []).map((c) => c.company).filter(Boolean))).map((c) => ({ v: c as string, label: c as string }));
  const dipOpts = ((dipRes.data as any[]) || []).map((d) => ({ v: d.id, label: d.name_ar }));
  const btOpts = ((btRes.data as any[]) || []).map((b) => ({ v: b.id, label: b.code }));

  // قوالب الإرسال الجماعي + أرقام النتيجة
  const { data: tplRows } = await supabase.from("wa_templates").select("id,name,body").order("created_at");
  const phones = customers.map((c) => c.phone1).filter(Boolean);

  // تصدير (بالأعمدة المالية لو متاح)
  const exportRows = customers.map((c) => ({
    name: c.name || "", diploma: (custDips.get(c.id) || []).join(" / "),
    phone1: c.phone1 || "", phone2: c.phone2 || "", email: c.email || "", company: c.company || "",
    stage: (STAGES[c.stage] || STAGES.new).label, owner: pName.get(c.owner_id) || "غير معيّن",
    ...(canFinance ? { remaining: money(remMap.get(c.id) || 0) } : {}),
  }));
  const exportHeaders: [string, string][] = [
    ["name", "الاسم"], ["diploma", "الدبلومات"], ["phone1", "موبايل ١"], ["phone2", "موبايل ٢"],
    ["email", "الإيميل"], ["company", "الشركة"], ["stage", "المرحلة"], ["owner", "المسؤول"],
    ...(canFinance ? [["remaining", "المتبقّي"]] as [string, string][] : []),
  ];

  return (
    <div>
      <div className="page-h">
        <div><h1>{tr("customers")}</h1><p>{customers.length} عميل{q ? <> · بحث: «{q}»</> : null}</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          {canExport && <ExportButton rows={exportRows} headers={exportHeaders} />}
          <Link className="btn" href="/customers/new">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
            {tr("addCust")}
          </Link>
        </div>
      </div>

      <CustomersTools stages={STAGE_OPTS} owners={owners} diplomas={dipOpts} batches={btOpts}
        companies={companies} canFinance={canFinance} canMessage={canMessage}
        phones={phones} templates={(tplRows as any) || []} />

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("name")}</th><th>{tr("diplomas")}</th><th>{tr("phone")}</th><th>{tr("stage")}</th>
              {canFinance && <th>{tr("remaining")}</th>}<th>{tr("owner")}</th>
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
                        {dips.length > 1 && <span className="chip" style={{ background: "#fff4e9", color: "var(--brand)" }}>+{dips.length - 1}</span>}
                      </>
                    ) : "—"}
                  </td>
                  <td className="num" dir="ltr">{r.phone1 || "—"}</td>
                  <td><span className="stg" style={{ background: st.color + "1a", color: st.color }}>{st.label}</span></td>
                  {canFinance && (
                    <td className="num" dir="ltr" style={{ fontWeight: 700 }}>
                      {rem > 0 ? money(rem) + " ج" : "—"}
                      {od && <span className="stg" style={{ background: "#FDECEA", color: "#E0483B", marginInlineStart: 6, fontSize: 10 }}>متأخر</span>}
                    </td>
                  )}
                  <td>{pName.get(r.owner_id) || "غير معيّن"}</td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr><td colSpan={canFinance ? 6 : 5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>لا يوجد عملاء مطابقين.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
