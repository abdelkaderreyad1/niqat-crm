"use client";
import { useEffect, useRef, useState } from "react";

// ===== رقم يعدّ تصاعدياً عند الظهور =====
export function CountUp({ value, suffix = "", prefix = "", dur = 900, decimals = 0 }: {
  value: number; suffix?: string; prefix?: string; dur?: number; decimals?: number;
}) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
          setN(value * eased);
          if (p < 1) requestAnimationFrame(tick);
          else setN(value);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, dur]);
  const shown = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString("en");
  return <span ref={ref} className="num">{prefix}{shown}{suffix}</span>;
}

// ===== دونات SVG احترافي مع حركة =====
export function Donut({ data, size = 140, thickness = 22 }: {
  data: { label: string; value: number; color: string }[]; size?: number; thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {data.map((d, i) => {
          const frac = d.value / total;
          const len = frac * circ;
          const seg = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${mounted ? len : 0} ${circ}`}
              strokeDashoffset={-offset}
              style={{ transition: "stroke-dasharray .9s cubic-bezier(.22,1,.36,1)" }} />
          );
          offset += len;
          return seg;
        })}
      </g>
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: "var(--text)" }} className="num">{total}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted)" }}>{data.length}</text>
    </svg>
  );
}

// ===== بار أفقي مع حركة =====
export function BarRow({ label, value, max, color, prefix = "" }: {
  label: React.ReactNode; value: number; max: number; color: string; prefix?: string;
}) {
  const [w, setW] = useState(0);
  const pct = max ? Math.round((value / max) * 100) : 0;
  useEffect(() => { const t = setTimeout(() => setW(pct), 60); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ minWidth: 92, maxWidth: 150, fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "var(--muted-soft)", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ width: w + "%", height: "100%", background: color, borderRadius: 20, transition: "width .8s cubic-bezier(.22,1,.36,1)" }} />
      </div>
      <span className="num" style={{ width: 44, textAlign: "end", fontWeight: 700, color: "var(--muted)", fontSize: 12.5 }}>{prefix}{value}</span>
    </div>
  );
}

// ===== رسم خطي (sparkline/area) SVG =====
export function AreaChart({ points, color = "#F08A24", height = 160 }: {
  points: { label: string; value: number }[]; color?: string; height?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);
  if (!points.length) return null;

  const W = 850, H = height;
  const padL = 48, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(...points.map((p) => p.value), 1);
  // خطوات المحور الرأسي (4 خطوط)
  const ticks = 4;
  const niceMax = Math.ceil(max / ticks) * ticks || ticks;
  const step = points.length > 1 ? plotW / (points.length - 1) : plotW;
  const X = (i: number) => padL + i * step;
  const Y = (v: number) => padT + plotH - (v / niceMax) * plotH;
  const pts = points.map((p, i) => [X(i), Y(p.value)] as [number, number]);

  // منحنى ناعم (Catmull-Rom → Bézier)
  function smoothPath(p: [number, number][]) {
    if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : "";
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1][0]},${padT + plotH} L${pts[0][0]},${padT + plotH} Z`;
  const gid = "areaG" + color.replace("#", "");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* خطوط الشبكة الأفقية + قيم المحور */}
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = (niceMax / ticks) * (ticks - i);
        const y = padT + (plotH / ticks) * i;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth={1} opacity={0.5} />
            <text x={padL - 8} y={y + 3} textAnchor="end" style={{ fontSize: 10, fill: "var(--muted)" }}>
              {v >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v)}
            </text>
          </g>
        );
      })}
      {/* التعبئة */}
      <path d={area} fill={`url(#${gid})`} style={{ opacity: mounted ? 1 : 0, transition: "opacity .9s ease" }} />
      {/* الخط */}
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={mounted ? 0 : 1}
        style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)" }} />
      {/* النقاط + القيم فوقها */}
      {pts.map((c, i) => (
        <g key={i} style={{ opacity: mounted ? 1 : 0, transition: `opacity .4s ${0.4 + i * 0.09}s` }}>
          <circle cx={c[0]} cy={c[1]} r={3.5} fill="var(--surface)" stroke={color} strokeWidth={2} />
          {points[i].value > 0 && (
            <text x={c[0]} y={c[1] - 10} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: color }}>
              {points[i].value >= 1000 ? (points[i].value / 1000).toFixed(1) + "k" : points[i].value}
            </text>
          )}
        </g>
      ))}
      {/* أسماء الشهور */}
      {points.map((p, i) => (
        <text key={i} x={X(i)} y={H - 9} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted)" }}>{p.label}</text>
      ))}
    </svg>
  );
}

// ===== أيقونة خط (ستايل lucide) — مشتركة =====
export function LineIcon({ name, size = 18 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
    trending: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
    check: <><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    ticket: <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><line x1="12" y1="6" x2="12" y2="18" strokeDasharray="2 3" /></>,
    wallet: <><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><circle cx="16" cy="14" r="1.5" /></>,
    calendarCheck: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 15 11 17 15 13" /></>,
    clipboard: <><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /><path d="M9 13l2 2 4-4" /></>,
    funnel: <><polygon points="3 4 21 4 14 12.5 14 19 10 21 10 12.5 3 4" /></>,
    trophy: <><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3" /><path d="M7 5H4v2a3 3 0 0 0 3 3" /></>,
    dot: <><circle cx="12" cy="12" r="5" /></>,
    undo: <><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{p[name] || null}</svg>;
}

// ===== كارت KPI موحّد (مشترك بين الداشبورد والتقارير) =====
export function Kpi({ label, value, color, icon, suffix = "", prefix = "", trend, animate = true }: {
  label: string; value: number | string; color: string; icon?: string;
  suffix?: string; prefix?: string;
  trend?: { dir: string; pct: number; note?: string } | null;
  animate?: boolean;
}) {
  return (
    <div className="card rise" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 12.5, marginBottom: 8 }}>
        {icon && (
          <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0, background: color + "1a", color }}>
            <LineIcon name={icon} size={15} />
          </span>
        )}
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>
        {typeof value === "number" && animate ? <CountUp value={value} prefix={prefix} suffix={suffix} /> : <span>{prefix}{value}{suffix}</span>}
      </div>
      {trend && (
        <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4,
          color: trend.dir === "up" ? "#18A957" : trend.dir === "down" ? "#E0483B" : "var(--muted)" }}>
          <span>{trend.dir === "up" ? "▲" : trend.dir === "down" ? "▼" : "■"}</span>
          <span dir="ltr">{trend.pct}%</span>
          {trend.note && <span style={{ color: "var(--muted)", fontWeight: 500 }}>{trend.note}</span>}
        </div>
      )}
    </div>
  );
}
