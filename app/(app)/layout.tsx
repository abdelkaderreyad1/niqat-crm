import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavLinks from "./NavLinks";
import Burger from "./Burger";

export const dynamic = "force-dynamic";

const TEAM_AR: Record<string, string> = {
  sales: "فريق المبيعات",
  support: "فريق الدعم",
  admin: "الإدارة",
  ops: "العمليات",
  operations: "العمليات",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, team, can_see_finance, can_view_reports, can_manage_settings, can_manage_users"
    )
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.full_name || user.email || "مستخدم";
  const teamLabel = TEAM_AR[(profile?.team || "").toLowerCase()] || profile?.team || "—";

  return (
    <div className="app">
      <aside className="sb" id="sb">
        <div className="sb-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="نقاط" />
          <div>
            <b>CRM-NIQAT</b>
            <span>نظام إدارة العملاء</span>
          </div>
        </div>

        <NavLinks
          canReports={!!profile?.can_view_reports}
          canUsers={!!profile?.can_manage_users}
          canSettings={!!profile?.can_manage_settings}
          canGrant={!!profile?.can_manage_settings}
        />

        <div className="sb-foot">
          <div className="who">
            <div className="av" style={{ background: "var(--brand)" }}>
              {initials(name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <b>{name}</b>
              <small>{teamLabel}</small>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="logout" type="submit" title="تسجيل الخروج">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <Burger />
          <div className="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input placeholder="ابحث عن عميل…" />
          </div>
          <div className="spacer" />
          <button className="icon-btn" title="الإشعارات" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
              <path d="M10 20a2 2 0 0 0 4 0" />
            </svg>
          </button>
        </header>
        <main className="content enter">{children}</main>
      </div>
    </div>
  );
}
