import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import ReportsView from "./ReportsView";

export const dynamic = "force-dynamic";

const STAGES: Record<string, { labelKey: string; color: string }> = {
  new: { labelKey: "dashStageNew", color: "#2F6BFF" },
  contacted: { labelKey: "dashStageContacted", color: "#0FA3A3" },
  interested: { labelKey: "dashStageInterested", color: "#7B61FF" },
  quote: { labelKey: "dashStageQuote", color: "#E6A700" },
  negotiation: { labelKey: "dashStageNegotiation", color: "#F08A24" },
  enrolled: { labelKey: "dashStageEnrolled", color: "#18A957" },
  onhold: { labelKey: "dashStageOnhold", color: "#E6A700" },
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

  const [custRes, enrRes, affRes, profRes, dipRes, refundRes, batchRes] = await Promise.all([
    supabase.from("customers").select("id,stage,affiliate_code,owner_id").eq("deleted", false).eq("archived", false),
    supabase.from("enrollments").select("customer_id,diploma_id"),
    supabase.from("app_settings").select("value").eq("key", "affiliates").maybeSingle(),
    supabase.from("profiles").select("id,full_name,team"),
    supabase.from("diplomas").select("id,name_ar"),
    supabase.from("refunds").select("customer_id"),
    supabase.from("batches").select("id,code").order("start_date", { ascending: false }),
  ]);

  const custs = (custRes.data as any[]) || [];
  const enrs = (enrRes.data as any[]) || [];
  const profiles = (profRes.data as any[]) || [];
  const diplomas = (dipRes.data as any[]) || [];
  const pName = new Map(profiles.map((p) => [p.id, p.full_name]));
  const dName = new Map(diplomas.map((d) => [d.id, d.name_ar]));

  // ==== توزيع المراحل ====
  const stageCount: Record<string, number> = {};
  custs.forEach((c) => { const s = c.stage || "new"; stageCount[s] = (stageCount[s] || 0) + 1; });
  const stageRows = Object.keys(STAGES).map((k) => ({
    key: k, label: tr(STAGES[k].labelKey), color: STAGES[k].color, n: stageCount[k] || 0,
  }));
  const totalCust = custs.length;

  // ==== أفضل الدبلومات ====
  const dipCount: Record<string, number> = {};
  enrs.forEach((e) => { if (e.diploma_id) dipCount[e.diploma_id] = (dipCount[e.diploma_id] || 0) + 1; });
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

  // ==== المالية + الشهري + العملات ====
  let agreed = 0, collected = 0, overdueN = 0, agreedUsd = 0, collectedUsd = 0;
  const monthlyMap: Record<string, number> = {};
  const collectedByOwner: Record<string, { egp: number; usd: number }> = {};
  // نحتاج ربط installment بالمالك (عبر enrollment→customer→owner)
  const enrOwner = new Map<string, string>(); // enrollment_id → owner_id
  if (canFinance) {
    const { data: enrFull } = await supabase.from("enrollments").select("id,customer_id");
    const custOwner = new Map(custs.map((c) => [c.id, c.owner_id]));
    (enrFull || []).forEach((e: any) => { const o = custOwner.get(e.customer_id); if (o) enrOwner.set(e.id, o); });

    const [{ data: fin }, { data: insts }] = await Promise.all([
      supabase.from("enrollment_finance").select("agreed_amount,currency"),
      supabase.from("installments").select("enrollment_id,amount,currency,due_date,paid_at,status"),
    ]);
    (fin || []).forEach((f: any) => {
      if (f.currency === "USD") agreedUsd += Number(f.agreed_amount) || 0;
      else agreed += Number(f.agreed_amount) || 0;
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    (insts || []).forEach((i: any) => {
      const paid = i.status === "paid" || i.paid_at;
      const amt = Number(i.amount) || 0;
      if (paid) {
        if (i.currency === "USD") collectedUsd += amt; else collected += amt;
        // شهري (بالجنيه)
        if (i.paid_at && i.currency !== "USD") {
          const m = String(i.paid_at).slice(0, 7);
          monthlyMap[m] = (monthlyMap[m] || 0) + amt;
        }
        // لكل مندوب
        const owner = enrOwner.get(i.enrollment_id);
        if (owner) {
          if (!collectedByOwner[owner]) collectedByOwner[owner] = { egp: 0, usd: 0 };
          if (i.currency === "USD") collectedByOwner[owner].usd += amt; else collectedByOwner[owner].egp += amt;
        }
      } else if (i.due_date && new Date(i.due_date) < today) overdueN++;
    });
  }

  // آخر 6 شهور
  const monthly: { label: string; value: number }[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(); d.setMonth(d.getMonth() - k);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("ar-EG", { month: "short" });
    monthly.push({ label, value: Math.round(monthlyMap[key] || 0) });
  }

  // ==== أداء المبيعات (team=sales/admin) ====
  const enrolledSet = new Set(enrs.map((e) => e.customer_id));
  const salesIds = profiles.filter((p) => p.team === "sales" || p.team === "admin").map((p) => p.id);
  const salesRows = salesIds.map((id) => {
    const mine = custs.filter((c) => c.owner_id === id);
    const enr = mine.filter((c) => enrolledSet.has(c.id)).length;
    const co = collectedByOwner[id] || { egp: 0, usd: 0 };
    return {
      name: pName.get(id) || "—", customers: mine.length, enrolled: enr,
      conv: mine.length ? Math.round((enr / mine.length) * 100) : 0,
      collectedEgp: Math.round(co.egp), collectedUsd: Math.round(co.usd),
    };
  }).filter((r) => r.customers > 0).sort((a, b) => b.customers - a.customers);

  // ==== أداء الدعم (من التذاكر) ====
  const { data: tickets } = await supabase.from("tickets").select("assignee_id,status");
  const supAgg: Record<string, { total: number; open: number; closed: number }> = {};
  ((tickets as any[]) || []).forEach((t) => {
    const id = t.assignee_id; if (!id) return;
    if (!supAgg[id]) supAgg[id] = { total: 0, open: 0, closed: 0 };
    supAgg[id].total++;
    if (t.status === "closed" || t.status === "resolved") supAgg[id].closed++;
    else supAgg[id].open++;
  });
  const supportRows = Object.entries(supAgg).map(([id, v]) => ({
    name: pName.get(id) || "—", total: v.total, open: v.open, closed: v.closed,
  })).sort((a, b) => b.total - a.total);

  // ==== الأفيلييت ====
  const affList: any[] = Array.isArray(affRes.data?.value) ? (affRes.data!.value as any[]) : [];
  const affName = new Map(affList.map((a) => [a.code, a]));
  const affAgg: Record<string, { customers: number; enrolled: number }> = {};
  custs.forEach((c) => {
    const code = (c.affiliate_code || "").trim(); if (!code) return;
    if (!affAgg[code]) affAgg[code] = { customers: 0, enrolled: 0 };
    affAgg[code].customers++;
    if (enrolledSet.has(c.id)) affAgg[code].enrolled++;
  });
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
    />
  );
}
