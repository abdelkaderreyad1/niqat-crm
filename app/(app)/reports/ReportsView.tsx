"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";
import { CountUp, Donut, BarRow, AreaChart, MiniSpark } from "../Charts";
import PeriodFilter from "../PeriodFilter";
import ExportButton from "../ExportButton";
import AffiliateReport from "./AffiliateReport";

type StageRow = { key: string; label: string; color: string; n: number };
type AffRow = { code: string; name: string; discount: number | null; customers: number; enrolled: number; interested: number; refunded: number };
type SalesRow = { name: string; customers: number; enrolled: number; conv: number; collectedEgp: number; collectedUsd: number };
type SupportRow = { name: string; total: number; open: number; closed: number };
type Monthly = { key: string; value: number };

/* ===== أيقونات خط (ستايل lucide) ===== */
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    trending: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
    bars: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
    headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="2.5" y="14" width="4" height="6" rx="1.5" /><rect x="17.5" y="14" width="4" height="6" rx="1.5" /><path d="M20 19a4 4 0 0 1-4 3h-2" /></>,
    link: <><path d="M9 15l6-6" /><path d="M11 7l1-1a4 4 0 0 1 6 6l-1 1" /><path d="M13 17l-1 1a4 4 0 0 1-6-6l1-1" /></>,
    pie: <><path d="M21.2 15.9A10 10 0 1 1 8.1 2.8" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>,
    percent: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
    wallet: <><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><circle cx="16" cy="14" r="1.5" /></>,
    coins: <><circle cx="9" cy="9" r="6" /><path d="M18.1 6.6a6 6 0 0 1 0 10.9" /><path d="M14.5 20.9a6 6 0 0 0 0-10.9" /></>,
    gauge: <><path d="M12 14l4-4" /><path d="M3.3 17a9 9 0 1 1 17.4 0" /></>,
    refresh: <><polyline points="23 4 23 10 17 10" /><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10" /></>,
    award: <><circle cx="12" cy="8" r="6" /><path d="M8.2 13.3 7 22l5-3 5 3-1.2-8.7" /></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
}

/* ===== عنوان قسم موحّد: أيقونة في مربّع + عنوان + عدّاد/إضافي ===== */
function SecHead({ icon, tint, title, count, extra }: { icon: string; tint: string; title: string; count?: number; extra?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", flexShrink: 0, background: tint + "1a", color: tint }}>
        <Icon name={icon} size={17} />
      </span>
      <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
      {typeof count === "number" && <span className="chip" style={{ marginInlineStart: 2 }}>{count}</span>}
      {extra && <span style={{ marginInlineStart: "auto" }}>{extra}</span>}
    </div>
  );
}

const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
function avColor(s: string) { let h = 0; for (const ch of s || "") h += ch.charCodeAt(0); return AV[h % AV.length]; }
function initials(name: string) { const p = (name || "?").trim().split(/\s+/); return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2); }
const MEDALS = ["🥇", "🥈", "🥉"];

/* صف ليدربورد موحّد */
function Lead({ rank, name, sub, value, valueColor }: { rank: number; name: string; sub: string; value: string; valueColor: string }) {
  const av = avColor(name);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: "1px solid var(--line)" }}>
      <span style={{ width: 26, textAlign: "center", fontSize: rank <= 3 ? 18 : 13, fontWeight: 800, color: "var(--muted)", flexShrink: 0 }}>
        {rank <= 3 ? MEDALS[rank - 1] : rank}
      </span>
      <span style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 12.5, background: av, flexShrink: 0 }}>{initials(name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{sub}</div>
      </div>
      <div className="num" style={{ fontWeight: 800, fontSize: 16, color: valueColor, flexShrink: 0 }} dir="ltr">{value}</div>
    </div>
  );
}

export default function ReportsView({
  canFinance, agreed, collected, overdueN, collectedUsd, agreedUsd,
  stageRows, totalCust, affRows, salesRows, supportRows, monthly, byDiploma,
  batchOpts, diplomaOpts, affiliates, resetAt = "",
}: {
  canFinance: boolean;
  agreed: number; collected: number; overdueN: number; collectedUsd: number; agreedUsd: number;
  stageRows: StageRow[]; totalCust: number; affRows: AffRow[];
  salesRows: SalesRow[]; supportRows: SupportRow[]; monthly: Monthly[];
  byDiploma: { label: string; value: number; color: string }[];
  batchOpts: { v: string; label: string }[];
  diplomaOpts: { v: string; label: string }[];
  affiliates: { code: string; name: string; rate?: number; discount?: number }[];
  resetAt?: string;
}) {
  const tr = useT();
  const lang = useLang();
  const router = useRouter();
  const supabase = createClient();
  const [resetting, setResetting] = useState(false);

  const monthlyLabeled = monthly.map((m) => {
    const [y, mm] = m.key.split("-").map(Number);
    const label = new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en", { month: "short", timeZone: "Africa/Cairo" }).format(new Date(y, mm - 1, 1));
    return { label, value: m.value };
  });
  const periodTotal = monthly.reduce((s, m) => s + (m.value || 0), 0);
  const monthsWithData = monthly.filter((m) => m.value > 0).length;
  const avgPerMonth = monthsWithData ? Math.round(periodTotal / monthsWithData) : 0;
  const fmt = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));

  async function resetMeasurement() {
    if (!confirm(tr("resetChartQ"))) return;
    setResetting(true);
    const { error } = await supabase.from("app_settings")
      .upsert({ key: "reports_reset_at", value: new Date().toISOString(), updated_at: new Date().toISOString() });
    setResetting(false);
    if (error) { toast(tr("saveFailedColon") + error.message); return; }
    toast(tr("saved")); router.refresh();
  }

  const TABS = [
    ...(canFinance ? [{ k: "collection", label: tr("tabCollection") }] : []),
    { k: "sales", label: tr("tabSales") },
    { k: "team", label: tr("tabTeam") },
    { k: "affiliate", label: tr("tabAffiliate") },
  ];
  const [tab, setTab] = useState(TABS[0]?.k || "sales");
  const maxStage = Math.max(1, ...stageRows.map((s) => s.n));
  const salesTot = {
    customers: salesRows.reduce((a, s) => a + s.customers, 0),
    enrolled: salesRows.reduce((a, s) => a + s.enrolled, 0),
  };
  const salesConv = salesTot.customers ? Math.round((salesTot.enrolled / salesTot.customers) * 100) : 0;
  const supTot = {
    total: supportRows.reduce((a, s) => a + s.total, 0),
    open: supportRows.reduce((a, s) => a + s.open, 0),
    closed: supportRows.reduce((a, s) => a + s.closed, 0),
  };
  const salesRanked = [...salesRows].sort((a, b) => (canFinance ? b.collectedEgp - a.collectedEgp : b.enrolled - a.enrolled) || b.customers - a.customers);
  const supRanked = [...supportRows].sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="page-h"><div><h1>{tr("reports")}</h1><p>{tr("reportsDesc")}</p></div></div>
      <PeriodFilter />

      {/* التبويبات */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", borderBottom: "1px solid var(--line)", paddingBottom: 2 }}>
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{
              padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
              background: "none", border: "none", position: "relative",
              color: tab === t.k ? "var(--brand)" : "var(--muted)",
              borderBottom: tab === t.k ? "2px solid var(--brand)" : "2px solid transparent",
              marginBottom: -2, transition: "color .2s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== تبويب التحصيل ===== */}
      {tab === "collection" && canFinance && (
        <div className="fade-in">
          {/* هيرو الفلوس الغامق */}
          <div style={{ background: "linear-gradient(135deg,#101828,#1f2a44)", color: "#fff", borderRadius: "var(--r)", padding: 22, marginBottom: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ fontSize: 12.5, color: "#98A2B3", fontWeight: 700 }}>{tr("collected30dTotal")}</div>
            <div style={{ fontSize: 38, fontWeight: 800, fontFamily: "var(--fe)", lineHeight: 1.1, marginTop: 8 }}>{fmt(collected)} <span style={{ fontSize: 17, color: "#98A2B3" }}>{tr("egpShort")}</span></div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#D0D5DD", display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>{tr("remaining")}: <b className="num" dir="ltr">{fmt(agreed - collected)} {tr("egpShort")}</b></span>
              <span>· {tr("collectionRate")}: <b className="num" style={{ color: "#6CE9A6" }} dir="ltr">{agreed ? Math.round((collected / agreed) * 100) : 0}%</b></span>
              {collectedUsd > 0 && <span>· <b className="num" dir="ltr">${fmt(collectedUsd)}</b></span>}
            </div>
            <div style={{ position: "absolute", insetInlineEnd: 12, bottom: 8, width: 180, opacity: 0.65 }}>
              <MiniSpark points={monthly.map((m) => m.value)} color="#6CE9A6" height={54} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 16 }}>
            <KpiCard label={tr("totalAgreed")} color="#2F6BFF"><CountUp value={agreed} prefix="EGP " /></KpiCard>
            <KpiCard label={tr("totalCollected")} color="#18A957"><CountUp value={collected} prefix="EGP " /></KpiCard>
            <KpiCard label={tr("remaining")} color="#E6A700"><CountUp value={agreed - collected} prefix="EGP " /></KpiCard>
            <KpiCard label={tr("overdueInstallments")} color="#E0483B"><CountUp value={overdueN} /></KpiCard>
          </div>

          {(collectedUsd > 0 || agreedUsd > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 16 }}>
              <KpiCard label={tr("totalAgreed") + " ($)"} color="#2F6BFF"><CountUp value={agreedUsd} prefix="$ " /></KpiCard>
              <KpiCard label={tr("totalCollected") + " ($)"} color="#18A957"><CountUp value={collectedUsd} prefix="$ " /></KpiCard>
            </div>
          )}

          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <SecHead icon="trending" tint="#18A957" title={tr("collectionTrend")}
              extra={<button onClick={resetMeasurement} disabled={resetting} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="refresh" size={13} /> {resetting ? "..." : tr("resetMeasurement")}
              </button>} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "12px 0 4px" }}>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("periodTotal")}: <b className="num" style={{ color: "#18A957" }} dir="ltr">{fmt(periodTotal)} {tr("egpShort")}</b></span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("avgPerMonth")}: <b className="num" style={{ color: "var(--ink)" }} dir="ltr">{fmt(avgPerMonth)} {tr("egpShort")}</b></span>
              {resetAt && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>· {tr("measuringSince")} <span className="num" dir="ltr">{String(resetAt).slice(0, 10)}</span></span>}
            </div>
            <div style={{ marginTop: 6 }}><AreaChart points={monthlyLabeled} color="#18A957" height={112} /></div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <SecHead icon="gauge" tint="#0FA3A3" title={tr("collectionRate")} />
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "var(--muted)" }}>{tr("totalCollected")}</span>
                <b className="num" style={{ color: "#18A957" }}>{agreed ? Math.round((collected / agreed) * 100) : 0}%</b>
              </div>
              <div style={{ height: 12, background: "var(--muted-soft)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ width: (agreed ? Math.round((collected / agreed) * 100) : 0) + "%", height: "100%", background: "linear-gradient(90deg,#18A957,#0FA3A3)", borderRadius: 20, transition: "width 1s cubic-bezier(.22,1,.36,1)" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== تبويب المبيعات ===== */}
      {tab === "sales" && (
        <div className="fade-in">
          <div className="grid2" style={{ marginBottom: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <SecHead icon="bars" tint="#7B61FF" title={tr("stageDistribution")} count={totalCust} />
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {stageRows.map((s) => (
                  <BarRow key={s.key} label={<span><span style={{ background: s.color, display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginInlineEnd: 6 }} />{s.label}</span>} value={s.n} max={maxStage} color={s.color} />
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <SecHead icon="pie" tint="#F08A24" title={tr("topDiplomas")} />
              {byDiploma.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>{tr("noEnrolls")}</div>
              ) : (
                <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
                  <Donut data={byDiploma} />
                  <div style={{ flex: 1, minWidth: 150 }}>
                    {byDiploma.map((d) => (
                      <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
                        <i style={{ background: d.color, width: 10, height: 10, borderRadius: 3, display: "inline-block" }} />
                        <span style={{ flex: 1 }}>{d.label}</span>
                        <span className="num" style={{ fontWeight: 700, color: "var(--muted)" }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== تبويب أداء الفريق ===== */}
      {tab === "team" && (
        <div className="fade-in">
          {/* المبيعات — ليدربورد */}
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <SecHead icon="target" tint="#2F6BFF" title={tr("salesTeamPerf")} count={salesRows.length}
              extra={<ExportButton filename="sales-team"
                headers={[tr("teamMember"), tr("customerCount"), tr("enrolledCol"), tr("convRate"), ...(canFinance ? ["EGP", "USD"] : [])]}
                rows={salesRows.map((s) => [s.name, s.customers, s.enrolled, s.conv + "%", ...(canFinance ? [s.collectedEgp, s.collectedUsd] : [])])} />} />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, margin: "14px 0 6px" }}>
              <MiniStat label={tr("customerCount")} value={salesTot.customers} color="#2F6BFF" />
              <MiniStat label={tr("enrolledCol")} value={salesTot.enrolled} color="#18A957" />
              <MiniStat label={tr("convRate")} value={salesConv} color="#E6A700" suffix="%" />
            </div>

            {salesRanked.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>{tr("noData")}</div>
            ) : (
              <div style={{ marginTop: 6 }}>
                {salesRanked.map((s, i) => (
                  <Lead key={s.name} rank={i + 1} name={s.name}
                    sub={`${s.customers} ${tr("customerCount")} · ${s.conv}% ${tr("convRate")}`}
                    value={canFinance ? fmt(s.collectedEgp) + " " + tr("egpShort") + (s.collectedUsd > 0 ? " · $" + fmt(s.collectedUsd) : "") : String(s.enrolled)}
                    valueColor={canFinance ? "#18A957" : "#2F6BFF"} />
                ))}
              </div>
            )}

            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--brand)", listStyle: "none" }}>▸ {tr("showFullTable")}</summary>
              <div className="tbl-wrap" style={{ marginTop: 12 }}>
                <table style={{ minWidth: 480 }}>
                  <thead><tr>
                    <th className="text-start px-4 py-3 font-bold">{tr("teamMember")}</th>
                    <th className="text-start px-4 py-3 font-bold">{tr("customerCount")}</th>
                    <th className="text-start px-4 py-3 font-bold">{tr("enrolledCol")}</th>
                    <th className="text-start px-4 py-3 font-bold">{tr("convRate")}</th>
                    {canFinance && <th className="text-start px-4 py-3 font-bold">{tr("collectedWord")}</th>}
                  </tr></thead>
                  <tbody>
                    {salesRows.length === 0 && <tr><td colSpan={canFinance ? 5 : 4} className="px-4 py-6 text-center" style={{ color: "var(--muted)" }}>{tr("noData")}</td></tr>}
                    {salesRows.map((s) => (
                      <tr key={s.name} className="border-t border-line">
                        <td className="px-4 py-3 font-bold" style={{ color: "var(--text)" }}>{s.name}</td>
                        <td className="px-4 py-3 num font-bold">{s.customers}</td>
                        <td className="px-4 py-3 num font-bold text-green">{s.enrolled}</td>
                        <td className="px-4 py-3 num font-bold" style={{ color: "#2F6BFF" }}>{s.conv}%</td>
                        {canFinance && <td className="px-4 py-3 num" style={{ color: "var(--muted)" }}>{s.collectedEgp.toLocaleString("en")} {tr("egpShort")}{s.collectedUsd > 0 ? ` · $${s.collectedUsd.toLocaleString("en")}` : ""}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          {/* الدعم — ليدربورد */}
          <div className="card" style={{ padding: 18 }}>
            <SecHead icon="headset" tint="#18A957" title={tr("supportTeamPerf")} count={supportRows.length}
              extra={<ExportButton filename="support-team"
                headers={[tr("teamMember"), tr("ticketsTotal"), tr("ticketsOpen"), tr("ticketsClosed")]}
                rows={supportRows.map((s) => [s.name, s.total, s.open, s.closed])} />} />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, margin: "14px 0 6px" }}>
              <MiniStat label={tr("ticketsTotal")} value={supTot.total} color="var(--ink)" />
              <MiniStat label={tr("ticketsOpen")} value={supTot.open} color="#E6A700" />
              <MiniStat label={tr("ticketsClosed")} value={supTot.closed} color="#18A957" />
            </div>

            {supRanked.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>{tr("noData")}</div>
            ) : (
              <div style={{ marginTop: 6 }}>
                {supRanked.map((s, i) => (
                  <Lead key={s.name} rank={i + 1} name={s.name}
                    sub={`${s.closed} ${tr("ticketsClosed")} · ${s.open} ${tr("ticketsOpen")}`}
                    value={String(s.total)} valueColor="#18A957" />
                ))}
              </div>
            )}

            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--brand)", listStyle: "none" }}>▸ {tr("showFullTable")}</summary>
              <div className="tbl-wrap" style={{ marginTop: 12 }}>
                <table style={{ minWidth: 440 }}>
                  <thead><tr>
                    <th className="text-start px-4 py-3 font-bold">{tr("teamMember")}</th>
                    <th className="text-start px-4 py-3 font-bold">{tr("ticketsTotal")}</th>
                    <th className="text-start px-4 py-3 font-bold">{tr("ticketsOpen")}</th>
                    <th className="text-start px-4 py-3 font-bold">{tr("ticketsClosed")}</th>
                  </tr></thead>
                  <tbody>
                    {supportRows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center" style={{ color: "var(--muted)" }}>{tr("noData")}</td></tr>}
                    {supportRows.map((s) => (
                      <tr key={s.name} className="border-t border-line">
                        <td className="px-4 py-3 font-bold" style={{ color: "var(--text)" }}>{s.name}</td>
                        <td className="px-4 py-3 num font-bold">{s.total}</td>
                        <td className="px-4 py-3 num font-bold" style={{ color: "#E6A700" }}>{s.open}</td>
                        <td className="px-4 py-3 num font-bold text-green">{s.closed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* ===== تبويب الأفيلييت ===== */}
      {tab === "affiliate" && (
        <div className="fade-in">
          <div style={{ marginBottom: 14 }}>
            <SecHead icon="link" tint="#7B61FF" title={tr("affiliateReportTitle")} />
          </div>
          <AffiliateReport affRows={affRows} batches={batchOpts} diplomas={diplomaOpts} affiliates={affiliates} canFinance={canFinance} />
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{children}</div>
    </div>
  );
}

function MiniStat({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color }}><CountUp value={value} suffix={suffix} /></div>
    </div>
  );
}
