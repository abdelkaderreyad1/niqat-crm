import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLang, tFor } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function hourLabel(h: number, lang: "ar" | "en") {
  const hr = ((h % 24) + 24) % 24;
  if (lang === "en") {
    const ampm = hr < 12 ? "AM" : "PM"; const h12 = hr % 12 === 0 ? 12 : hr % 12;
    const h12b = (hr + 2) % 12 === 0 ? 12 : (hr + 2) % 12; const ampmB = (hr + 2) % 24 < 12 ? "AM" : "PM";
    return `${h12} ${ampm} – ${h12b} ${ampmB}`;
  }
  const per = hr < 12 ? "صباحاً" : "مساءً";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  const hb = (hr + 2) % 12 === 0 ? 12 : (hr + 2) % 12;
  return `${h12} – ${hb} ${per}`;
}

export default async function InsightsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const lang = getLang();
  const t = tFor(lang);

  const { data: profile } = await supabase.from("profiles").select("can_use_ai, can_see_finance").eq("id", user.id).maybeSingle();
  const { data: settings } = await supabase.from("ai_settings").select("insights_enabled").maybeSingle();
  const enabled = !!profile?.can_use_ai && !!settings?.insights_enabled;
  if (!enabled) redirect("/"); // مخفية تماماً لغير المصرّح

  const p_days = 30;
  const [topDipRes, peakRes, batchesRes, staleRes, trendRes] = await Promise.all([
    supabase.rpc("ins_top_diplomas", { p_days }),
    supabase.rpc("ins_peak_hours", { p_days }),
    supabase.rpc("ins_batches_filling"),
    supabase.rpc("ins_stale_leads", { p_days_idle: 7 }),
    supabase.rpc("ins_collection_trend", { p_days }),
    // specialty_conversion مخفي مؤقتاً (الداتا 100%)
  ]);

  const topDip = ((topDipRes.data as any[]) || [])[0] || null;
  const peak = (peakRes.data as any) || null;
  const batches = (batchesRes.data as any[]) || [];
  const stale = (staleRes.data as any) || { count: 0, list: [] };
  const trend = (trendRes.data as any) || null; // null لو مفيش can_finance

  const nf = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));

  // نسبة الذروة لو متاحة
  let peakPct = 0;
  if (peak?.distribution) {
    const dist = Array.isArray(peak.distribution) ? peak.distribution : Object.values(peak.distribution);
    const tot = (dist as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
    if (tot > 0) peakPct = Math.round(((peak.peak_count || 0) / tot) * 100);
  }

  const hasCollectionSuggestion = trend && trend.change_pct != null && Number(trend.change_pct) > 0;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* بانر AI */}
      <div className="ai-note">
        <b>{t("aiFree")}</b> — {t("insightsNote")}
      </div>

      <div className="ai-top">
        <div>
          <div className="ai-hi">{t("insightsLast30")}</div>
          <h1 className="ai-h1"><span className="ai-spark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg></span>{t("insightsTitle")}</h1>
        </div>
        <span className="ai-badge">{t("aiFree")}</span>
      </div>

      {/* اللي بيحصل دلوقتي */}
      <div className="ai-sh"><span className="tick" /><h2>{t("insightsNow")}</h2></div>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", alignItems: "stretch" }}>
        {/* أكتر دبلومة حجزاً */}
        <div className="card ai-ins">
          <div className="top-r"><span className="ic" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 10v6M2 10l10-5 10 5-10 5z" /></svg></span><span className="lab">{t("insTopDiploma")}</span></div>
          {topDip ? (<><div className="big">{topDip.name}</div><div className="sub num">{topDip.enrollments} {t("enrollWord")} · {topDip.pct}%</div></>)
            : <div className="ai-empty">{t("insNoData")}</div>}
        </div>

        {/* وقت الذروة */}
        <div className="card ai-ins">
          <div className="top-r"><span className="ic" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span><span className="lab">{t("insPeakTime")}</span></div>
          {peak && peak.peak_count > 0 ? (<><div className="big n">{hourLabel(Number(peak.peak_hour), lang)}</div><div className="sub num">{peakPct > 0 ? `${peakPct}% ${t("insOfEnrolls")}` : `${peak.peak_count} ${t("enrollWord")}`}</div></>)
            : <div className="ai-empty">{t("insNoData")}</div>}
        </div>

        {/* اتجاه التحصيل — يظهر فقط لو trend مش null */}
        {trend && (
          <div className="card ai-ins">
            <div className="top-r"><span className="ic" style={{ background: "var(--green-soft)", color: "var(--green)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 7l-8.5 8.5-5-5L2 17" /></svg></span><span className="lab">{t("insCollectionTrend")}</span></div>
            <div className="big num" dir="ltr">{nf(trend.total)} <span style={{ fontSize: 13, color: "var(--muted)" }}>{trend.currency || "EGP"}</span></div>
            <div className="sub">
              {trend.change_pct != null
                ? <span style={{ color: Number(trend.change_pct) >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }} className="num" dir="ltr">{Number(trend.change_pct) >= 0 ? "▲ +" : "▼ "}{trend.change_pct}%</span>
                : <span>{t("insNoPrevPeriod")}</span>}
              {trend.top_day && <span> · {t("insTopDay")}: {trend.top_day}</span>}
            </div>
          </div>
        )}
      </div>

      {/* اقتراحات ليك */}
      <div className="ai-sh"><span className="tick" /><h2>{t("insSuggestions")}</h2></div>
      <div className="card">
        {/* باتشات قرب تكمل */}
        {batches.length > 0 ? batches.slice(0, 4).map((b) => (
          <div key={b.batch_id} className="ai-sug">
            <span className="tag" style={{ background: "var(--amber-soft)", color: "#9a6a12" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t">{t("insBatchFilling").replace("{code}", b.code)} <span className="num" dir="ltr">({b.registered} / {b.capacity})</span></div>
              <div className="d num" dir="ltr">{b.pct}% {t("insFilled")}</div>
            </div>
            <Link href="/batches" className="ai-act">{t("insOpenBatch")}</Link>
          </div>
        )) : (
          <div className="ai-sug"><span className="tag" style={{ background: "var(--muted-soft)", color: "var(--muted)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></svg></span><div style={{ flex: 1 }}><div className="d">{t("insNoBatchesFilling")}</div></div></div>
        )}

        {/* عملاء بايتين */}
        {stale.count > 0 ? (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--red-soft)", color: "var(--red)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t"><span className="num">{stale.count}</span> {t("insStaleLeads")}</div>
              <div className="d">{t("insStaleSub")}</div>
            </div>
            <Link href="/customers?idle=7" className="ai-act">{t("insShowThem")}</Link>
          </div>
        ) : (
          <div className="ai-sug"><span className="tag" style={{ background: "var(--muted-soft)", color: "var(--muted)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></svg></span><div style={{ flex: 1 }}><div className="d">{t("insNoStaleLeads")}</div></div></div>
        )}

        {/* التحصيل بيرتفع */}
        {hasCollectionSuggestion && (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--green-soft)", color: "var(--green)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 7l-8.5 8.5-5-5L2 17" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t num" dir="ltr">{t("insCollectionUp").replace("{pct}", String(trend.change_pct))}</div>
              {trend.top_day && <div className="d">{t("insTopDay")}: {trend.top_day}</div>}
            </div>
            <Link href="/reports" className="ai-act">{t("insReport")}</Link>
          </div>
        )}
      </div>

      <div className="ai-perm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
        <span>{t("insightsFootnote")}</span>
      </div>
    </div>
  );
}
