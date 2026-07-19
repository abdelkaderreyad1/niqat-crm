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
export function Kpi({ label, value, color, icon, suffix = "", prefix = "", trend, animate = true, progress, subtitle, deltaText }: {
  label: string; value: number | string; color: string; icon?: string;
  suffix?: string; prefix?: string;
  trend?: { dir: string; pct: number; note?: string } | null;
  animate?: boolean;
  progress?: number;      // 0-100 لشريط التقدّم الرفيع
  subtitle?: string;      // سطر فرعي تحت (زي "٣٤ عميل النهاردة")
  deltaText?: string;     // نص الدلتا بدل النسبة (اختياري)
}) {
  const up = trend?.dir === "up", dn = trend?.dir === "down";
  return (
    <div className="kpi2">
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        {icon && (
          <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, background: color + "1a", color }}>
            <LineIcon name={icon} size={17} />
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--muted-d)", fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--fe)", color: "var(--ink)", lineHeight: 1 }}>
          {typeof value === "number" && animate ? <CountUp value={value} prefix={prefix} suffix={suffix} /> : <span>{prefix}{value}{suffix}</span>}
        </span>
        {trend && (
          <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "var(--fe)", padding: "2px 7px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 2,
            background: up ? "var(--green-soft)" : dn ? "var(--red-soft)" : "var(--muted-soft)",
            color: up ? "var(--green)" : dn ? "var(--red)" : "var(--muted-d)" }}>
            <span>{up ? "▲" : dn ? "▼" : "■"}</span>
            <span dir="ltr">{deltaText || trend.pct + "%"}</span>
          </span>
        )}
      </div>
      {typeof progress === "number" && (
        <div style={{ height: 6, background: "var(--muted-soft)", borderRadius: 20, marginTop: 13, overflow: "hidden" }}>
          <div style={{ display: "block", height: "100%", borderRadius: 20, width: Math.max(0, Math.min(100, progress)) + "%", background: color }} />
        </div>
      )}
      {(subtitle || trend?.note) && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 9, fontWeight: 500 }}>{subtitle || trend?.note}</div>
      )}
    </div>
  );
}

// ===== Sparkline مصغّر (منحنى ناعم من نقاط) =====
export function MiniSpark({ points, color, height = 36 }: { points: number[]; color: string; height?: number }) {
  const n = points.length;
  if (n < 2) return <div style={{ height }} />;
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const rng = max - min || 1;
  const W = 200, H = height;
  const xs = (i: number) => (i / (n - 1)) * W;
  const ys = (v: number) => H - 3 - ((v - min) / rng) * (H - 6);
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const gid = "sp" + Math.random().toString(36).slice(2, 8);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", marginTop: 8 }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity="0.18" /><stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ===== راديال تقدّم (دائرة) =====
export function Radial({ pct, size = 96, color = "var(--green)", thickness = 11, centerLabel }: {
  pct: number; size?: number; color?: string; thickness?: number; centerLabel?: string;
}) {
  const r = (size - thickness) / 2 - 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const dash = (p / 100) * c;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--muted-soft)" strokeWidth={thickness} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
        strokeDasharray={`${dash.toFixed(1)} ${c.toFixed(1)}`} transform={`rotate(-90 ${cx} ${cx})`} />
      <text x={cx} y={cx + 5} textAnchor="middle" style={{ fontSize: size * 0.21, fontWeight: 800, fill: "var(--ink)" }} className="num">{centerLabel ?? p + "%"}</text>
    </svg>
  );
}

// ===== رسم هيرو: أعمدة + خط (آخر 12 شهر) =====
export function HeroBarLine({ bars, line, labels, barColor = "var(--brand)", lineColor = "var(--blue)", height = 180 }: {
  bars: number[]; line?: number[]; labels: string[]; barColor?: string; lineColor?: string; height?: number;
}) {
  const W = 560, H = height, pad = 8;
  const n = bars.length || 1;
  const bMax = Math.max(...bars, 1);
  const slot = W / n;
  const bw = Math.min(28, slot * 0.5);
  const barY = (v: number) => H - 22 - (v / bMax) * (H - 50);
  const lMax = line && line.length ? Math.max(...line, 1) : 1;
  const lx = (i: number) => i * slot + slot / 2;
  const ly = (v: number) => H - 22 - (v / lMax) * (H - 50);
  const linePath = line && line.length
    ? line.map((v, i) => `${i === 0 ? "M" : "L"}${lx(i).toFixed(1)},${ly(v).toFixed(1)}`).join(" ")
    : "";
  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <g stroke="var(--line)" strokeWidth="1">
          {[0.2, 0.45, 0.7].map((f, i) => <line key={i} x1="0" y1={H * f} x2={W} y2={H * f} />)}
        </g>
        <g fill={barColor} opacity="0.85">
          {bars.map((v, i) => {
            const h = H - 22 - barY(v);
            return <rect key={i} x={i * slot + (slot - bw) / 2} y={barY(v)} width={bw} height={Math.max(0, h)} rx="5" />;
          })}
        </g>
        {linePath && <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {linePath && line!.map((v, i) => <circle key={i} cx={lx(i)} cy={ly(v)} r="3" fill={lineColor} />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", fontFamily: "var(--fe)", marginTop: 6 }}>
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}

// ===================== ApexCharts (تحميل client-side فقط) =====================
import dynamic from "next/dynamic";
const ReactApex = dynamic(() => import("react-apexcharts"), { ssr: false });

// يقرأ ألوان الثيم الحالية ويعيد القراءة عند تبديل الدارك مود
function useThemeColors() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setTick((t) => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  const C = (n: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fallback;
  };
  return {
    tick,
    mode: (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark") ? "dark" : "light",
    ink: C("--ink", "#101828"), muted: C("--muted", "#667085"), mutedD: C("--muted-d", "#475467"),
    line: C("--line", "#EAECF2"), surface: C("--surface", "#fff"), mutedSoft: C("--muted-soft", "#F2F4F7"),
    brand: C("--brand", "#F08A24"), blue: C("--blue", "#2E90FA"), green: C("--green", "#12B76A"),
    teal: C("--teal", "#0FA3A3"), purple: C("--purple", "#7A5AF8"), amber: C("--amber", "#F5A623"), red: C("--red", "#F04438"),
  };
}
const AR_FONT = "Tajawal, sans-serif";

// رسم combo: أعمدة + خط ناعم
export function ApexCombo({ bars, line, labels, barName, lineName, showLine = true }: {
  bars: number[]; line?: number[]; labels: string[]; barName: string; lineName: string; showLine?: boolean;
}) {
  const c = useThemeColors();
  const series: any[] = [{ name: barName, type: "column", data: bars }];
  if (showLine && line) series.push({ name: lineName, type: "line", data: line });
  const options: any = {
    chart: { height: 250, type: "line", fontFamily: AR_FONT, toolbar: { show: false }, animations: { easing: "easeinout", speed: 600 }, background: "transparent" },
    theme: { mode: c.mode },
    stroke: { width: showLine ? [0, 3] : [0], curve: "smooth" },
    colors: showLine ? [c.brand, c.blue] : [c.brand],
    plotOptions: { bar: { columnWidth: "50%", borderRadius: 5 } },
    dataLabels: { enabled: false },
    grid: { borderColor: c.line, strokeDashArray: 4, padding: { left: 0, right: 0 } },
    markers: { size: 0, hover: { size: 5 } },
    xaxis: { categories: labels, labels: { style: { colors: c.muted, fontFamily: AR_FONT, fontSize: "11px" } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: showLine
      ? [{ labels: { style: { colors: c.muted, fontSize: "10px" } } }, { opposite: true, labels: { style: { colors: c.muted, fontSize: "10px" } } }]
      : [{ labels: { style: { colors: c.muted, fontSize: "10px" } } }],
    legend: { position: "top", horizontalAlign: "right", fontFamily: AR_FONT, fontWeight: 700, labels: { colors: c.mutedD }, markers: { radius: 12 } },
    tooltip: { theme: c.mode, style: { fontFamily: AR_FONT } },
  };
  return <div key={c.tick}><ReactApex options={options} series={series} type="line" height={250} /></div>;
}

// دائرة التحويل radialBar بتدرّج
export function ApexRadial({ pct, label }: { pct: number; label: string }) {
  const c = useThemeColors();
  const options: any = {
    chart: { height: 210, type: "radialBar", fontFamily: AR_FONT, background: "transparent" },
    plotOptions: { radialBar: { hollow: { size: "62%" }, track: { background: c.mutedSoft },
      dataLabels: { name: { show: true, offsetY: 22, color: c.muted, fontSize: "12px", fontWeight: 600 },
        value: { offsetY: -12, fontSize: "30px", fontFamily: "Inter", fontWeight: 800, color: c.ink, formatter: (v: number) => v + "%" } } } },
    labels: [label],
    fill: { type: "gradient", gradient: { shade: "dark", type: "diagonal", gradientToColors: [c.teal], stops: [0, 100] } },
    colors: [c.green], stroke: { lineCap: "round" },
  };
  return <div key={c.tick}><ReactApex options={options} series={[pct]} type="radialBar" height={210} /></div>;
}

// دونات
export function ApexDonut({ labels, series, totalLabel, totalValue }: {
  labels: string[]; series: number[]; totalLabel: string; totalValue: string;
}) {
  const c = useThemeColors();
  const options: any = {
    chart: { height: 210, type: "donut", fontFamily: AR_FONT, background: "transparent" },
    labels,
    colors: [c.brand, c.blue, c.teal, c.purple, c.green, c.amber, c.red],
    plotOptions: { pie: { donut: { size: "70%", labels: { show: true, total: { show: true, label: totalLabel, fontFamily: AR_FONT, color: c.muted, formatter: () => totalValue }, value: { fontFamily: "Inter", fontWeight: 800, color: c.ink } } } } },
    dataLabels: { enabled: false }, stroke: { width: 2, colors: [c.surface] },
    legend: { position: "bottom", fontFamily: AR_FONT, fontSize: "11px", labels: { colors: c.mutedD }, markers: { radius: 12 } },
  };
  if (!series.length) return <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>—</div>;
  return <div key={c.tick}><ReactApex options={options} series={series} type="donut" height={210} /></div>;
}

// منحنى area بتدرّج
export function ApexArea({ data, labels, name, color }: { data: number[]; labels: string[]; name: string; color?: string }) {
  const c = useThemeColors();
  const col = color || c.green;
  const options: any = {
    chart: { height: 230, type: "area", fontFamily: AR_FONT, toolbar: { show: false }, animations: { speed: 600 }, background: "transparent" },
    stroke: { width: 3, curve: "smooth" }, colors: [col],
    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0, stops: [0, 95] } },
    dataLabels: { enabled: false }, grid: { borderColor: c.line, strokeDashArray: 4 },
    markers: { size: 0, hover: { size: 5 } },
    xaxis: { categories: labels, labels: { style: { colors: c.muted, fontFamily: AR_FONT, fontSize: "11px" } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: c.muted, fontSize: "10px" } } },
    tooltip: { style: { fontFamily: AR_FONT } },
  };
  return <div key={c.tick}><ReactApex options={options} series={[{ name, data }]} type="area" height={230} /></div>;
}

// بار المراحل الأفقي الملوّن
export function ApexStageBar({ labels, data, colors }: { labels: string[]; data: number[]; colors: string[] }) {
  const c = useThemeColors();
  const options: any = {
    chart: { height: 210, type: "bar", fontFamily: AR_FONT, toolbar: { show: false }, background: "transparent" },
    plotOptions: { bar: { horizontal: true, borderRadius: 5, barHeight: "55%", distributed: true } },
    colors,
    dataLabels: { enabled: true, style: { fontFamily: "Inter", fontSize: "11px", colors: ["#fff"] } },
    xaxis: { categories: labels, labels: { style: { colors: c.muted, fontSize: "11px", fontFamily: AR_FONT } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: c.mutedD, fontSize: "12px", fontFamily: AR_FONT } } },
    grid: { show: false }, legend: { show: false }, tooltip: { enabled: false },
  };
  return <div key={c.tick}><ReactApex options={options} series={[{ name: "", data }]} type="bar" height={210} /></div>;
}
