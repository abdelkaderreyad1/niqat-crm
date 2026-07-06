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
      <text x={cx} y={cy + 16} textAnchor="middle" style={{ fontSize: 11, fill: "var(--muted)" }}>{data.length}</text>
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

  const W = 600, H = height;
  const padL = 44, padR = 14, padT = 14, padB = 26;
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
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={mounted ? 0 : 1}
        style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)" }} />
      {/* النقاط + القيم فوقها */}
      {pts.map((c, i) => (
        <g key={i} style={{ opacity: mounted ? 1 : 0, transition: `opacity .4s ${0.4 + i * 0.09}s` }}>
          <circle cx={c[0]} cy={c[1]} r={3.5} fill="var(--surface)" stroke={color} strokeWidth={2} />
          {points[i].value > 0 && (
            <text x={c[0]} y={c[1] - 9} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: color }}>
              {points[i].value >= 1000 ? (points[i].value / 1000).toFixed(1) + "k" : points[i].value}
            </text>
          )}
        </g>
      ))}
      {/* أسماء الشهور */}
      {points.map((p, i) => (
        <text key={i} x={X(i)} y={H - 8} textAnchor="middle" style={{ fontSize: 10.5, fill: "var(--muted)" }}>{p.label}</text>
      ))}
    </svg>
  );
}
