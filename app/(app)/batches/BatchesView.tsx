"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT, useLang } from "@/lib/i18n/client";
import BatchActions from "./BatchActions";

type Opt = { v: string; label: string };
export type B = {
  id: string; code: string; diploma: string; diploma_id: string;
  status: string; start_date: string | null; end_date: string | null;
  capacity: number | null; enrolled: number; price: number | null;
  currency: string; notes: string | null;
};

const DAY = 86400000;
function statusMeta(tr: (k: string) => string, status: string) {
  if (status === "closed") return { l: tr("batchEnded"), c: "#94A2BB" };
  if (status === "full") return { l: tr("batchFull"), c: "#E0483B" };
  return { l: tr("batchOpen"), c: "#18A957" };
}

export default function BatchesView({ batches, canManage, diplomaOpts }: {
  batches: B[]; canManage: boolean; diplomaOpts: Opt[];
}) {
  const tr = useT();
  const lang = useLang();
  const [view, setView] = useState<"cards" | "timeline">("timeline");
  const [dip, setDip] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return batches.filter((b) =>
      (!dip || b.diploma_id === dip) &&
      (!status || b.status === status) &&
      (!qq || (b.code || "").toLowerCase().includes(qq))
    );
  }, [batches, dip, status, q]);

  // تجميع الجدول الزمني بالشهر (حسب تاريخ البداية)
  const groups = useMemo(() => {
    const map = new Map<string, B[]>();
    for (const b of filtered) {
      const key = b.start_date ? String(b.start_date).slice(0, 7) : "zzzz-none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    const keys = Array.from(map.keys()).sort();
    return keys.map((k) => {
      const items = map.get(k)!.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
      let label = tr("noBatches").replace(".", "");
      if (k !== "zzzz-none") {
        const [y, m] = k.split("-").map(Number);
        label = new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en", { month: "long", year: "numeric", timeZone: "Africa/Cairo" }).format(new Date(y, m - 1, 1));
      }
      return { key: k, label, items };
    });
  }, [filtered, lang, tr]);

  const maxDays = useMemo(() => {
    let mx = 1;
    for (const b of filtered) {
      if (b.start_date && b.end_date) {
        const d = (Date.parse(b.end_date) - Date.parse(b.start_date)) / DAY;
        if (d > mx) mx = d;
      }
    }
    return mx;
  }, [filtered]);

  const sel: React.CSSProperties = { height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", padding: "0 10px", fontSize: 13 };

  return (
    <div>
      {/* شريط الأدوات */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
          {(["timeline", "cards"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                background: view === v ? "var(--brand)" : "transparent", color: view === v ? "#fff" : "var(--muted)" }}>
              {v === "timeline" ? tr("viewTimeline") : tr("viewCards")}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("searchBatchPh")}
          style={{ ...sel, flex: 1, minWidth: 150 }} dir="ltr" />
        <select value={dip} onChange={(e) => setDip(e.target.value)} style={sel}>
          <option value="">{tr("filterDip")}</option>
          {diplomaOpts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={sel}>
          <option value="">{tr("allStatuses")}</option>
          <option value="open">{tr("batchOpen")}</option>
          <option value="full">{tr("batchFull")}</option>
          <option value="closed">{tr("batchEnded")}</option>
        </select>
      </div>

      {filtered.length === 0 && (
        <div style={{ fontSize: 13.5, color: "var(--muted)", padding: 24, textAlign: "center" }}>{tr("noBatchesMatch")}</div>
      )}

      {/* عرض الكروت */}
      {view === "cards" && filtered.length > 0 && (
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
                  {Number(b.price) > 0 && (
                    <div className="brow"><span>{tr("batchPrice")}</span><b className="num" dir="ltr">{new Intl.NumberFormat("en").format(Number(b.price))} {b.currency === "USD" ? "$" : tr("egpShort")}</b></div>
                  )}
                </div>
                {canManage && (
                  <BatchActions
                    batch={{ id: b.id, code: b.code, status: b.status || "open", start_date: b.start_date, end_date: b.end_date, capacity: b.capacity, notes: b.notes, price: b.price, currency: b.currency || "EGP" }}
                    enrolledCount={b.enrolled}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* عرض الجدول الزمني */}
      {view === "timeline" && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((g) => (
            <TimelineGroup key={g.key} label={g.label} items={g.items} maxDays={maxDays} tr={tr} />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineGroup({ label, items, maxDays, tr }: {
  label: string; items: B[]; maxDays: number; tr: (k: string) => string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "6px 2px", background: "none", border: "none", cursor: "pointer", textAlign: "start", borderBottom: "2px solid var(--line)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.5}
          style={{ width: 14, height: 14, transition: "transform .25s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
          <path d="M9 5l7 7-7 7" />
        </svg>
        <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", textTransform: "capitalize" }}>{label}</span>
        <span className="chip" style={{ marginInlineStart: "auto" }}>{items.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0" }}>
              {items.map((b, i) => {
                const st = statusMeta(tr, b.status);
                const days = b.start_date && b.end_date ? Math.max(1, (Date.parse(b.end_date) - Date.parse(b.start_date)) / DAY) : 0;
                const w = days ? Math.max(10, Math.min(100, (days / maxDays) * 100)) : 10;
                const seats = Number(b.capacity) || 0;
                const fill = seats ? Math.min(100, Math.round((b.enrolled / seats) * 100)) : 0;
                return (
                  <motion.div key={b.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                    style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.2fr) 2fr auto", gap: 12, alignItems: "center",
                      padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)" }}>
                    {/* اسم + دبلومة */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.c, flexShrink: 0 }} />
                        <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink)" }} dir="ltr">{b.code}</span>
                      </div>
                      {b.diploma && <div style={{ color: "var(--brand)", fontSize: 11.5, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.diploma}</div>}
                    </div>
                    {/* شريط المدة + التواريخ */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ height: 9, background: "var(--muted-soft)", borderRadius: 20, overflow: "hidden" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: w + "%" }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          style={{ height: "100%", background: st.c, opacity: 0.85, borderRadius: 20 }} />
                      </div>
                      <div className="num" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }} dir="ltr">
                        {b.start_date ? String(b.start_date).slice(0, 10) : "—"}{b.end_date ? "  →  " + String(b.end_date).slice(0, 10) : ""}
                      </div>
                    </div>
                    {/* الحالة + المقاعد */}
                    <div style={{ textAlign: "end" }}>
                      <span className="stg" style={{ background: st.c + "1a", color: st.c }}>{st.l}</span>
                      <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{b.enrolled}/{seats || "—"} · {fill}%</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
