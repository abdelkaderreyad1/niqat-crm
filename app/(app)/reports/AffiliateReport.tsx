"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { BarRow, CountUp } from "../Charts";
import ExportButton from "../ExportButton";

type Opt = { v: string; label: string };
type Aff = { code: string; name: string; rate?: number; discount?: number };
type AffRow = { code: string; name: string; discount: number | null; customers: number; enrolled: number; interested: number; refunded: number };

type SumRow = { code: string; name: string; rate: number; base: number; commission: number; collected: number; customers: number; refunded: number };
type CustRow = { id: string; name: string; code: string; diploma: string; base: number; collected: number; status: "paid" | "partial" | "unpaid"; refunded: boolean };

const money = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));

/* أيقونة خط + عنوان قسم موحّد (مطابق لـ ReportsView) */
function AffIcon({ name, size = 17 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
    coins: <><circle cx="9" cy="9" r="6" /><path d="M18.1 6.6a6 6 0 0 1 0 10.9" /><path d="M14.5 20.9a6 6 0 0 0 0-10.9" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
}
function AffHead({ icon, tint, title, count, extra }: { icon: string; tint: string; title: string; count?: number; extra?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", flexShrink: 0, background: tint + "1a", color: tint }}>
        <AffIcon name={icon} />
      </span>
      <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
      {typeof count === "number" && <span className="chip" style={{ marginInlineStart: 2 }}>{count}</span>}
      {extra && <span style={{ marginInlineStart: "auto" }}>{extra}</span>}
    </div>
  );
}

export default function AffiliateReport({ affRows, batches, diplomas, affiliates, canFinance }: {
  affRows: AffRow[]; batches: Opt[]; diplomas: Opt[]; affiliates: Aff[]; canFinance: boolean;
}) {
  const tr = useT();
  const supabase = createClient();
  const [batchId, setBatchId] = useState("");
  const [dip, setDip] = useState("");
  const [pay, setPay] = useState("");
  const [loading, setLoading] = useState(false);
  const [sumRows, setSumRows] = useState<SumRow[]>([]);
  const [custRows, setCustRows] = useState<CustRow[]>([]);

  const affByCode = new Map(affiliates.map((a) => [a.code.toUpperCase(), a]));
  const dipName = new Map(diplomas.map((d) => [d.v, d.label]));

  async function load(bId: string, dipFilter: string) {
    if (!bId) { setSumRows([]); setCustRows([]); return; }
    setLoading(true);
    try {
      const { data: enrs } = await supabase.from("enrollments")
        .select("id,customer_id,diploma_id").eq("batch_id", bId);
      const list = (enrs || []) as any[];
      const enrIds = list.map((e) => e.id);
      const custIds = Array.from(new Set(list.map((e) => e.customer_id)));
      if (custIds.length === 0) { setSumRows([]); setCustRows([]); setLoading(false); return; }

      const { data: custs } = await supabase.from("customers")
        .select("id,name,affiliate_code").in("id", custIds);
      const { data: refunds } = await supabase.from("refunds")
        .select("customer_id").in("customer_id", custIds);
      const refundedSet = new Set((refunds || []).map((r: any) => r.customer_id));

      // المالية (الأساس + المحصّل) — محجوبة خلف صلاحية المالية
      const agreedByEnr = new Map<string, number>();
      const paidByEnr = new Map<string, number>();
      if (canFinance && enrIds.length) {
        const [{ data: fin }, { data: insts }] = await Promise.all([
          supabase.from("enrollment_finance").select("enrollment_id,agreed_amount").in("enrollment_id", enrIds),
          supabase.from("installments").select("enrollment_id,amount,status,paid_at").in("enrollment_id", enrIds),
        ]);
        (fin || []).forEach((f: any) => agreedByEnr.set(f.enrollment_id, Number(f.agreed_amount) || 0));
        (insts || []).forEach((i: any) => {
          if (i.status === "paid" || i.paid_at) paidByEnr.set(i.enrollment_id, (paidByEnr.get(i.enrollment_id) || 0) + (Number(i.amount) || 0));
        });
      }

      const enrCust = new Map(list.map((e) => [e.id, e.customer_id]));
      const custName = new Map((custs || []).map((c: any) => [c.id, c.name]));
      const custCode = new Map((custs || []).map((c: any) => [c.id, (c.affiliate_code || "").trim().toUpperCase()]));

      // تجميع لكل عميل (مع فلتر الدبلومة)
      const cAgg = new Map<string, { base: number; collected: number; dips: Set<string> }>();
      for (const e of list) {
        if (dipFilter && e.diploma_id !== dipFilter) continue;
        const cid = e.customer_id;
        const g = cAgg.get(cid) || { base: 0, collected: 0, dips: new Set<string>() };
        g.base += agreedByEnr.get(e.id) || 0;
        g.collected += paidByEnr.get(e.id) || 0;
        if (e.diploma_id) g.dips.add(dipName.get(e.diploma_id) || "");
        cAgg.set(cid, g);
      }

      // صفوف العملاء
      const cr: CustRow[] = [];
      for (const [cid, g] of cAgg.entries()) {
        const code = custCode.get(cid) || "";
        if (!code) continue; // بس اللي جايين بكود أفيلييت
        const status: CustRow["status"] = g.base > 0 && g.collected >= g.base ? "paid" : g.collected > 0 ? "partial" : "unpaid";
        cr.push({
          id: cid, name: custName.get(cid) || "—", code,
          diploma: Array.from(g.dips).filter(Boolean).join(" / ") || "—",
          base: g.base, collected: g.collected, status, refunded: refundedSet.has(cid),
        });
      }

      // ملخّص العمولات لكل أفيلييت (الريفند مستبعد من الأساس)
      const sAgg = new Map<string, SumRow>();
      for (const c of cr) {
        const a = affByCode.get(c.code);
        let row = sAgg.get(c.code);
        if (!row) { row = { code: c.code, name: a?.name || "—", rate: Number(a?.rate) || 0, base: 0, commission: 0, collected: 0, customers: 0, refunded: 0 }; sAgg.set(c.code, row); }
        if (c.refunded) { row.refunded++; continue; }
        row.base += c.base; row.collected += c.collected; row.customers++;
      }
      const sum = Array.from(sAgg.values());
      sum.forEach((r) => { r.commission = Math.round((r.base * r.rate) / 100); });
      sum.sort((a, b) => b.commission - a.commission);

      setSumRows(sum);
      setCustRows(cr.sort((a, b) => b.base - a.base));
    } catch {
      setSumRows([]); setCustRows([]);
    }
    setLoading(false);
  }

  function onBatch(v: string) { setBatchId(v); load(v, dip); }
  function onDip(v: string) { setDip(v); load(batchId, v); }

  const statusLabel = (s: string) => s === "paid" ? tr("payFullyPaid") : s === "partial" ? tr("payPartial") : tr("unpaid");
  const statusColor = (s: string) => s === "paid" ? "#18A957" : s === "partial" ? "#E6A700" : "#E0483B";
  const shownCust = pay ? custRows.filter((c) => c.status === pay) : custRows;

  const sel: React.CSSProperties = { height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", padding: "0 10px", fontSize: 13 };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* الفلاتر */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select value={batchId} onChange={(e) => onBatch(e.target.value)} style={{ ...sel, minWidth: 160 }}>
            <option value="">{tr("selectBatchDash")}</option>
            {batches.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
          </select>
          <select value={dip} onChange={(e) => onDip(e.target.value)} style={sel} disabled={!batchId}>
            <option value="">{tr("filterDip")}</option>
            {diplomas.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
          </select>
          <select value={pay} onChange={(e) => setPay(e.target.value)} style={sel} disabled={!batchId}>
            <option value="">{tr("filterPay")}</option>
            <option value="paid">{tr("payFullyPaid")}</option>
            <option value="partial">{tr("payPartial")}</option>
            <option value="unpaid">{tr("unpaid")}</option>
          </select>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0 0" }}>{tr("affReportHint")}</p>
      </div>

      {/* حالة: مفيش باتش مختار → نظرة عامة */}
      {!batchId && (
        <div className="card" style={{ padding: 18 }}>
          <AffHead icon="users" tint="#2F6BFF" title={tr("overallOverview")} />
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 12px" }}>{tr("affReportPickBatch")}</p>
          {affRows.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginBottom: 14 }}>
                <div><div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{tr("customerCount")}</div><div style={{ fontSize: 24, fontWeight: 800, color: "#2F6BFF" }}><CountUp value={affRows.reduce((a, r) => a + r.customers, 0)} /></div></div>
                <div><div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{tr("enrolledCol")}</div><div style={{ fontSize: 24, fontWeight: 800, color: "#18A957" }}><CountUp value={affRows.reduce((a, r) => a + r.enrolled, 0)} /></div></div>
                <div><div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{tr("refundWord")}</div><div style={{ fontSize: 24, fontWeight: 800, color: "#E0483B" }}><CountUp value={affRows.reduce((a, r) => a + r.refunded, 0)} /></div></div>
              </div>
              {[...affRows].sort((a, b) => b.enrolled - a.enrolled).slice(0, 10).map((r) => (
                <BarRow key={r.code}
                  label={<span style={{ fontWeight: 700 }}>{r.name} <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>({r.code}) · {r.customers} {tr("customerCount")}</span></span>}
                  value={r.enrolled} max={Math.max(1, ...affRows.map((x) => x.enrolled))} color="var(--brand)" />
              ))}
            </div>
          )}
          <div className="tbl-wrap">
            <table style={{ minWidth: 520 }}>
              <thead><tr>
                <th className="text-start px-4 py-3 font-bold">{tr("code")}</th>
                <th className="text-start px-4 py-3 font-bold">{tr("affiliate")}</th>
                <th className="text-start px-4 py-3 font-bold">{tr("discountCol")}</th>
                <th className="text-start px-4 py-3 font-bold">{tr("customerCount")}</th>
                <th className="text-start px-4 py-3 font-bold">{tr("enrolledCol")}</th>
                <th className="text-start px-4 py-3 font-bold">{tr("refundWord")}</th>
              </tr></thead>
              <tbody>
                {affRows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center" style={{ color: "var(--muted)" }}>{tr("noAffiliatesYet")}</td></tr>}
                {affRows.map((r) => (
                  <tr key={r.code} className="border-t border-line">
                    <td className="px-4 py-3 font-bold text-brand">{r.code}</td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 num">{r.discount != null ? r.discount + "%" : "—"}</td>
                    <td className="px-4 py-3 num font-bold">{r.customers}</td>
                    <td className="px-4 py-3 num font-bold text-green">{r.enrolled}</td>
                    <td className="px-4 py-3 num font-bold" style={{ color: "#E0483B" }}>{r.refunded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>…</div>}

      {/* حالة: باتش مختار → ملخّص العمولات */}
      {batchId && !loading && (
        <>
          <div className="card" style={{ padding: 18 }}>
            <AffHead icon="coins" tint="#18A957" title={tr("commissionSummary")} count={sumRows.length}
              extra={canFinance && sumRows.length > 0 ? (
                <ExportButton filename={`affiliate-commissions-${batches.find((b) => b.v === batchId)?.label || batchId}`}
                  headers={[tr("code"), tr("affiliate"), tr("commissionPct"), tr("salesBaseCol"), tr("commissionCol"), tr("collected"), tr("customerCount"), tr("refundWord")]}
                  rows={sumRows.map((r) => [r.code, r.name, r.rate + "%", money(r.base), money(r.commission), money(r.collected), r.customers, r.refunded])} />
              ) : undefined} />
            {!canFinance && <p style={{ fontSize: 12.5, color: "#E6A700", margin: "6px 0 0" }}>{tr("commissionNeedsFinance")}</p>}
            <div className="tbl-wrap" style={{ marginTop: 12 }}>
              <table style={{ minWidth: 640 }}>
                <thead><tr>
                  <th className="text-start px-4 py-3 font-bold">{tr("code")}</th>
                  <th className="text-start px-4 py-3 font-bold">{tr("affiliate")}</th>
                  <th className="text-start px-4 py-3 font-bold">{tr("commissionPct")}</th>
                  {canFinance && <th className="text-start px-4 py-3 font-bold">{tr("salesBaseCol")}</th>}
                  {canFinance && <th className="text-start px-4 py-3 font-bold">{tr("commissionCol")}</th>}
                  {canFinance && <th className="text-start px-4 py-3 font-bold">{tr("collected")}</th>}
                  <th className="text-start px-4 py-3 font-bold">{tr("customerCount")}</th>
                  <th className="text-start px-4 py-3 font-bold">{tr("refundWord")}</th>
                </tr></thead>
                <tbody>
                  {sumRows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center" style={{ color: "var(--muted)" }}>{tr("noAffiliateCustomers")}</td></tr>}
                  {sumRows.map((r) => (
                    <tr key={r.code} className="border-t border-line">
                      <td className="px-4 py-3 font-bold text-brand">{r.code}</td>
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3 num">{r.rate}%</td>
                      {canFinance && <td className="px-4 py-3 num" dir="ltr">{money(r.base)}</td>}
                      {canFinance && <td className="px-4 py-3 num font-bold text-green" dir="ltr">{money(r.commission)}</td>}
                      {canFinance && <td className="px-4 py-3 num" dir="ltr" style={{ color: "var(--muted)" }}>{money(r.collected)}</td>}
                      <td className="px-4 py-3 num font-bold">{r.customers}</td>
                      <td className="px-4 py-3 num" style={{ color: "#E0483B" }}>{r.refunded}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* تفاصيل العملاء (يتأثر بفلتر حالة الدفع) */}
          {custRows.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <AffHead icon="list" tint="#F08A24" title={tr("customerDetail")} count={shownCust.length} />
              <div className="tbl-wrap" style={{ marginTop: 12 }}>
                <table style={{ minWidth: 620 }}>
                  <thead><tr>
                    <th className="text-start px-4 py-3 font-bold">{tr("customerName")}</th>
                    <th className="text-start px-4 py-3 font-bold">{tr("code")}</th>
                    <th className="text-start px-4 py-3 font-bold">{tr("diplomaWord")}</th>
                    {canFinance && <th className="text-start px-4 py-3 font-bold">{tr("salesBaseCol")}</th>}
                    {canFinance && <th className="text-start px-4 py-3 font-bold">{tr("collected")}</th>}
                    <th className="text-start px-4 py-3 font-bold">{tr("payStatusCol")}</th>
                  </tr></thead>
                  <tbody>
                    {shownCust.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center" style={{ color: "var(--muted)" }}>{tr("noData")}</td></tr>}
                    {shownCust.map((c) => (
                      <tr key={c.id} className="border-t border-line" style={{ opacity: c.refunded ? 0.55 : 1 }}>
                        <td className="px-4 py-3">{c.name}{c.refunded && <span className="chip" style={{ marginInlineStart: 6, background: "#E0483B1a", color: "#E0483B" }}>{tr("refundWord")}</span>}</td>
                        <td className="px-4 py-3 font-bold text-brand">{c.code}</td>
                        <td className="px-4 py-3">{c.diploma}</td>
                        {canFinance && <td className="px-4 py-3 num" dir="ltr">{money(c.base)}</td>}
                        {canFinance && <td className="px-4 py-3 num" dir="ltr" style={{ color: "var(--muted)" }}>{money(c.collected)}</td>}
                        <td className="px-4 py-3"><span className="chip" style={{ background: statusColor(c.status) + "1a", color: statusColor(c.status) }}>{statusLabel(c.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
