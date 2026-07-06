"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { CountUp, Donut, BarRow, AreaChart } from "../Charts";
import ExportButton from "../ExportButton";

type StageRow = { key: string; label: string; color: string; n: number };
type AffRow = { code: string; name: string; discount: number | null; customers: number; enrolled: number; interested: number; refunded: number };
type SalesRow = { name: string; customers: number; enrolled: number; conv: number; collectedEgp: number; collectedUsd: number };
type SupportRow = { name: string; total: number; open: number; closed: number };
type Monthly = { label: string; value: number };

export default function ReportsView({
  canFinance, agreed, collected, overdueN, collectedUsd, agreedUsd,
  stageRows, totalCust, affRows, salesRows, supportRows, monthly, byDiploma,
}: {
  canFinance: boolean;
  agreed: number; collected: number; overdueN: number; collectedUsd: number; agreedUsd: number;
  stageRows: StageRow[]; totalCust: number; affRows: AffRow[];
  salesRows: SalesRow[]; supportRows: SupportRow[]; monthly: Monthly[];
  byDiploma: { label: string; value: number; color: string }[];
}) {
  const tr = useT();
  const TABS = [
    ...(canFinance ? [{ k: "collection", label: tr("tabCollection") }] : []),
    { k: "sales", label: tr("tabSales") },
    { k: "team", label: tr("tabTeam") },
    { k: "affiliate", label: tr("tabAffiliate") },
  ];
  const [tab, setTab] = useState(TABS[0]?.k || "sales");
  const maxStage = Math.max(1, ...stageRows.map((s) => s.n));
  const salesMax = Math.max(1, ...salesRows.map((s) => s.customers));
  const supMax = Math.max(1, ...supportRows.map((s) => s.total));

  return (
    <div>
      <div className="page-h"><div><h1>{tr("reports")}</h1><p>{tr("reportsDesc")}</p></div></div>

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

          {/* منحنى التحصيل الشهري */}
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <div className="card-h"><h3>{tr("collectionTrend")}</h3></div>
            <div style={{ marginTop: 14 }}><AreaChart points={monthly} color="#18A957" height={180} /></div>
          </div>

          {/* نسبة التحصيل */}
          <div className="card" style={{ padding: 18 }}>
            <div className="card-h"><h3>{tr("collectionRate")}</h3></div>
            <div style={{ marginTop: 14 }}>
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
            {/* توزيع المراحل */}
            <div className="card" style={{ padding: 18 }}>
              <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>{tr("stageDistribution")}</h3><span className="chip">{totalCust}</span>
              </div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {stageRows.map((s) => (
                  <BarRow key={s.key} label={<span><span style={{ background: s.color, display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginInlineEnd: 6 }} />{s.label}</span>} value={s.n} max={maxStage} color={s.color} />
                ))}
              </div>
            </div>
            {/* أفضل الدبلومات */}
            <div className="card" style={{ padding: 18 }}>
              <div className="card-h"><h3>{tr("topDiplomas")}</h3></div>
              {byDiploma.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>{tr("noEnrolls")}</div>
              ) : (
                <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
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
          {/* المبيعات */}
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>🎯 {tr("salesTeamPerf")}</h3>
              <ExportButton filename="sales-team"
                headers={[tr("teamMember"), tr("customerCount"), tr("enrolledCol"), tr("convRate"), ...(canFinance ? ["EGP", "USD"] : [])]}
                rows={salesRows.map((s) => [s.name, s.customers, s.enrolled, s.conv + "%", ...(canFinance ? [s.collectedEgp, s.collectedUsd] : [])])} />
            </div>
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
          </div>

          {/* الدعم */}
          <div className="card" style={{ padding: 18 }}>
            <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>🎧 {tr("supportTeamPerf")}</h3>
              <ExportButton filename="support-team"
                headers={[tr("teamMember"), tr("ticketsTotal"), tr("ticketsOpen"), tr("ticketsClosed")]}
                rows={supportRows.map((s) => [s.name, s.total, s.open, s.closed])} />
            </div>
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
          </div>
        </div>
      )}

      {/* ===== تبويب الأفيلييت ===== */}
      {tab === "affiliate" && (
        <div className="fade-in">
          <div className="card" style={{ padding: 18 }}>
            <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>{tr("affiliatesReport")}</h3>
              <ExportButton filename="affiliates"
                headers={[tr("code"), tr("affiliate"), tr("discountCol"), tr("customerCount"), tr("enrolledCol"), tr("interestedStill"), tr("refundWord")]}
                rows={affRows.map((r) => [r.code, r.name, r.discount != null ? r.discount + "%" : "—", r.customers, r.enrolled, r.interested, r.refunded])} />
            </div>
            <div className="tbl-wrap" style={{ marginTop: 12 }}>
              <table style={{ minWidth: 560 }}>
                <thead><tr>
                  <th className="text-start px-4 py-3 font-bold">{tr("code")}</th>
                  <th className="text-start px-4 py-3 font-bold">{tr("affiliate")}</th>
                  <th className="text-start px-4 py-3 font-bold">{tr("discountCol")}</th>
                  <th className="text-start px-4 py-3 font-bold">{tr("customerCount")}</th>
                  <th className="text-start px-4 py-3 font-bold">{tr("enrolledCol")}</th>
                  <th className="text-start px-4 py-3 font-bold">{tr("interestedStill")}</th>
                  <th className="text-start px-4 py-3 font-bold">{tr("refundWord")}</th>
                </tr></thead>
                <tbody>
                  {affRows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center" style={{ color: "var(--muted)" }}>{tr("noAffiliatesYet")}</td></tr>}
                  {affRows.map((r) => (
                    <tr key={r.code} className="border-t border-line">
                      <td className="px-4 py-3 font-bold text-brand">{r.code}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text)" }}>{r.name}</td>
                      <td className="px-4 py-3 num">{r.discount != null ? r.discount + "%" : "—"}</td>
                      <td className="px-4 py-3 num font-bold">{r.customers}</td>
                      <td className="px-4 py-3 num font-bold text-green">{r.enrolled}</td>
                      <td className="px-4 py-3 num font-bold" style={{ color: "#E6A700" }}>{r.interested}</td>
                      <td className="px-4 py-3 num font-bold" style={{ color: "#E0483B" }}>{r.refunded}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
