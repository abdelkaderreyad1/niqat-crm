import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import ReportsView from "./ReportsView";

export const dynamic = "force-dynamic";

const STAGES: Record<string, { labelKey: string; color: string }> = {
  contacted: { labelKey: "dashStageContacted", color: "#0FA3A3" },
  interested: { labelKey: "dashStageInterested", color: "#7B61FF" },
  enrolled: { labelKey: "dashStageEnrolled", color: "#18A957" },
  lost: { labelKey: "dashStageLost", color: "#94A2BB" },
};
const DC = ["#F08A24", "#2F6BFF", "#0FA3A3", "#7B61FF", "#18A957", "#E6A700", "#E0483B"];

export default async function Reports() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles")
    .select("can_view_reports, can_see_finance").eq("id", user?.id || "").maybeSingle();

  if (!prof?.can_view_reports) {
    return (<div className="page-h"><div><h1>{tr("reports")}</h1><p>{tr("noReportsAccess")}</p></div></div>);
  }
  const canFinance = !!prof.can_see_finance;

  const [affRes, profRes, dipRes, refundRes, batchRes, tkRes, scRes, edRes, acRes, occRes] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "affiliates").maybeSingle(),
    supabase.from("profiles").select("id,full_name,team"),
    supabase.from("diplomas").select("id,name_ar"),
    supabase.from("refunds").select("customer_id"),
    supabase.from("batches").select("id,code").order("start_date", { ascending: false }),
    supabase.from("tickets").select("assignee_id,status"),
    supabase.rpc("dash_stage_counts"),
    supabase.rpc("dash_enrollment_diploma"),
    supabase.rpc("dash_affiliate_counts"),
    supabase.rpc("dash_owner_customer_counts"),
  ]);

  const profiles = (profRes.data as any[]) || [];
  const diplomas = (dipRes.data as any[]) || [];
  const pName = new Map(profiles.map((p) => [p.id, p.full_name]));
  const dName = new Map(diplomas.map((d: any) => [d.id, d.name_ar]));

  // ==== المراحل (دالة القاعدة — بدون سقف) ====
  const stageCount: Record<string, number> = {};
  for (const r of (scRes.data as any[]) || []) stageCount[r.stage] = Number(r.n) || 0;
  const stageRows = Object.keys(STAGES).map((k) => ({
    key: k, label: tr(STAGES[k].labelKey), color: STAGES[k].color, n: stageCount[k] || 0,
  }));
  const totalCust = Object.values(stageCount).reduce((a, b) => a + b, 0);

  // ==== أفضل الدبلومات (دالة القاعدة) ====
  const dipCount: Record<string, number> = {};
  for (const r of (edRes.data as any[]) || []) dipCount[r.diploma_id] = Number(r.n) || 0;
  const byDiploma = Object.entries(dipCount)
    .map(([id, n], i) => ({ label: dName.get(id) || "—", value: n, color: DC[i % DC.length] }))
    .sort((a, b) => b.value - a.value);

  // ==== الريفند لكل كود ====
  const refundIds = Array.from(new Set(((refundRes.data as any[]) || []).map((r) => r.customer_id)));
  const refundCodeCount: Record<string, number> = {};
  if (refundIds.length) {
    const { data: refCusts } = await supabase.from("customers").select("affiliate_code").in("id", refundIds);
    (refCusts || []).forEach((c: any) => { const code = (c.affiliate_code || "").trim(); if (code) refundCodeCount[code] = (refundCodeCount[code] || 0) + 1; });
  }

  // تاريخ تصفير القياس (اختياري) — يبدأ القياس من عند بدء الشغل الفعلي
  const { data: resetRow } = await supabase.from("app_settings").select("value").eq("key", "reports_reset_at").maybeSingle();
  const resetAt: string = typeof resetRow?.value === "string" ? resetRow.value : ((resetRow?.value as any)?.at || "");

  // ==== المالية مفصولة بالعملة (دالة fin_totals) + المحصّل لكل مندوب + المتأخرات ====
  let agreed = 0, collected = 0, overdueN = 0, agreedUsd = 0, collectedUsd = 0;
  const monthlyMap: Record<string, number> = {};
  const collectedByOwner: Record<string, { egp: number; usd: number }> = {};
  if (canFinance) {
    const [{ data: ft }, { data: oc }, { data: odn }] = await Promise.all([
      supabase.rpc("fin_totals"),
      supabase.rpc("fin_collected_by_owner"),
      supabase.rpc("fin_overdue_count"),
    ]);
    for (const r of (ft as any[]) || []) {
      if (r.currency === "USD") { collectedUsd = Number(r.collected) || 0; agreedUsd = Number(r.agreed) || 0; }
      else { collected += Number(r.collected) || 0; agreed += Number(r.agreed) || 0; }
    }
    for (const r of (oc as any[]) || []) collectedByOwner[r.owner_id] = { egp: Number(r.egp) || 0, usd: Number(r.usd) || 0 };
    overdueN = Number(odn) || 0;

    // شهري (بالجنيه) — أقساط مدفوعة ليها تاريخ فعلي خلال آخر 6 شهور (أو من تاريخ التصفير)
    const sixMo = new Date(); sixMo.setMonth(sixMo.getMonth() - 6);
    const startFilter = resetAt && resetAt > sixMo.toISOString() ? resetAt : sixMo.toISOString();
    const { data: mInsts } = await supabase.from("installments")
      .select("amount,paid_at,status,currency")
      .not("paid_at", "is", null).gte("paid_at", startFilter).eq("currency", "EGP");
    for (const i of (mInsts as any[]) || []) {
      if (i.status === "paid" || i.paid_at) { const m = String(i.paid_at).slice(0, 7); monthlyMap[m] = (monthlyMap[m] || 0) + (Number(i.amount) || 0); }
    }
  }

  // آخر 6 شهور — نمرّر المفتاح (YYYY-MM) والعرض يترجم الاسم حسب اللغة
  const monthly: { key: string; value: number }[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(); d.setMonth(d.getMonth() - k);
    const key = d.toISOString().slice(0, 7);
    monthly.push({ key, value: Math.round(monthlyMap[key] || 0) });
  }

  // ==== أداء المبيعات (team=sales/admin) — من دالة عدّ العملاء لكل مندوب ====
  const ownerCounts = new Map<string, { total: number; enrolled: number }>();
  for (const r of (occRes.data as any[]) || []) ownerCounts.set(r.owner_id, { total: Number(r.total) || 0, enrolled: Number(r.enrolled) || 0 });
  const salesIds = profiles.filter((p) => p.team === "sales" || p.team === "admin").map((p) => p.id);
  const salesRows = salesIds.map((id) => {
    const oc2 = ownerCounts.get(id) || { total: 0, enrolled: 0 };
    const co = collectedByOwner[id] || { egp: 0, usd: 0 };
    return {
      name: pName.get(id) || "—", customers: oc2.total, enrolled: oc2.enrolled,
      conv: oc2.total ? Math.round((oc2.enrolled / oc2.total) * 100) : 0,
      collectedEgp: Math.round(co.egp), collectedUsd: Math.round(co.usd),
    };
  }).filter((r) => r.customers > 0).sort((a, b) => b.customers - a.customers);

  // ==== أداء الدعم (من التذاكر) ====
  const supAgg: Record<string, { total: number; open: number; closed: number }> = {};
  ((tkRes.data as any[]) || []).forEach((t) => {
    const id = t.assignee_id; if (!id) return;
    if (!supAgg[id]) supAgg[id] = { total: 0, open: 0, closed: 0 };
    supAgg[id].total++;
    if (t.status === "closed" || t.status === "resolved") supAgg[id].closed++;
    else supAgg[id].open++;
  });
  const supportRows = Object.entries(supAgg).map(([id, v]) => ({
    name: pName.get(id) || "—", total: v.total, open: v.open, closed: v.closed,
  })).sort((a, b) => b.total - a.total);

  // ==== الأفيلييت (دالة القاعدة) ====
  const affList: any[] = Array.isArray(affRes.data?.value) ? (affRes.data!.value as any[]) : [];
  const affName = new Map(affList.map((a) => [a.code, a]));
  const affAgg: Record<string, { customers: number; enrolled: number }> = {};
  for (const r of (acRes.data as any[]) || []) affAgg[r.code] = { customers: Number(r.customers) || 0, enrolled: Number(r.enrolled) || 0 };
  Object.keys(refundCodeCount).forEach((code) => { if (!affAgg[code]) affAgg[code] = { customers: 0, enrolled: 0 }; });
  const affRows = Object.entries(affAgg).map(([code, v]) => ({
    code, name: affName.get(code)?.name || "—", discount: affName.get(code)?.discount ?? null,
    customers: v.customers, enrolled: v.enrolled,
    interested: Math.max(0, v.customers - v.enrolled), refunded: refundCodeCount[code] || 0,
  })).sort((a, b) => b.customers - a.customers);

  const batchOpts = ((batchRes.data as any[]) || []).map((b) => ({ v: b.id, label: b.code }));
  const diplomaOpts = diplomas.map((d: any) => ({ v: d.id, label: d.name_ar }));
  const affiliatesList = affList.map((a: any) => ({ code: (a.code || "").toUpperCase(), name: a.name || "—", rate: Number(a.rate) || 0, discount: Number(a.discount) || 0 }));

  return (
    <ReportsView
      canFinance={canFinance}
      agreed={Math.round(agreed)} collected={Math.round(collected)} overdueN={overdueN}
      agreedUsd={Math.round(agreedUsd)} collectedUsd={Math.round(collectedUsd)}
      stageRows={stageRows} totalCust={totalCust} affRows={affRows}
      salesRows={salesRows} supportRows={supportRows} monthly={monthly} byDiploma={byDiploma}
      batchOpts={batchOpts} diplomaOpts={diplomaOpts} affiliates={affiliatesList}
      resetAt={resetAt}
    />
  );
}
