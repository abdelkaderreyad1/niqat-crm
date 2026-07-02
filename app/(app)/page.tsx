import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import BatchDoneBtn from "./batches/BatchDoneBtn";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "new", label: "جديد", color: "#2F6BFF" },
  { key: "contacted", label: "تم التواصل", color: "#0FA3A3" },
  { key: "interested", label: "مهتم", color: "#7B61FF" },
  { key: "quote", label: "عرض سعر مُرسل", color: "#E6A700" },
  { key: "negotiation", label: "تفاوض", color: "#F08A24" },
  { key: "enrolled", label: "مسجّل / دفع", color: "#18A957" },
  { key: "lost", label: "مؤجل / مرفوض", color: "#94A2BB" },
];
const DC = ["#F08A24", "#2F6BFF", "#0FA3A3", "#7B61FF", "#18A957", "#E6A700", "#E0483B"];
const fmtMoney = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }); } catch { return d; } };

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("can_see_finance,can_grant_access,can_manage_batches").eq("id", user?.id || "").maybeSingle();
  const canFinance = !!me?.can_see_finance;
  const canManageBatches = !!me?.can_manage_batches;
  // صلاحية رؤية مبيعات اليوم (منفصلة — جلب آمن لو العمود لسه مش موجود)
  const { data: dsProf } = await supabase.from("profiles").select("can_see_daily_sales").eq("id", user?.id || "").maybeSingle();
  const canDailySales = !!dsProf?.can_see_daily_sales;
  // أسماء التخصصات
  const { data: specsD } = await supabase.from("specialties").select("id,name_ar");
  const spName = new Map((specsD || []).map((s: any) => [s.id, s.name_ar]));

  const todayStr = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const [custRes, enrRes, dipRes, btRes, tkRes, fuRes, hoRes, logRes, profRes] = await Promise.all([
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

  const overdueRows = overdueInst.map((i) => { const cid = enrCust.get(i.enrollment_id); return cid ? actionRow(cid, cName.get(cid) || "عميل", `قسط متأخر · ${fmtDate(i.due_date)}`, "#E5484D") : null; }).filter(Boolean);
  const soonRows = soonInst.map((i) => { const cid = enrCust.get(i.enrollment_id); return cid ? actionRow(cid, cName.get(cid) || "عميل", `يستحق ${fmtDate(i.due_date)}`, "#F5A623") : null; }).filter(Boolean);
  const followRows = followItems.map((f) => actionRow(f.customer_id, cName.get(f.customer_id) || "عميل", f.note || "متابعة مستحقة", "#2F6BFF"));
  const handoffRows = handoffItems.map((h) => actionRow(h.customer_id, cName.get(h.customer_id) || "عميل", "بانتظار تفعيل الأكسس", "#F08A24"));
  const actionCount = overdueRows.length + soonRows.length + followRows.length + handoffRows.length;

  // by diploma donut
  const byDip = diplomas.map((d) => ({ name: d.name_ar, n: enrollments.filter((e) => e.diploma_id === d.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const dipTot = byDip.reduce((s, x) => s + x.n, 0) || 1;
  let acc = 0;
  const segs = byDip.map((x, i) => { const st = (acc / dipTot) * 360; acc += x.n; return `${DC[i % DC.length]} ${st}deg ${(acc / dipTot) * 360}deg`; }).join(",");

  // by batch
  const byBatch = batches.map((b) => ({ code: b.code, n: enrollments.filter((e) => e.batch_id === b.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const bMax = Math.max(...byBatch.map((x) => x.n), 1);

  const kpis = [
    { label: tr("totalCust"), value: total, color: "#2F6BFF", emoji: "👥" },
    { label: tr("newLeads"), value: leads, color: "#F08A24", emoji: "🎯" },
    { label: tr("convRate"), value: conv + "%", color: "#18A957", emoji: "📈" },
    { label: tr("tasksToday"), value: tasksToday ?? 0, color: "#7B61FF", emoji: "✅" },
    ...(canFinance ? [
      { label: tr("revenue"), value: fmtMoney(revenue / 1000) + "K", color: "#0FA3A3", emoji: "💰" },
      { label: tr("outstanding"), value: fmtMoney(outstanding / 1000) + "K", color: "#E6A700", emoji: "⏳" },
    ] : []),
    { label: tr("openTk"), value: tkRes.count ?? 0, color: "#E0483B", emoji: "🎫" },
  ];

  // مبيعات النهاردة (محصّل فعلي اليوم) — بصلاحية منفصلة
  let todaySales = 0;
  if (canDailySales) {
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const { data: paidToday } = await supabase.from("installments")
      .select("amount,currency,paid_at,status").gte("paid_at", startToday.toISOString());
    for (const i of (paidToday || []) as any[]) {
      if ((i.status === "paid" || i.paid_at) && i.currency === "EGP") todaySales += Number(i.amount) || 0;
    }
  }

  // التخصصات الهندسية: العملاء المسجّلين/الدافعين لكل تخصص
  const spCount: Record<string, number> = {};
  for (const c of customers) if (c.stage === "enrolled" && c.specialty_id) spCount[c.specialty_id] = (spCount[c.specialty_id] || 0) + 1;
  const spRows = Object.entries(spCount).map(([id, n]) => ({ name: spName.get(id) || "—", n })).sort((a, b) => b.n - a.n);
  const spMax = Math.max(...spRows.map((r) => r.n), 1);

  return (
    <div>
      <div className="page-h"><div><h1>{tr("dash")}</h1><p>ملخّص حيّ من قاعدة البيانات</p></div></div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ padding: 18 }}>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 6 }}><span style={{ marginInlineEnd: 6 }}>{(k as any).emoji}</span>{k.label}</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
        {canDailySales && (
          <div className="card" style={{ padding: 18, background: "linear-gradient(135deg,#0FA3A310,#18A95710)" }}>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 6 }}><span style={{ marginInlineEnd: 6 }}>🟢</span>مبيعات النهاردة</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 800, color: "#0FA3A3" }}>{fmtMoney(todaySales)} <span style={{ fontSize: 15 }}>ج</span></div>
          </div>
        )}
      </div>

      {/* مطلوب إجراء الآن */}
      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>{tr("alertsT")}</h3><span className="chip">{actionCount}</span>
        </div>
        <div style={{ marginTop: 10 }}>
          {actionCount === 0 ? (
            <div style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", padding: 14 }}>مفيش حاجة مطلوبة دلوقتي 🎉</div>
          ) : (
            <>
              {canFinance && grp("أقساط متأخرة", "#E5484D", overdueRows)}
              {canFinance && grp("تستحق خلال ٧ أيام", "#F5A623", soonRows)}
              {grp("متابعات مستحقة", "#2F6BFF", followRows)}
              {grp("تسليمات معلّقة", "#F08A24", handoffRows)}
            </>
          )}
        </div>
      </div>

      {/* جدول الباتشات */}
      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>{tr("schedule")}</h3><span className="chip">{batches.length}</span>
        </div>
        <div style={{ marginTop: 8 }}>
          {batches.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد باتشات.</div>}
          {batches.map((b) => {
            const st = b.status === "closed" ? { l: "منتهية", c: "#94A2BB" } : b.status === "full" ? { l: "مكتملة", c: "#E0483B" } : { l: "متاحة", c: "#18A957" };
            const end = endMap.get(b.id);
            const range = (b.start_date || "—") + (end ? " → " + end : "");
            return (
              <div key={b.id} className="sch">
                <div style={{ fontWeight: 800, color: "var(--ink)" }}>{b.code}</div>
                <div className="num" style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, marginInlineStart: 12 }}>{range}</div>
                {canManageBatches && b.status !== "closed" && <BatchDoneBtn id={b.id} />}
                <span className="stg" style={{ background: st.c + "1a", color: st.c, marginInlineStart: 10 }}>{st.l}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ملخص المسار + دونات الدبلومات */}
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="card-h"><h3>{tr("pipelineSummary")}</h3><span className="chip">{total}</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 10 }}>
            {STAGES.map((s) => {
              const n = byStage[s.key] || 0; const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 96, fontSize: 12.5, fontWeight: 700 }}>
                    <span style={{ background: s.color, display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginInlineEnd: 6 }} />{s.label}
                  </span>
                  <div style={{ flex: 1, height: 9, background: "#eef2f8", borderRadius: 20, overflow: "hidden" }}>
                    <div style={{ width: pct + "%", height: "100%", background: s.color }} />
                  </div>
                  <span className="num" style={{ width: 30, textAlign: "left", fontWeight: 700, color: "var(--muted)" }}>{n}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="card-h"><h3>{tr("byDiploma")}</h3></div>
          {byDip.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>لا توجد اشتراكات.</div>
          ) : (
            <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
              <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(${segs})`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 140 }}>
                {byDip.map((x, i) => (
                  <div key={x.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
                    <i style={{ background: DC[i % DC.length], width: 10, height: 10, borderRadius: 3, display: "inline-block" }} />
                    <span style={{ flex: 1 }}>{x.name}</span>
                    <span className="num" style={{ fontWeight: 700, color: "var(--muted)" }}>{x.n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* التخصصات الهندسية (المسجّلين الدافعين) */}
      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>التخصصات الهندسية (مسجّلين / دافعين)</h3><span className="chip">{spRows.length}</span>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 9 }}>
          {spRows.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا يوجد مسجّلون بعد.</div>}
          {spRows.map((x, i) => {
            const pct = Math.round((x.n / spMax) * 100);
            return (
              <div key={x.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 150, fontSize: 12.5, fontWeight: 700 }}>{i === 0 ? "🏆 " : ""}{x.name}</span>
                <div style={{ flex: 1, height: 9, background: "#eef2f8", borderRadius: 20, overflow: "hidden" }}>
                  <div style={{ width: pct + "%", height: "100%", background: "#2F6BFF" }} />
                </div>
                <span className="num" style={{ width: 30, textAlign: "left", fontWeight: 700, color: "var(--muted)" }}>{x.n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* by batch + النشاط الأخير */}
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="card-h"><h3>{tr("byBatch")}</h3></div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 9 }}>
            {byBatch.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>—</div>}
            {byBatch.map((x) => (
              <div key={x.code} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 60, fontSize: 12.5, fontWeight: 700 }}>{x.code}</span>
                <div style={{ flex: 1, height: 9, background: "#eef2f8", borderRadius: 20, overflow: "hidden" }}>
                  <div style={{ width: Math.round((x.n / bMax) * 100) + "%", height: "100%", background: "#2F6BFF" }} />
                </div>
                <span className="num" style={{ width: 30, textAlign: "left", fontWeight: 700, color: "var(--muted)" }}>{x.n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="card-h"><h3>{tr("recentAct")}</h3></div>
          <div style={{ marginTop: 8 }}>
            {((logRes.data as any[]) || []).length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا يوجد نشاط بعد.</div>}
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
    </div>
  );
}
