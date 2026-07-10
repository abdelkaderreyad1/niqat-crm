import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import BatchDoneBtn from "./batches/BatchDoneBtn";
import BatchesByDiploma from "./BatchesByDiploma";
import { CountUp, Donut, BarRow } from "./Charts";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "new", labelKey: "dashStageNew", color: "#2F6BFF" },
  { key: "contacted", labelKey: "dashStageContacted", color: "#0FA3A3" },
  { key: "interested", labelKey: "dashStageInterested", color: "#7B61FF" },
  { key: "quote", labelKey: "dashStageQuote", color: "#E6A700" },
  { key: "negotiation", labelKey: "dashStageNegotiation", color: "#F08A24" },
  { key: "enrolled", labelKey: "dashStageEnrolled", color: "#18A957" },
  { key: "onhold", labelKey: "dashStageOnhold", color: "#E6A700" },
  { key: "lost", labelKey: "dashStageLost", color: "#94A2BB" },
];
const DC = ["#F08A24", "#2F6BFF", "#0FA3A3", "#7B61FF", "#18A957", "#E6A700", "#E0483B"];
const fmtMoney = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }); } catch { return d; } };

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const todayStr = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const [meRes, dsRes, specsRes, custRes, enrRes, dipRes, btRes, tkRes, fuRes, hoRes, logRes, profRes] = await Promise.all([
    supabase.from("profiles").select("can_see_finance,can_grant_access,can_manage_batches").eq("id", user?.id || "").maybeSingle(),
    supabase.from("profiles").select("can_see_daily_sales").eq("id", user?.id || "").maybeSingle(),
    supabase.from("specialties").select("id,name_ar"),
    supabase.from("customers").select("id,name,stage,specialty_id").eq("deleted", false).eq("archived", false),
    supabase.from("enrollments").select("id,customer_id,diploma_id,batch_id"),
    supabase.from("diplomas").select("id,name_ar"),
    supabase.from("batches").select("id,code,status,start_date,capacity").order("start_date"),
    supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "progress"]),
    supabase.from("follow_ups").select("customer_id,due_at,note").eq("done", false).lte("due_at", new Date().toISOString()),
    supabase.from("handoffs").select("customer_id").eq("status", "pending"),
    supabase.from("audit_log").select("customer_id,actor_id,action,detail,at").order("at", { ascending: false }).limit(8),
    supabase.from("profiles").select("id,full_name"),
  ]);

  const me = meRes.data;
  const canFinance = !!me?.can_see_finance;
  const canManageBatches = !!me?.can_manage_batches;
  const canDailySales = !!dsRes.data?.can_see_daily_sales;
  const spName = new Map(((specsRes.data as any[]) || []).map((s: any) => [s.id, s.name_ar]));

  const customers = (custRes.data as any[]) || [];
  const enrollments = (enrRes.data as any[]) || [];
  const diplomas = (dipRes.data as any[]) || [];
  const batches = (btRes.data as any[]) || [];
  // تواريخ النهاية (دفاعي: العمود ممكن يكون لسه مش موجود)
  const endMap = new Map<string, string>();
  if (batches.length) {
    const eRes = await supabase.from("batches").select("id,end_date");
    if (!eRes.error) for (const r of (eRes.data as any[]) || []) if (r.end_date) endMap.set(r.id, r.end_date);
  }
  const cName = new Map(customers.map((c) => [c.id, c.name]));
  const pName = new Map(((profRes.data as any[]) || []).map((p) => [p.id, p.full_name]));
  const dName = new Map(diplomas.map((d) => [d.id, d.name_ar]));
  const enrCust = new Map(enrollments.map((e) => [e.id, e.customer_id]));

  const total = customers.length;
  const byStage: Record<string, number> = {};
  for (const c of customers) byStage[c.stage] = (byStage[c.stage] || 0) + 1;
  const enrolled = byStage["enrolled"] || 0;
  const leads = customers.filter((c) => c.stage !== "enrolled" && c.stage !== "lost").length;
  const conv = total ? Math.round((enrolled / total) * 100) : 0;
  // مهام اليوم: مهامي غير المكتملة المستحقة لغاية النهارده
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const { count: tasksToday } = await supabase.from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("assignee_id", user?.id || "")
    .eq("done", false)
    .lte("due_at", endToday.toISOString());

  // المالية
  let revenue = 0, outstanding = 0, overdueInst: any[] = [], soonInst: any[] = [];
  if (canFinance) {
    const { data: inst } = await supabase.from("installments").select("enrollment_id,amount,paid_at,due_date,status");
    for (const i of (inst as any[]) || []) {
      const paid = !!i.paid_at || i.status === "paid";
      if (paid) revenue += Number(i.amount) || 0;
      else {
        outstanding += Number(i.amount) || 0;
        if (i.due_date && i.due_date < todayStr) overdueInst.push(i);
        else if (i.due_date && i.due_date <= in7) soonInst.push(i);
      }
    }
  }

  // مطلوب إجراء
  const followItems = (fuRes.data as any[]) || [];
  const handoffItems = (hoRes.data as any[]) || [];
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

  // by diploma donut
  const byDip = diplomas.map((d) => ({ name: d.name_ar, n: enrollments.filter((e) => e.diploma_id === d.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const dipTot = byDip.reduce((s, x) => s + x.n, 0) || 1;
  let acc = 0;
  const segs = byDip.map((x, i) => { const st = (acc / dipTot) * 360; acc += x.n; return `${DC[i % DC.length]} ${st}deg ${(acc / dipTot) * 360}deg`; }).join(",");
  const dipDonut = byDip.map((x, i) => ({ label: x.name, value: x.n, color: DC[i % DC.length] }));

  // by batch
  const byBatch = batches.map((b) => ({ code: b.code, n: enrollments.filter((e) => e.batch_id === b.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const bMax = Math.max(...byBatch.map((x) => x.n), 1);

  // الباتشات مجمّعة تحت كل دبلومة (احترافي + قابل للنمو)
  const batchMeta = new Map(batches.map((b) => [b.id, { code: b.code, status: b.status }]));
  // لكل دبلومة: عدد عملائها الكلي + باتشاتها (كل باتش وعدد عملائه في الدبلومة دي)
  const diploMap: Record<string, { name: string; total: number; batches: Record<string, number> }> = {};
  for (const e of enrollments) {
    if (!e.diploma_id) continue;
    const dn = dName.get(e.diploma_id) || "—";
    if (!diploMap[e.diploma_id]) diploMap[e.diploma_id] = { name: dn, total: 0, batches: {} };
    diploMap[e.diploma_id].total++;
    const bcode = e.batch_id ? (batchMeta.get(e.batch_id)?.code || "—") : "—";
    diploMap[e.diploma_id].batches[bcode] = (diploMap[e.diploma_id].batches[bcode] || 0) + 1;
  }
  const batchesByDiploma = Object.values(diploMap)
    .map((d) => ({
      name: d.name,
      total: d.total,
      batches: Object.entries(d.batches).map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n),
    }))
    .sort((a, b) => b.total - a.total);

  const generalKpis = [
    { label: tr("totalCust"), value: total, color: "#2F6BFF", emoji: "👥" },
    { label: tr("newLeads"), value: leads, color: "#F08A24", emoji: "🎯" },
    { label: tr("convRate"), value: conv, suffix: "%", color: "#18A957", emoji: "📈" },
    { label: tr("tasksToday"), value: tasksToday ?? 0, color: "#7B61FF", emoji: "✅" },
    { label: tr("openTk"), value: tkRes.count ?? 0, color: "#E0483B", emoji: "🎫" },
  ];

  // تحويلات النهاردة الفعلية (أقساط + إضافات مدفوعة) — جنيه ودولار منفصلين
  let todayEgp = 0, todayUsd = 0, todayCount = 0;
  if (canDailySales) {
    // بداية ونهاية اليوم بتوقيت القاهرة (UTC+2) — عشان اليوم يبدأ 12:00 ص وينتهي 11:59 م بتوقيت مصر
    // بداية/نهاية اليوم بتوقيت مصر (Africa/Cairo) — يتعامل مع الصيفي/الشتوي تلقائياً
    // نحسب أوفست مصر الحالي ديناميكياً من الـ IANA timezone
    const cairoOffsetMs = (() => {
      const now = new Date();
      // نجيب الوقت كما يظهر في القاهرة، ونقارنه بالـ UTC عشان نطلّع الفرق
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
    // منتصف ليل القاهرة → نطرح الأوفست نرجّعها UTC للاستعلام
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

  // التخصصات الهندسية: العملاء المسجّلين/الدافعين لكل تخصص
  const spCount: Record<string, number> = {};
  for (const c of customers) if (c.stage === "enrolled" && c.specialty_id) spCount[c.specialty_id] = (spCount[c.specialty_id] || 0) + 1;
  const spRows = Object.entries(spCount).map(([id, n]) => ({ name: spName.get(id) || "—", n })).sort((a, b) => b.n - a.n);
  const spMax = Math.max(...spRows.map((r) => r.n), 1);

  return (
    <div>
      <div className="page-h"><div><h1>{tr("dash")}</h1><p>{tr("dashDesc")}</p></div></div>

      {/* ===== شريط الفلوس: تحويلات اليوم + المالية ===== */}
      {(canDailySales || canFinance) && (
        <div className="grid2" style={{ marginBottom: 16 }}>
          {canDailySales && (
            <div className="card" style={{ padding: 20, background: "linear-gradient(135deg,#18A95712,#0FA3A312)", border: "1px solid #18A95733" }}>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}><span style={{ marginInlineEnd: 6 }}>🟢</span>{tr("todayCollections")}</span>
                {todayCount > 0 && <span className="chip" style={{ background: "#18A95722", color: "#18A957" }}>{todayCount}</span>}
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline" }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#18A957" }}>
                  <CountUp value={todayEgp} /> <span style={{ fontSize: 15 }}>{tr("egpShort")}</span>
                </div>
                <div style={{ borderInlineStart: "1px solid var(--line)", paddingInlineStart: 20, fontSize: 30, fontWeight: 800, color: "#0FA3A3" }}>
                  $<CountUp value={todayUsd} />
                </div>
              </div>
            </div>
          )}
          {canFinance && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 10, fontWeight: 700 }}>💰 {tr("financeOverview")}</div>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 2 }}>{tr("revenue")}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0FA3A3" }}><CountUp value={revenue} /></div>
                </div>
                <div style={{ borderInlineStart: "1px solid var(--line)", paddingInlineStart: 22 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 2 }}>{tr("outstanding")}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#E6A700" }}><CountUp value={outstanding} /></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== KPIs عامة مكثّفة ===== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        {generalKpis.map((k) => (
          <div key={k.label} className="card rise" style={{ padding: 16 }}>
            <div style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 4 }}><span style={{ marginInlineEnd: 5 }}>{(k as any).emoji}</span>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>
              {typeof k.value === "number" ? <CountUp value={k.value} suffix={(k as any).suffix || ""} /> : k.value}
            </div>
          </div>
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
              <BarRow key={x.name} label={<span>{i === 0 ? "🏆 " : ""}{x.name}</span>} value={x.n} max={spMax} color="#2F6BFF" />
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
          {((logRes.data as any[]) || []).length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noActivity")}</div>}
          {((logRes.data as any[]) || []).map((l, idx) => (
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
    </div>
  );
}
