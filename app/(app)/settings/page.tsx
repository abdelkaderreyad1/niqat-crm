import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import WatiCard from "./WatiCard";
import TemplatesManager from "./TemplatesManager";
import OptionsList from "./OptionsList";
import AffiliatesManager from "../affiliates/AffiliatesManager";

export const dynamic = "force-dynamic";

async function safeList(supabase: any, table: string, col: string) {
  const { data, error } = await supabase.from(table).select(`id,${col}`).order(col);
  if (error) return { items: [] as any[], missing: true };
  return { items: (data || []).map((r: any) => ({ id: r.id, label: r[col] })), missing: false };
}

export default async function Settings() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("can_manage_settings").eq("id", user?.id || "").maybeSingle();

  if (!prof?.can_manage_settings) {
    return (<div className="page-h"><div><h1>{tr("settings")}</h1><p>مالكش صلاحية إدارة الإعدادات.</p></div></div>);
  }

  // كله بالتوازي للأداء
  const [watiRow, affRow, tplRes, access, spec, dip, accred, proj, uni] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "wati").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "affiliates").maybeSingle(),
    supabase.from("wa_templates").select("id,name,body").order("created_at"),
    safeList(supabase, "access_options", "label"),
    safeList(supabase, "specialties", "name_ar"),
    safeList(supabase, "diplomas", "name_ar"),
    safeList(supabase, "accreditations", "name"),
    safeList(supabase, "projects", "name"),
    safeList(supabase, "universities", "name"),
  ]);

  const wati = (watiRow.data?.value as any) || { endpoint: "https://live-server.wati.io/api/v1", token: "", sender: "" };
  const affiliates = Array.isArray(affRow.data?.value) ? (affRow.data!.value as any[]) : [];
  const templates = tplRes.error ? [] : (tplRes.data || []);
  const tablesMissing = accred.missing || proj.missing || uni.missing || tplRes.error;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-h"><div><h1>{tr("settings")}</h1><p>تحكّم في خيارات النظام والتكاملات</p></div></div>

      {tablesMissing && (
        <div className="banner" style={{ marginBottom: 16 }}>
          ⚠️ بعض جداول الإعدادات لسه مش متعملة. شغّل ملف <b>batch2-tables.sql</b> في Supabase عشان تشتغل كلها.
        </div>
      )}

      <WatiCard initial={wati} />
      <TemplatesManager initial={templates as any} />

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="card-h"><h3>{tr("manageAff")}</h3></div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 12px" }}>
          الأكواد المتاحة ونسبة الخصم لكل واحد. أي كود مش في القائمة هيترفض عند التسجيل.
        </p>
        <AffiliatesManager initial={affiliates} />
      </div>

      <OptionsList title="إدارة خيارات الأكسس" hint="بنود التفعيل اللي الدعم بيفعّلها للعميل" table="access_options" labelCol="label" initial={access.items} />
      <OptionsList title="إدارة التخصصات الهندسية" hint="التخصص الهندسي (غير الدبلومة)" table="specialties" labelCol="name_ar" initial={spec.items} />
      <OptionsList title="إدارة الدبلومات" hint="الدبلومات المتاحة للتسجيل" table="diplomas" labelCol="name_ar" initial={dip.items} />
      <OptionsList title="إدارة الاعتمادات" hint="اعتمادات مدفوعة ممكن العميل ياخدها" table="accreditations" labelCol="name" initial={accred.items} />
      <OptionsList title="إدارة المشاريع" hint="مشاريع مدفوعة ممكن العميل ينضم لها" table="projects" labelCol="name" initial={proj.items} />
      <OptionsList title="إدارة الجامعات والكليات" hint="الجامعات والكليات الشريكة" table="universities" labelCol="name" initial={uni.items} />
    </div>
  );
}
