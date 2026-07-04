import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavLinks from "./NavLinks";
import Burger from "./Burger";
import TopSearch from "./TopSearch";
import NotificationsBell from "./NotificationsBell";
import LangToggle from "./LangToggle";
import ThemeToggle from "./ThemeToggle";
import Toaster from "./Toaster";
import DailyGreeting from "./DailyGreeting";
// import AnimatedMain from "./AnimatedMain";
import { LangProvider } from "@/lib/i18n/client";
import { getLang, tFor } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const TEAM_LBL: Record<string, { ar: string; en: string }> = {
  sales: { ar: "فريق المبيعات", en: "Sales Team" },
  support: { ar: "فريق الدعم", en: "Support Team" },
  admin: { ar: "الإدارة", en: "Admin" },
  ops: { ar: "العمليات", en: "Operations" },
  operations: { ar: "العمليات", en: "Operations" },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, team, can_see_finance, can_view_reports, can_manage_settings, can_manage_users, can_grant_access")
    .eq("id", user.id).maybeSingle();

  const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
  const [dueRes, handoffRes] = await Promise.all([
    supabase.from("tasks").select("*", { count: "exact", head: true })
      .eq("assignee_id", user.id).eq("done", false).lt("due_at", tomorrow.toISOString()),
    supabase.from("handoffs").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const dueCount = dueRes.count ?? 0;
  const handoffCount = handoffRes.count ?? 0;

  const nowIso = new Date().toISOString();
  const [fuRes, hoListRes, profRes] = await Promise.all([
    supabase.from("follow_ups").select("id,customer_id,due_at,note").eq("done", false).lte("due_at", nowIso).order("due_at").limit(10),
    supabase.from("handoffs").select("id,customer_id,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
    supabase.from("customers").select("id,name"),
  ]);
  const custName = new Map(((profRes.data as any[]) || []).map((c) => [c.id, c.name]));
  const lang = getLang();
  const t = tFor(lang);
  type NItem = { id: string; kind: "follow" | "handoff" | "overdue"; text: string; href: string; sub: string };
  const notif: NItem[] = [];
  for (const f of (fuRes.data as any[]) || []) {
    notif.push({ id: "fu" + f.id, kind: "follow", text: custName.get(f.customer_id) || t("customerFallback"),
      href: `/customers/${f.customer_id}`, sub: f.note || t("followDueSub") });
  }
  for (const h of (hoListRes.data as any[]) || []) {
    notif.push({ id: "ho" + h.id, kind: "handoff", text: custName.get(h.customer_id) || t("customerFallback"),
      href: `/customers/${h.customer_id}`, sub: t("awaitAccessSub") });
  }
  if (profile?.can_see_finance) {
    const { data: ov } = await supabase.from("installments")
      .select("id,enrollment_id,amount,due_date").neq("status", "paid").is("paid_at", null).lt("due_date", nowIso.slice(0, 10)).limit(10);
    if ((ov || []).length) {
      const enrIds = (ov as any[]).map((i) => i.enrollment_id);
      const { data: enrs } = await supabase.from("enrollments").select("id,customer_id").in("id", enrIds);
      const enrCust = new Map(((enrs as any[]) || []).map((e) => [e.id, e.customer_id]));
      for (const i of (ov as any[])) {
        const cid = enrCust.get(i.enrollment_id);
        notif.push({ id: "in" + i.id, kind: "overdue", text: custName.get(cid) || t("customerFallback"),
          href: cid ? `/customers/${cid}` : "/finance", sub: `${t("overdueInstSub")}${i.due_date ? " · " + String(i.due_date).slice(0, 10) : ""}` });
      }
    }
  }

  const name = profile?.full_name || user.email || t("userFallback");
  const teamKey = (profile?.team || "").toLowerCase();
  const teamLabel = TEAM_LBL[teamKey] ? TEAM_LBL[teamKey][lang] : (profile?.team || "—");

  return (
    <LangProvider lang={lang}>
    <div className="app">
      <aside className="sb" id="sb">
        <div className="sb-logo">
          <img src="/icon.png" alt="N" />
          <div>
            <b>CRM-NIQAT</b>
            <span>{t("appsub")}</span>
          </div>
        </div>

        <NavLinks
          canReports={!!profile?.can_view_reports}
          canUsers={!!profile?.can_manage_users}
          canSettings={!!profile?.can_manage_settings}
          canGrant={!!profile?.can_grant_access}
          dueCount={dueCount}
          handoffCount={handoffCount}
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
            <button className="logout" type="submit" title={t("logout")}>
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
          <TopSearch />
          <div className="spacer" />
          <ThemeToggle />
          <LangToggle />
          <NotificationsBell items={notif} />
        </header>
        <main className="content"><div>{children}</div></main>
      </div>
    <Toaster />
    <DailyGreeting />
    </div>
    </LangProvider>
  );
}
