import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import UsersManager from "./UsersManager";

export const dynamic = "force-dynamic";

const COLS = "id,full_name,team,can_edit_customers,can_see_finance,can_view_reports,can_manage_tickets,can_manage_batches,can_grant_access,can_message,can_export,can_manage_settings,can_manage_users";

export default async function Users() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("can_manage_users").eq("id", user?.id || "").maybeSingle();

  if (!me?.can_manage_users) {
    return (
      <div className="page-h"><div><h1>{tr("users")}</h1><p>مالكش صلاحية إدارة المستخدمين.</p></div></div>
    );
  }

  const { data } = await supabase.from("profiles").select(COLS).order("team");
  const users = (data as any[]) || [];

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("users")}</h1>
          <p>{users.length} مستخدم — قابل للإضافة بلا حد</p>
        </div>
      </div>
      <UsersManager profiles={users} />
    </div>
  );
}
