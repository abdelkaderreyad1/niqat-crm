"use client";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import BatchActions from "./BatchActions";

type Opt = { v: string; label: string };
export type B = {
  id: string; code: string; diploma: string; diploma_id: string;
  status: string; start_date: string | null; end_date: string | null;
  capacity: number | null; enrolled: number; price: number | null;
  currency: string; notes: string | null;
  price_egp: number | null; price_usd: number | null;
};

function statusMeta(tr: (k: string) => string, status: string) {
  if (status === "open" || !status) return { l: tr("batchOpen"), c: "#18A957" };
  return { l: tr("batchEnded"), c: "#94A2BB" };
}

export default function BatchesView({ batches, canManage, diplomaOpts }: {
  batches: B[]; canManage: boolean; diplomaOpts: Opt[];
}) {
  const tr = useT();
  const [dip, setDip] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return batches.filter((b) =>
      (!dip || b.diploma_id === dip) &&
      (!status || (status === "open" ? (b.status === "open" || !b.status) : (b.status !== "open" && !!b.status))) &&
      (!qq || (b.code || "").toLowerCase().includes(qq))
    );
  }, [batches, dip, status, q]);

  const sel: React.CSSProperties = { height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", padding: "0 10px", fontSize: 13 };

  return (
    <div>
      {/* شريط الأدوات */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("searchBatchPh")}
          style={{ ...sel, flex: 1, minWidth: 150 }} dir="ltr" />
        <select value={dip} onChange={(e) => setDip(e.target.value)} style={sel}>
          <option value="">{tr("filterDip")}</option>
          {diplomaOpts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={sel}>
          <option value="">{tr("allStatuses")}</option>
          <option value="open">{tr("batchOpen")}</option>
          <option value="closed">{tr("batchEnded")}</option>
        </select>
      </div>

      {filtered.length === 0 && (
        <div style={{ fontSize: 13.5, color: "var(--muted)", padding: 24, textAlign: "center" }}>{tr("noBatchesMatch")}</div>
      )}

      {/* عرض الكروت */}
      {filtered.length > 0 && (
        <div className="bgrid">
          {filtered.map((b) => {
            const seats = Number(b.capacity) || 0;
            const pct = seats ? Math.min(100, Math.round((b.enrolled / seats) * 100)) : 0;
            const st = statusMeta(tr, b.status);
            return (
              <div key={b.id} className="bcard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    {b.diploma && <div style={{ color: "var(--brand)", fontSize: 12.5, fontWeight: 700 }}>{b.diploma}</div>}
                    <div className="bcode">{b.code}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{b.notes || ""}</div>
                  </div>
                  <span className="stg" style={{ background: st.c + "1a", color: st.c }}>{st.l}</span>
                </div>
                <div style={{ margin: "14px 0 6px", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: "var(--muted)" }}>{tr("seats")}</span>
                  <b className="num">{b.enrolled}/{seats || "—"}</b>
                </div>
                <div className="bbar"><i style={{ width: pct + "%" }} /></div>
                <div style={{ marginTop: 14 }}>
                  <div className="brow"><span>{tr("startDate")}</span><b className="num">{b.start_date ? String(b.start_date).slice(0, 10) : "—"}</b></div>
                  <div className="brow"><span>{tr("endDate")}</span><b className="num">{b.end_date ? String(b.end_date).slice(0, 10) : "—"}</b></div>
                  {(Number(b.price_egp) > 0 || Number(b.price_usd) > 0) && (
                    <div className="brow"><span>{tr("batchPrice")}</span><b className="num" dir="ltr">{new Intl.NumberFormat("en").format(Number(b.price_egp) || 0)} {tr("egpShort")} · {new Intl.NumberFormat("en").format(Number(b.price_usd) || 0)} $</b></div>
                  )}
                </div>
                {canManage && (
                  <BatchActions
                    batch={{ id: b.id, code: b.code, status: b.status || "open", start_date: b.start_date, end_date: b.end_date, capacity: b.capacity, notes: b.notes, price: b.price, currency: b.currency || "EGP", price_egp: b.price_egp, price_usd: b.price_usd }}
                    enrolledCount={b.enrolled}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
