import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import BatchDoneBtn from "./batches/BatchDoneBtn";
import BatchesByDiploma from "./BatchesByDiploma";
import { CountUp, BarRow, Kpi, LineIcon, ApexCombo, ApexRadial, ApexDonut } from "./Charts";
import PeriodFilter from "./PeriodFilter";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "contacted", labelKey: "dashStageContacted", color: "#0FA3A3" },
  { key: "interested", labelKey: "dashStageInterested", color: "#7B61FF" },
  { key: "enrolled", labelKey: "dashStageEnrolled", color: "#18A957" },
  { key: "onhold", labelKey: "dashStageOnhold", color: "#E6A700" },
];
const DC = ["#F08A24", "#2F6BFF", "#0FA3A3", "#7B61FF", "#18A957", "#E6A700", "#E0483B"];
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }); } catch { return d; } };
const money = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));

// نطاق الفترة بتوقيت مصر — يرجّع {from,to} ISO أو null لكل الوقت
function periodRange(period: string): { from: string; to: string } | null {
  if (!period || period === "all") return null;
  const now = new Date();
  const to = now.toISOString();
  const cairoMs = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" })).getTime()
    - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const nowCairo = new Date(now.getTime() + cairoMs);
  let from: Date;
  if (period === "today") { const d = new Date(nowCairo); d.setHours(0, 0, 0, 0); from = new Date(d.getTime() - cairoMs); }
  else if (period === "7") from = new Date(now.getTime() - 7 * 864e5);
  else if (period === "30") from = new Date(now.getTime() - 30 * 864e5);
  else if (period === "month") { const d = new Date(nowCairo.getFullYear(), nowCairo.getMonth(), 1); from = new Date(d.getTime() - cairoMs); }
  else return null;
  return { from: from.toISOString(), to };
}

export default async function Dashboard({ searchParams }: { searchParams?: { period?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const todayStr = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  // نطاق الفترة المختار (Africa/Cairo). null = كل الوقت
  const period = searchParams?.period || "all";
  const range = periodRange(period);
  const rpcArgs = range ? { p_from: range.from, p_to: range.to } : undefined;

  const [meRes, dsRes, specsRes, dipRes, btRes, tkRes, fuRes, hoRes, logRes, profRes,
         scRes, seRes, edRes, ebRes] = await Promise.all([
    supabase.from("profiles").select("can_see_finance,can_grant_access,can_manage_batches,team").eq("id", user?.id || "").maybeSingle(),
    supabase.from("profiles").select("can_see_daily_sales").eq("id", user?.id || "").maybeSingle(),
    supabase.from("specialties").select("id,name_ar"),
    supabase.from("diplomas").select("id,name_ar"),
    supabase.from("batches").select("id,code,status,start_date,capacity,diploma_id").order("start_date"),
    supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "progress"]),
    supabase.from("follow_ups").select("customer_id,due_at,note").eq("done", false).lte("due_at", new Date().toISOString()),
    supabase.from("handoffs").select("customer_id").eq("status", "pending"),
    supabase.from("audit_log").select("customer_id,actor_id,action,detail,at").order("at", { ascending: false }).limit(8),
    supabase.from("profiles").select("id,full_name"),
    supabase.rpc("dash_stage_counts", rpcArgs),
    supabase.rpc("dash_specialty_enrolled", rpcArgs),
    supabase.rpc("dash_enrollment_diploma"),
    supabase.rpc("dash_enrollment_batch"),
  ]);

  const me = meRes.data;
  const canFinance = !!me?.can_see_finance;
  const canManageBatches = !!me?.can_manage_batches;
  const isAdmin = (me as any)?.team === "admin";
  const isSales = (me as any)?.team === "sales" && !isAdmin;
  const canDailySales = !!dsRes.data?.can_see_daily_sales;
  const spName = new Map(((specsRes.data as any[]) || []).map((s: any) => [s.id, s.name_ar]));
  const diplomas = (dipRes.data as any[]) || [];
  const batches = (btRes.data as any[]) || [];
  const pName = new Map(((profRes.data as any[]) || []).map((p: any) => [p.id, p.full_name]));
  const dName = new Map(diplomas.map((d: any) => [d.id, d.name_ar]));

  // ===== الأعداد من دوال القاعدة (بدون سقف 1000) =====
  const byStage: Record<string, number> = {};
  for (const r of (scRes.data as any[]) || []) byStage[r.stage] = Number(r.n) || 0;
  const total = Object.values(byStage).reduce((a, b) => a + b, 0);
  const enrolled = byStage["enrolled"] || 0;
  const lost = byStage["onhold"] || 0;
  const leads = total - enrolled - lost;
  const conv = total ? Math.round((enrolled / total) * 100) : 0;

  // تواريخ النهاية (دفاعي)
  const endMap = new Map<string, string>();
  if (batches.length) {
    const eRes = await supabase.from("batches").select("id,end_date");
    if (!eRes.error) for (const r of (eRes.data as any[]) || []) if (r.end_date) endMap.set(r.id, r.end_date);
  }

  // مهام اليوم
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const { count: tasksToday } = await supabase.from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("assignee_id", user?.id || "").eq("done", false).lte("due_at", endToday.toISOString());

  // ===== «شغلي» (لموظف المبيعات) — عملائي/متابعات اليوم/مهامي/مساري =====
  const myUid = user?.id || "";
  let myCustCount = 0, myFollowToday = 0, myTasksOpen = 0;
  const myPipe: Record<string, number> = {};
  if (isSales) {
    const startTodayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const endTodayIso = endToday.toISOString();
    const [mc, mf, mt, ...stageCounts] = await Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("owner_id", myUid).eq("deleted", false).eq("archived", false),
      supabase.from("follow_ups").select("*", { count: "exact", head: true }).eq("owner_id", myUid).eq("done", false).gte("due_at", startTodayIso).lte("due_at", endTodayIso),
      supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", myUid).eq("done", false),
      ...STAGES.map((s) => supabase.from("customers").select("*", { count: "exact", head: true }).eq("owner_id", myUid).eq("deleted", false).eq("archived", false).eq("stage", s.key)),
    ]);
    myCustCount = mc.count || 0;
    myFollowToday = mf.count || 0;
    myTasksOpen = mt.count || 0;
    STAGES.forEach((s, i) => { myPipe[s.key] = (stageCounts[i] as any)?.count || 0; });
  }
  const myPipeMax = Math.max(1, ...Object.values(myPipe));

  // ===== المالية: إجماليات مفصولة بالعملة (من دالة fin_totals) + تنبيهات =====
  let egpCollected = 0, egpDue = 0, usdCollected = 0, usdDue = 0;
  let overdueInst: any[] = [], soonInst: any[] = [];
  let refundGroups: { diploma: string; batch: string; egp: number; usd: number; count: number }[] = [];
  if (canFinance) {
    const { data: ft } = await supabase.rpc("fin_totals", rpcArgs);
    for (const r of (ft as any[]) || []) {
      if (r.currency === "USD") { usdCollected = Number(r.collected) || 0; usdDue = Number(r.due) || 0; }
      else { egpCollected += Number(r.collected) || 0; egpDue += Number(r.due) || 0; }
    }
    // تنبيهات: أقساط غير مدفوعة ليها تاريخ استحقاق لغاية +7 أيام (عددها طبيعي صغير)
    const { data: al } = await supabase.from("installments")
      .select("enrollment_id,amount,due_date,status,paid_at")
      .neq("status", "paid").is("paid_at", null)
      .not("due_date", "is", null).lte("due_date", in7)
      .order("due_date").limit(200);
    for (const i of (al as any[]) || []) { if (i.due_date < todayStr) overdueInst.push(i); else soonInst.push(i); }

    // ريفند لكل دبلومة/باتش — المرتجع فعلاً بس (refunded/closed)، جنيه ودولار منفصلين
    const { data: refR } = await supabase.from("refunds")
      .select("amount,currency,status,enrollment_id,enrollments(diploma_id,batch_id)")
      .in("status", ["refunded", "closed"]);
    const bCode = new Map(batches.map((b: any) => [b.id, b.code]));
    const rMap: Record<string, { diploma: string; batch: string; egp: number; usd: number; count: number }> = {};
    for (const r of (refR as any[]) || []) {
      const enr = (r as any).enrollments;
      const dipId = enr?.diploma_id || null;
      const btId = enr?.batch_id || null;
      const key = (dipId || "none") + "|" + (btId || "none");
      if (!rMap[key]) rMap[key] = {
        diploma: dipId ? (dName.get(dipId) || "—") : tr("undefinedGroup"),
        batch: btId ? (bCode.get(btId) || "—") : "—",
        egp: 0, usd: 0, count: 0,
      };
      if (r.currency === "USD") rMap[key].usd += Number(r.amount) || 0;
      else rMap[key].egp += Number(r.amount) || 0;
      rMap[key].count += 1;
    }
    refundGroups = Object.values(rMap).sort((a, b) => (b.egp + b.usd) - (a.egp + a.usd));
  }

  // ===== أسماء العملاء المطلوبة للعرض فقط (تنبيهات + نشاطات) =====
  const followItems = (fuRes.data as any[]) || [];
  const handoffItems = (hoRes.data as any[]) || [];
  const logItems = (logRes.data as any[]) || [];
  const enrCust = new Map<string, string>();
  const needEnrIds = Array.from(new Set([...overdueInst, ...soonInst].map((i) => i.enrollment_id).filter(Boolean)));
  if (needEnrIds.length) {
    const { data: er } = await supabase.from("enrollments").select("id,customer_id").in("id", needEnrIds);
    for (const e of (er as any[]) || []) enrCust.set(e.id, e.customer_id);
  }
  const needCustIds = Array.from(new Set([
    ...followItems.map((f) => f.customer_id),
    ...handoffItems.map((h) => h.customer_id),
    ...logItems.map((l) => l.customer_id),
    ...Array.from(enrCust.values()),
  ].filter(Boolean)));
  const cName = new Map<string, string>();
  if (needCustIds.length) {
    const { data: cr } = await supabase.from("customers").select("id,name").in("id", needCustIds);
    for (const c of (cr as any[]) || []) cName.set(c.id, c.name);
  }

  // مطلوب إجراء (ستايل v6: أيقونة ملوّنة في مربّع + اسم + وصف + رابط أكشن)
  const actionRow = (cid: string, text: string, sub: string, color: string, badge?: { label: string; bg: string; fg: string }, icon = "clipboard", go = "") => (
    <Link key={cid + sub} href={`/customers/${cid}`} className="ar" style={{ textDecoration: "none" }}>
      <span className="tag" style={{ background: badge?.bg || "var(--brand-soft)", color: badge?.fg || "var(--brand-d)" }}><LineIcon name={icon} size={15} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="an">{text}</div>
        <div className="as">{sub}</div>
      </div>
      <span className="go">{go || badge?.label || tr("openWord")} ←</span>
    </Link>
  );
  const grp = (title: string, color: string, rows: any[]) =>
    rows.length ? (
      <div key={title} style={{ marginBottom: 6 }}>
        <div className="rmgrp-h"><span className="rdot" style={{ background: color }} />{title}<span className="cnt">{rows.length}</span></div>
        {rows}
      </div>
    ) : null;

  const overdueRows = overdueInst.map((i) => { const cid = enrCust.get(i.enrollment_id); return cid ? actionRow(cid, cName.get(cid) || tr("customerFallback"), `${tr("overdueInstSub")} · ${fmtDate(i.due_date)}`, "#E5484D", { label: tr("badgeOverdue"), bg: "var(--red-soft)", fg: "var(--red)" }, "wallet") : null; }).filter(Boolean);
  const soonRows = soonInst.map((i) => { const cid = enrCust.get(i.enrollment_id); return cid ? actionRow(cid, cName.get(cid) || tr("customerFallback"), `${tr("dueOn")} ${fmtDate(i.due_date)}`, "#F5A623", { label: tr("badgeSoon"), bg: "#FFFAEB", fg: "#B54708" }, "calendarCheck") : null; }).filter(Boolean);
  const followRows = followItems.map((f) => actionRow(f.customer_id, cName.get(f.customer_id) || tr("customerFallback"), f.note || tr("followDueSub"), "#2F6BFF", { label: tr("badgeFollow"), bg: "#EFF6FF", fg: "#2F6BFF" }, "calendarCheck"));
  const handoffRows = handoffItems.map((h) => actionRow(h.customer_id, cName.get(h.customer_id) || tr("customerFallback"), tr("awaitAccessSub"), "#F08A24", { label: tr("badgeActivate"), bg: "var(--brand-soft)", fg: "var(--brand-d)" }, "check"));
  const actionCount = overdueRows.length + soonRows.length + followRows.length + handoffRows.length;

  // ===== دونات الدبلومات (من دالة القاعدة) =====
  const dipCountMap = new Map<string, number>();
  for (const r of (edRes.data as any[]) || []) dipCountMap.set(r.diploma_id, Number(r.n) || 0);
  const byDip = diplomas.map((d: any) => ({ name: d.name_ar, n: dipCountMap.get(d.id) || 0 })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const dipDonut = byDip.map((x, i) => ({ label: x.name, value: x.n, color: DC[i % DC.length] }));

  // ===== الباتشات مجمّعة تحت كل دبلومة (من دالة عدّ الباتشات) =====
  const batchCountMap = new Map<string, number>();
  for (const r of (ebRes.data as any[]) || []) batchCountMap.set(r.batch_id, Number(r.n) || 0);
  const diploMap: Record<string, { name: string; total: number; batches: Record<string, number> }> = {};
  for (const b of batches) {
    if (!b.diploma_id) continue;
    const n = batchCountMap.get(b.id) || 0;
    if (!diploMap[b.diploma_id]) diploMap[b.diploma_id] = { name: dName.get(b.diploma_id) || "—", total: 0, batches: {} };
    diploMap[b.diploma_id].total += n;
    diploMap[b.diploma_id].batches[b.code] = (diploMap[b.diploma_id].batches[b.code] || 0) + n;
  }
  const batchesByDiploma = Object.values(diploMap)
    .map((d) => ({ name: d.name, total: d.total, batches: Object.entries(d.batches).map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n) }))
    .sort((a, b) => b.total - a.total);

  // اتجاه شهري: عملاء جدد هذا الشهر مقابل الشهر الماضي (count بدون سقف)
  const nowD = new Date();
  const mStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1).toISOString();
  const pStart = new Date(nowD.getFullYear(), nowD.getMonth() - 1, 1).toISOString();
  const [{ count: newThisC }, { count: newPrevC }] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("deleted", false).eq("archived", false).gte("created_at", mStart),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("deleted", false).eq("archived", false).gte("created_at", pStart).lt("created_at", mStart),
  ]);
  const newThis = newThisC || 0, newPrev = newPrevC || 0;
  const custTrend = (() => {
    if (newPrev === 0 && newThis === 0) return null;
    const diff = newThis - newPrev;
    const pct = newPrev > 0 ? Math.round((diff / newPrev) * 100) : 100;
    return { newThis, dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat", pct: Math.abs(pct) };
  })();

  // ===== سلاسل الرسومات (استعلامات قراءة فقط) =====
  // 12 شهر: عملاء جدد شهرياً (للكل) + التحصيل شهرياً (للماليات) — للرسم الهيرو
  const monthKeys: string[] = [];
  {
    const d0 = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
    for (let i = 11; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  }
  const start12 = new Date(nowD.getFullYear(), nowD.getMonth() - 11, 1).toISOString();
  const custByMonth: Record<string, number> = {};
  const colByMonth: Record<string, number> = {};
  monthKeys.forEach((k) => { custByMonth[k] = 0; colByMonth[k] = 0; });
  {
    // عملاء جدد شهرياً — نجيب created_at للـ 12 شهر ونجمّعهم
    const P = 1000;
    for (let from = 0; from < 200000; from += P) {
      const { data, error } = await supabase.from("customers").select("created_at")
        .eq("deleted", false).eq("archived", false).gte("created_at", start12).range(from, from + P - 1);
      if (error) break;
      const rows = (data as any[]) || [];
      for (const r of rows) { const k = String(r.created_at).slice(0, 7); if (k in custByMonth) custByMonth[k]++; }
      if (rows.length < P) break;
    }
  }
  if (canFinance) {
    // تحصيل شهري (جنيه) آخر 12 شهر — للخط في الرسم الهيرو
    const { data: colRows } = await supabase.from("installments")
      .select("amount,currency,paid_at").not("paid_at", "is", null).gte("paid_at", start12);
    for (const r of (colRows as any[]) || []) {
      if (r.currency === "USD") continue;
      const k = String(r.paid_at).slice(0, 7);
      if (k in colByMonth) colByMonth[k] += Number(r.amount) || 0;
    }
  }
  const heroBars = monthKeys.map((k) => custByMonth[k]);
  const heroLine = canFinance ? monthKeys.map((k) => colByMonth[k]) : undefined;
  const heroLabels = monthKeys.map((k) => new Intl.DateTimeFormat("ar-EG", { month: "short", timeZone: "Africa/Cairo" }).format(new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1)));

  const generalKpis = [
    { label: tr("totalCust"), value: total, color: "#2F6BFF", icon: "users", trend: custTrend },
    { label: tr("newLeads"), value: leads, color: "#F08A24", icon: "target" },
    { label: tr("convRate"), value: conv, suffix: "%", color: "#18A957", icon: "trending" },
    { label: tr("tasksToday"), value: tasksToday ?? 0, color: "#7B61FF", icon: "check" },
    { label: tr("openTk"), value: tkRes.count ?? 0, color: "#E0483B", icon: "ticket" },
  ];

  // تحويلات النهاردة الفعلية (أقساط + إضافات مدفوعة) — جنيه ودولار منفصلين
  let todayEgp = 0, todayUsd = 0, todayCount = 0;
  if (canDailySales) {
    const cairoOffsetMs = (() => {
      const now = new Date();
      const cairoParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).formatToParts(now).reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
      const asUtc = Date.UTC(+cairoParts.year, +cairoParts.month - 1, +cairoParts.day,
        +cairoParts.hour === 24 ? 0 : +cairoParts.hour, +cairoParts.minute, +cairoParts.second);
      return asUtc - now.getTime();
    })();
    const nowCairo = new Date(Date.now() + cairoOffsetMs);
    const y = nowCairo.getUTCFullYear(), m = nowCairo.getUTCMonth(), d = nowCairo.getUTCDate();
    const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - cairoOffsetMs);
    const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - cairoOffsetMs);
    const iso = startUtc.toISOString();
    const isoEnd = endUtc.toISOString();
    const [instToday, addonToday] = await Promise.all([
      supabase.from("installments").select("amount,currency,paid_at,status").gte("paid_at", iso).lte("paid_at", isoEnd),
      supabase.from("customer_addons").select("amount,currency,paid,created_at").eq("paid", true).gte("created_at", iso).lte("created_at", isoEnd),
    ]);
    for (const i of (instToday.data || []) as any[]) {
      if (i.status === "paid" || i.paid_at) {
        const amt = Number(i.amount) || 0;
        if (i.currency === "USD") todayUsd += amt; else todayEgp += amt;
        todayCount++;
      }
    }
    for (const a of (addonToday.data || []) as any[]) {
      const amt = Number(a.amount) || 0;
      if (a.currency === "USD") todayUsd += amt; else todayEgp += amt;
      todayCount++;
    }
  }

  // التخصصات الهندسية: المسجّلين لكل تخصص (من دالة القاعدة)
  const spCount: Record<string, number> = {};
  for (const r of (seRes.data as any[]) || []) spCount[r.specialty_id] = Number(r.n) || 0;
  const spRows = Object.entries(spCount).map(([id, n]) => ({ name: spName.get(id) || "—", n })).sort((a, b) => b.n - a.n);
  const spMax = Math.max(...spRows.map((r) => r.n), 1);

  return (
    <div>
      <div className="page-h"><div><h1>{tr("dash")}</h1><p>{tr("dashDesc")}</p></div></div>
      <PeriodFilter />

      {/* ===== «شغلي» — لموظف المبيعات فوق خالص ===== */}
      {isSales && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--brand-soft)", color: "var(--brand)" }}><LineIcon name="clipboard" size={15} /></span>
            {tr("myWork")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
            <Link href={`/customers?owner=${myUid}`} style={{ textDecoration: "none" }}><Kpi label={tr("myCustomers")} value={myCustCount} color="#2F6BFF" icon="users" /></Link>
            <Kpi label={tr("myFollowToday")} value={myFollowToday} color="#E6A700" icon="calendarCheck" />
            <Link href="/my-tasks" style={{ textDecoration: "none" }}><Kpi label={tr("myTasks")} value={myTasksOpen} color="#7B61FF" icon="check" /></Link>
            <Kpi label={tr("myPipelineTotal")} value={myCustCount} color="#18A957" icon="funnel" animate={false} />
          </div>
          {/* مساري */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: "rgba(24,169,87,.12)", color: "#18A957" }}><LineIcon name="funnel" size={17} /></span>
              <h3 style={{ margin: 0, fontSize: 15 }}>{tr("myPipeline")}</h3><span className="chip" style={{ marginInlineStart: 2 }}>{myCustCount}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {STAGES.map((s) => (
                <BarRow key={s.key} label={<span><span style={{ background: s.color, display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginInlineEnd: 6 }} />{tr(s.labelKey)}</span>} value={myPipe[s.key] || 0} max={myPipeMax} color={s.color} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== شريط الفلوس: تحويلات اليوم + المالية (بؤرة للأدمن/الماليات) ===== */}
      {(canDailySales || canFinance) && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16, alignItems: "stretch" }}>
          {canFinance && (
            <div className="card" style={{ padding: 20, flex: "1.7 1 340px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13, marginBottom: 14, fontWeight: 700 }}><LineIcon name="wallet" size={16} /> {tr("financeOverview")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1 }}>
                {[
                  { badge: tr("egpShort"), pre: "", collected: egpCollected, due: egpDue, accent: "#0FA3A3" },
                  { badge: "USD", pre: "$", collected: usdCollected, due: usdDue, accent: "#2F6BFF" },
                ].map((c) => (
                  <div key={c.badge} style={{ background: "rgba(127,127,127,0.06)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <span style={{ alignSelf: "flex-start", fontSize: 11.5, fontWeight: 800, color: c.accent, background: c.accent + "1a", padding: "2px 10px", borderRadius: 20 }}>{c.pre}{c.badge}</span>
                    <div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 2 }}>{tr("revenue")}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#18A957", lineHeight: 1.1 }}>{c.pre}<CountUp value={c.collected} /></div>
                    </div>
                    <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 8 }}>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 2 }}>{tr("outstanding")}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#E6A700", lineHeight: 1.1 }}>{c.pre}<CountUp value={c.due} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {canDailySales && (
            <div className="card" style={{ padding: 20, flex: "1 1 240px", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#18A95712,#0FA3A312)", border: "1px solid #18A95733" }}>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#18A957" }}><LineIcon name="dot" size={13} />{tr("todayCollections")}</span>
                {todayCount > 0 && <span className="chip" style={{ background: "#18A95722", color: "#18A957" }}>{todayCount}</span>}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 2 }}>{tr("egpShort")}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#18A957", lineHeight: 1 }}><CountUp value={todayEgp} /></div>
                </div>
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 2 }}>USD</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#0FA3A3", lineHeight: 1 }}>$<CountUp value={todayUsd} /></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== KPIs عامة — ستايل v6 ===== */}
      <div className="grid6 g4-6">
        {generalKpis.map((k) => {
          const td = (k as any).trend;
          return (
            <div key={k.label} className="card6 kpi6">
              <div className="kl">{k.label}</div>
              <div className="kv"><CountUp value={typeof k.value === "number" ? k.value : 0} />{(k as any).suffix || ""}</div>
              <div className="kf">
                {td && <span className={"delta6 " + (td.dir === "up" ? "up" : td.dir === "down" ? "dn" : "flat")}>{td.dir === "up" ? "↑" : td.dir === "down" ? "↓" : "•"} {td.pct}%</span>}
                {td?.newThis != null && <span className="kc">+{td.newThis} {tr("thisMonth")}</span>}
                {k.label === tr("convRate") && <span className="kc">{enrolled} {tr("enrolledCol")}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== رسم الأداء (أعمدة عملاء + خط تحصيل) — آخر 12 شهر ===== */}
      <div className="sh6"><span className="tick" /><h2>{tr("perf12mo")}</h2>
        <span className="side">{tr("newCustomersShort")}{canFinance ? " · " + tr("collectionWord") : ""}</span>
      </div>
      <div className="card6" style={{ padding: "16px 12px 8px" }}>
        <ApexCombo bars={heroBars} line={heroLine} labels={heroLabels} barName={tr("newCustomersShort")} lineName={tr("collectionWord")} showLine={canFinance} />
      </div>

      {/* ===== مطلوب إجراء (ستايل v4) + جدول الباتشات ===== */}
      {/* ===== مطلوب إجراء ===== */}
      <div className="sh6"><span className="tick" /><h2>{tr("alertsT")}</h2>{actionCount > 0 && <span className="meta">{actionCount} {tr("itemsWord")}</span>}</div>
      <div className="card6 actions6">
        {actionCount === 0 ? (
          <div style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", padding: 12 }}>{tr("noAlerts")} 🎉</div>
        ) : (
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {canFinance && overdueRows}
            {canFinance && soonRows}
            {followRows}
            {handoffRows}
          </div>
        )}
      </div>

      {/* ===== مواعيد الباتشات ===== */}
      <div className="sh6"><span className="tick" /><h2>{tr("schedule")}</h2>
        <Link href="/batches" className="side" style={{ textDecoration: "none" }}>{tr("viewAll")} ←</Link>
      </div>
      <div className="card6">
        {batches.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noBatches")}</div>}
        {batches
          .filter((b) => b.status !== "closed")
          .sort((a, b) => String(a.start_date || "9999").localeCompare(String(b.start_date || "9999")))
          .slice(0, 6)
          .map((b) => {
            const enr = batchCountMap.get(b.id) || 0;
            const cap = Number(b.capacity) || 0;
            const pct = cap > 0 ? Math.min(100, Math.round((enr / cap) * 100)) : 0;
            const end = endMap.get(b.id);
            const dip = dName.get(b.diploma_id) || "";
            const dayMs = 864e5;
            const startD = b.start_date ? new Date(b.start_date + "T00:00:00") : null;
            const endD = end ? new Date(end + "T23:59:59") : null;
            const nowT = Date.now();
            let timing = "", tcolor = "var(--muted-d)";
            if (endD && nowT > endD.getTime()) { timing = tr("batchEnded"); tcolor = "var(--muted)"; }
            else if (startD && nowT < startD.getTime()) {
              const days = Math.ceil((startD.getTime() - nowT) / dayMs);
              timing = tr("batchStartsIn").replace("{n}", String(days)); tcolor = "var(--brand-d)";
            } else if (startD) { timing = tr("batchOngoing"); tcolor = "var(--green)"; }
            const stt = (endD && nowT > endD.getTime())
              ? { l: tr("batchEnded"), s: "done", bar: "#C9CDD6" }
              : b.status === "full"
                ? { l: tr("fullLabel"), s: "full", bar: "var(--amber)" }
                : { l: tr("availableLabel"), s: "open", bar: "var(--green)" };
            const range = (startD ? fmtDate(b.start_date) : "—") + (end ? " — " + fmtDate(end) : "");
            return (
              <div key={b.id} className="bs6">
                <div className="bc">{b.code}</div>
                <div className="bm">
                  <div className="bt">{dip || b.code}</div>
                  <div className="bd">{range}{timing && <span style={{ color: tcolor, fontWeight: 700 }}> · {timing}</span>}</div>
                  <div className="bt-track"><i style={{ width: pct + "%", background: stt.bar }} /></div>
                  <div className="bcap">{cap > 0 ? `${enr} / ${cap} ${tr("seatWord")} · ${pct}%` : `${enr} ${tr("seatWord")}`}</div>
                </div>
                {canManageBatches && b.status !== "closed"
                  ? <BatchDoneBtn id={b.id} />
                  : <span className={"pill6 " + stt.s}>{stt.l}</span>}
              </div>
            );
          })}
      </div>

      {/* ===== ملخص المسار + دونات الدبلومات ===== */}
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="card-h"><h3>{tr("pipelineSummary")}</h3><span className="chip">{total}</span></div>
          <div className="funnel">
            {STAGES.map((s) => {
              const v = byStage[s.key] || 0;
              const max = Math.max(...STAGES.map((x) => byStage[x.key] || 0), 1);
              const pct = Math.max(14, Math.round((v / max) * 100));
              return (
                <div key={s.key} className="fn">
                  <span className="fl">{tr(s.labelKey)}</span>
                  <div className="fb" style={{ width: pct + "%", background: s.color }}>{v}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="card-h"><h3>{tr("byDiploma")}</h3></div>
          {dipDonut.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>{tr("noEnrolls")}</div>
          ) : (
            <ApexDonut labels={dipDonut.map((x) => x.label)} series={dipDonut.map((x) => x.value)}
              totalLabel={tr("enrolledCol")} totalValue={String(dipDonut.reduce((a, x) => a + x.value, 0))} />
          )}
        </div>
      </div>

      {/* ===== نسبة التحويل (راديال) ===== */}
      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--green-soft)", color: "var(--green)", flexShrink: 0 }}><LineIcon name="trending" size={16} /></span>
          <h3 style={{ margin: 0, fontSize: 15 }}>{tr("convRate")}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 210, flex: "0 0 210px" }}>
            <ApexRadial pct={conv} label={tr("enrolledOfTotal").replace("{e}", String(enrolled)).replace("{t}", String(total))} />
          </div>
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--fe)", color: "var(--ink)", lineHeight: 1 }}>{enrolled}</div>
            <div style={{ fontSize: 12, color: "var(--muted-d)", fontWeight: 600, marginTop: 3 }}>{tr("enrolledOfTotal").replace("{e}", String(enrolled)).replace("{t}", String(total))}</div>
          </div>
        </div>
      </div>

      {/* ===== التخصصات الهندسية + العملاء حسب الباتش ===== */}
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>{tr("specDist")}</h3><span className="chip">{spRows.length}</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {spRows.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noEnrolledYet")}</div>}
            {spRows.map((x, i) => (
              <BarRow key={x.name} label={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{i === 0 && <span style={{ color: "#E6A700", display: "inline-flex" }}><LineIcon name="trophy" size={13} /></span>}{x.name}</span>} value={x.n} max={spMax} color="#2F6BFF" />
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>{tr("byBatch")}</h3><span className="chip">{batchesByDiploma.length}</span>
          </div>
          <BatchesByDiploma groups={batchesByDiploma} />
        </div>
      </div>

      {/* ===== آخر النشاطات ===== */}
      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <div className="card-h"><h3>{tr("recentAct")}</h3></div>
        <div style={{ marginTop: 8 }}>
          {logItems.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noActivity")}</div>}
          {logItems.map((l, idx) => (
            <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: "#18A957", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--ink)" }}>{l.action}{l.detail ? ` — ${l.detail}` : ""}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {l.customer_id ? (cName.get(l.customer_id) || "") + " · " : ""}{pName.get(l.actor_id) || ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== الريفند لكل دبلومة/باتش — مطوي في الآخر (مرجع تشوفه لما تحتاجه) ===== */}
      {canFinance && refundGroups.length > 0 && (
        <details className="card" style={{ padding: 0 }}>
          <summary style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13.5, color: "var(--ink)", listStyle: "none" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><LineIcon name="undo" size={15} /> {tr("refundByDiplomaTitle")}</span>
            <span className="chip" style={{ marginInlineStart: 4 }}>{refundGroups.reduce((a, g) => a + g.count, 0)}</span>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} style={{ marginInlineStart: "auto", color: "var(--muted)" }}><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <div style={{ padding: "0 16px 16px" }}>
            <div className="tbl-wrap">
              <table style={{ minWidth: 480 }}>
                <thead><tr>
                  <th>{tr("theDiploma")}</th><th>{tr("theBatch")}</th>
                  <th>{tr("refundCount")}</th><th>{tr("egpShort")}</th><th>$</th>
                </tr></thead>
                <tbody>
                  {refundGroups.map((g, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{g.diploma}</td>
                      <td>{g.batch}</td>
                      <td className="num"><span dir="ltr">{g.count}</span></td>
                      <td className="num" style={{ color: g.egp > 0 ? "#E0483B" : "var(--muted)" }}><span dir="ltr">{g.egp > 0 ? new Intl.NumberFormat("en").format(Math.round(g.egp)) : "—"}</span></td>
                      <td className="num" style={{ color: g.usd > 0 ? "#E0483B" : "var(--muted)" }}><span dir="ltr">{g.usd > 0 ? "$" + new Intl.NumberFormat("en").format(Math.round(g.usd)) : "—"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>{tr("refundByDiplomaHint")}</div>
          </div>
        </details>
      )}
    </div>
  );
}
