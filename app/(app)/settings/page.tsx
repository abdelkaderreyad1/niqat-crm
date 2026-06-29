import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("can_manage_settings").eq("id", user?.id || "").maybeSingle();

  if (!prof?.can_manage_settings) {
    return (
      <div className="page-h"><div><h1>{tr("settings")}</h1><p>مالكش صلاحية إدارة الإعدادات.</p></div></div>
    );
  }

  return (
    <div>
      <div className="page-h"><div><h1>{tr("settings")}</h1><p>تحكّم في خيارات النظام والتكاملات</p></div></div>
      <div className="card" style={{ padding: 22, fontSize: 14, color: "var(--muted)" }}>
        خيارات النظام (واتساب WATI · قوالب الرسائل · الأفيلييت · خيارات الأكسس · التخصصات · الدبلومات · الاعتمادات · المشاريع · الجامعات) — قيد التجهيز في التحديث الجاي.
      </div>
    </div>
  );
}
