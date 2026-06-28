import { createClient } from "@/lib/supabase/server";
import AffiliatesManager from "./AffiliatesManager";

export const dynamic = "force-dynamic";

export default async function Affiliates() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prof } = await supabase
    .from("profiles")
    .select("can_manage_settings")
    .eq("id", user?.id || "")
    .maybeSingle();

  if (!prof?.can_manage_settings) {
    return (
      <div className="page-h">
        <div>
          <h1>إدارة الإحالات / الأفيلييت</h1>
          <p>مالكش صلاحية إدارة الإحالات.</p>
        </div>
      </div>
    );
  }

  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "affiliates")
    .maybeSingle();

  const list = Array.isArray(setting?.value) ? (setting!.value as any[]) : [];

  return (
    <div className="max-w-2xl">
      <div className="page-h">
        <div>
          <h1>إدارة الإحالات / الأفيلييت</h1>
          <p>الأكواد المتاحة ونسبة الخصم لكل واحد. أي كود مش في القائمة هيترفض عند التسجيل.</p>
        </div>
      </div>
      <AffiliatesManager initial={list} />
    </div>
  );
}
