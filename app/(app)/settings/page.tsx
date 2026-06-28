import { createClient } from "@/lib/supabase/server";
import PermissionsManager from "./PermissionsManager";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prof } = await supabase
    .from("profiles")
    .select("can_manage_users")
    .eq("id", user?.id || "")
    .maybeSingle();

  if (!prof?.can_manage_users) {
    return (
      <div className="page-h">
        <div>
          <h1>الإعدادات والصلاحيات</h1>
          <p>مالكش صلاحية إدارة المستخدمين.</p>
        </div>
      </div>
    );
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, full_name, team, can_edit_customers, can_see_finance, can_view_reports, can_manage_tickets, can_manage_batches, can_manage_settings, can_manage_users, can_grant_access, can_message, can_export"
    )
    .order("created_at", { ascending: true });

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>الإعدادات والصلاحيات</h1>
          <p>تحكّم في صلاحيات كل عضو في الفريق</p>
        </div>
      </div>
      <PermissionsManager profiles={profiles || []} />
    </div>
  );
}
