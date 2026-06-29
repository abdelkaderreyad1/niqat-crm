import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
export const dynamic = "force-dynamic";

const TEAM = { admin: "الإدارة", sales: "فريق المبيعات", support: "فريق الدعم" } as Record<string, string>;
const PERMS: [string, string][] = [
  ["can_see_finance", "رؤية الأسعار"],
  ["can_edit_customers", "تعديل العملاء"],
  ["can_manage_tickets", "إدارة التذاكر"],
  ["can_grant_access", "تفعيل الأكسس"],
  ["can_view_reports", "التقارير"],
  ["can_manage_batches", "إدارة الباتشات"],
  ["can_export", "تصدير"],
  ["can_manage_users", "إدارة المستخدمين"],
  ["can_manage_settings", "الإعدادات"],
];
const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
const avc = (id: string) => { let h = 0; for (const ch of id || "") h += ch.charCodeAt(0); return AV[h % AV.length]; };
const ini = (n: string) => { const p = (n || "?").trim().split(/\s+/); return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2); };

export default async function Users() {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,team," + PERMS.map((p) => p[0]).join(","))
    .order("team");
  const users = ((data as any[]) || []);

  const card = (u: any) => (
    <div key={u.id} className="ucard">
      <div className="ucard-h">
        <div className="av" style={{ background: avc(u.id) }}>{ini(u.full_name)}</div>
        <div>
          <b style={{ fontSize: 15, color: "var(--ink)" }}>{u.full_name || "—"}</b>{" "}
          <span className="uteam">{TEAM[u.team] || u.team}</span>
        </div>
      </div>
      {u.team === "admin" ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>المدير العام — كل الصلاحيات مفعّلة</div>
      ) : (
        PERMS.map(([k, lbl]) => (
          <div key={k} className="permrow">
            <span>{lbl}</span>
            <div className={"sw" + (u[k] ? " on" : "")}><i /></div>
          </div>
        ))
      )}
    </div>
  );

  const grp = (title: string, team: string) => {
    const list = users.filter((u) => u.team === team);
    if (!list.length) return null;
    return (<div key={team}><div className="sec-t">{title}</div>{list.map(card)}</div>);
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("users")}</h1>
          <p>{users.length} مستخدم</p>
        </div>
      </div>
      {grp("الإدارة", "admin")}
      {grp("فريق المبيعات", "sales")}
      {grp("فريق الدعم", "support")}
    </div>
  );
}
