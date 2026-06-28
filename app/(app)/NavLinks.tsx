"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Perms = {
  canReports?: boolean;
  canUsers?: boolean;
  canSettings?: boolean;
  canGrant?: boolean;
  dueCount?: number;
  handoffCount?: number;
  refundCount?: number;
};

const I: Record<string, string> = {
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M16 5.2A3 3 0 0 1 16 11M17 14.6c2.4.5 4 2.5 4 5.4"/></svg>',
  pipe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="11" rx="1.5"/><rect x="16" y="4" width="5" height="7" rx="1.5"/></svg>',
  task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/></svg>',
  batch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 16.5l9 5 9-5"/></svg>',
  uni2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l10 5-10 5L2 8l10-5z"/><path d="M6 10.5V15c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="2.5" y="13" width="4" height="6" rx="2"/><rect x="17.5" y="13" width="4" height="6" rx="2"/><path d="M20 19v.5a3 3 0 0 1-3 3h-3"/></svg>',
  onb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  refund: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.5-7.5L3 8"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M9 12h6"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 4-6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7 7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.8 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L4.6 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.8 2.5h5l.8-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5z"/></svg>',
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h13M3 12h18M3 18h9"/><circle cx="18" cy="6" r="2.2"/><circle cx="15" cy="18" r="2.2"/></svg>',
};

type Item = { href: string; key: string; label: string; badge?: number };

export default function NavLinks(p: Perms) {
  const path = usePathname() || "/";
  const closeSb = () => document.getElementById("sb")?.classList.remove("open");

  const main: Item[] = [
    { href: "/", key: "dash", label: "لوحة المعلومات" },
    { href: "/customers", key: "users", label: "العملاء" },
    { href: "/pipeline", key: "pipe", label: "مسار المبيعات" },
    { href: "/my-tasks", key: "task", label: "مهامي", badge: p.dueCount },
    { href: "/batches", key: "batch", label: "الباتشات" },
    { href: "/universities", key: "uni2", label: "الجامعات والكليات" },
  ];

  const teams: Item[] = [{ href: "/support", key: "support", label: "الدعم" }];
  if (p.canGrant) teams.push({ href: "/onboarding", key: "onb", label: "تفعيل المنصة", badge: p.handoffCount });
  teams.push({ href: "/refunds", key: "refund", label: "المستردات (ريفند)", badge: p.refundCount });
  teams.push({ href: "/archive", key: "archive", label: "الأرشيف" });
  if (p.canReports) teams.push({ href: "/reports", key: "report", label: "التقارير" });

  const admin: Item[] = [];
  if (p.canUsers) admin.push({ href: "/users", key: "settings", label: "المستخدمون والصلاحيات" });
  if (p.canSettings) admin.push({ href: "/settings", key: "cog", label: "الإعدادات" });

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const Btn = (n: Item) => (
    <Link
      key={n.href}
      href={n.href}
      onClick={closeSb}
      className={isActive(n.href) ? "on" : ""}
    >
      <span dangerouslySetInnerHTML={{ __html: I[n.key] }} />
      <span>{n.label}</span>
      {n.badge ? <span className="badge num">{n.badge}</span> : null}
    </Link>
  );

  return (
    <nav className="nav">
      <div className="sect">الرئيسية</div>
      {main.map(Btn)}
      <div className="sect">الفرق</div>
      {teams.map(Btn)}
      {admin.length > 0 && <div className="sect">الإدارة</div>}
      {admin.map(Btn)}
    </nav>
  );
}
