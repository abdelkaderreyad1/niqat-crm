import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import BatchDoneBtn from "./batches/BatchDoneBtn";
import BatchesByDiploma from "./BatchesByDiploma";
import { CountUp, Donut, BarRow, Kpi, LineIcon } from "./Charts";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "contacted", labelKey: "dashStageContacted", color: "#0FA3A3" },
  { key: "interested", labelKey: "dashStageInterested", color: "#7B61FF" },
  { key: "enrolled", labelKey: "dashStageEnrolled", color: "#18A957" },
  { key: "onhold", labelKey: "dashStageOnhold", color: "#E6A700" },
];
const DC = ["#F08A24", "#2F6BFF", "#0FA3A3", "#7B61FF", "#18A957", "#E6A700", "#E0483B"];
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }); } catch { return d; } };

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const todayStr = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

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
    supabase.rpc("dash_stage_counts"),
    supabase.rpc("dash_specialty_enrolled"),
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
    const { data: ft } = await supabase.rpc("fin_totals");
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

  // مطلوب إجراء
  const actionRow = (cid: string, text: string, sub: string, color: string) => (
    <Link key={cid + sub} href={`/customers/${cid}`} className="rmd">
      <span className="rdot" style={{ background: color }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 13.5 }}>{text}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</div>
      </div>
    </Link>
  );
  const grp = (title: string, color: string, rows: any[]) =>
    rows.length ? (
      <div key={title} style={{ marginBottom: 6 }}>
        <div className="rmgrp-h"><span className="rdot" style={{ background: color }} />{title}<span className="cnt">{rows.length}</span></div>
        {rows}
      </div>
    ) : null;

  const overdueRows = overdueInst.map((i) => { const cid = enrCust.get(i.enrollment_id); return cid ? actionRow(cid, cName.get(cid) || tr("customerFallback"), `${tr("overdueInstSub")} · ${fmtDate(i.due_date)}`, "#E5484D") : null; }).filter(Boolean);
  const soonRows = soonInst.map((i) => { const cid = enrCust.get(i.enrollment_id); return cid ? actionRow(cid, cName.get(cid) || tr("customerFallback"), `${tr("dueOn")} ${fmtDate(i.due_date)}`, "#F5A623") : null; }).filter(Boolean);
  const followRows = followItems.map((f) => actionRow(f.customer_id, cName.get(f.customer_id) || tr("customerFallback"), f.note || tr("followDueSub"), "#2F6BFF"));
  const handoffRows = handoffItems.map((h) => actionRow(h.customer_id, cName.get(h.customer_id) || tr("customerFallback"), tr("awaitAccessSub"), "#F08A24"));
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

      {/* ===== KPIs عامة مكثّفة (كومبوننت موحّد) ===== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        {generalKpis.map((k) => (
          <Kpi key={k.label} label={k.label} value={k.value} color={k.color} icon={(k as any).icon}
            suffix={(k as any).suffix || ""}
            trend={(k as any).trend ? { dir: (k as any).trend.dir, pct: (k as any).trend.pct, note: `· +${(k as any).trend.newThis} ${tr("thisMonth")}` } : null} />
        ))}
      </div>

      {/* ===== مطلوب إجراء + جدول الباتشات ===== */}
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>{tr("alertsT")}</h3><span className="chip">{actionCount}</span>
          </div>
          <div style={{ marginTop: 10, maxHeight: 360, overflowY: "auto" }}>
            {actionCount === 0 ? (
              <div style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", padding: 20 }}>{tr("noAlerts")} 🎉</div>
            ) : (
              <>
                {canFinance && grp(tr("overdueInst"), "#E5484D", overdueRows)}
                {canFinance && grp(tr("dueSoon"), "#F5A623", soonRows)}
                {grp(tr("followDue"), "#2F6BFF", followRows)}
                {grp(tr("pendingAccessT"), "#F08A24", handoffRows)}
              </>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>{tr("schedule")}</h3><span className="chip">{batches.length}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            {batches.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noBatches")}</div>}
            {batches
              .filter((b) => b.status !== "closed")
              .sort((a, b) => String(a.start_date || "9999").localeCompare(String(b.start_date || "9999")))
              .slice(0, 6)
              .map((b) => {
                const st = b.status === "full" ? { l: tr("fullLabel"), c: "#E0483B" } : { l: tr("availableLabel"), c: "#18A957" };
                const end = endMap.get(b.id);
                const range = (b.start_date ? String(b.start_date).slice(0, 10) : "—") + (end ? " → " + String(end).slice(0, 10) : "");
                return (
                  <div key={b.id} className="sch">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.c, flexShrink: 0, marginInlineEnd: 8 }} />
                    <div style={{ fontWeight: 800, color: "var(--ink)" }}>{b.code}</div>
                    <div className="num" style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, marginInlineStart: 12 }}>{range}</div>
                    {canManageBatches && b.status !== "closed" && <BatchDoneBtn id={b.id} />}
                    <span className="stg" style={{ background: st.c + "1a", color: st.c, marginInlineStart: 10 }}>{st.l}</span>
                  </div>
                );
              })}
            <Link href="/batches" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, padding: "9px 0", borderRadius: 10, border: "1px solid var(--line)", color: "var(--brand)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              {tr("viewAll")} ({batches.length})
              <span style={{ fontSize: 15 }}>←</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ===== ملخص المسار + دونات الدبلومات ===== */}
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="card-h"><h3>{tr("pipelineSummary")}</h3><span className="chip">{total}</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {STAGES.map((s) => (
              <BarRow key={s.key} label={<span><span style={{ background: s.color, display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginInlineEnd: 6 }} />{tr(s.labelKey)}</span>} value={byStage[s.key] || 0} max={total || 1} color={s.color} />
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="card-h"><h3>{tr("byDiploma")}</h3></div>
          {dipDonut.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>{tr("noEnrolls")}</div>
          ) : (
            <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
              <Donut data={dipDonut} />
              <div style={{ flex: 1, minWidth: 140 }}>
                {dipDonut.map((x) => (
                  <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
                    <i style={{ background: x.color, width: 10, height: 10, borderRadius: 3, display: "inline-block" }} />
                    <span style={{ flex: 1 }}>{x.label}</span>
                    <span className="num" style={{ fontWeight: 700, color: "var(--muted)" }}>{x.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
