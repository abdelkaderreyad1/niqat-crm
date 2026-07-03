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
    return (<div className="page-h"><div><h1>{tr("settings")}</h1><p>{tr("noSettingsAccess")}</p></div></div>);
  }

  // كله بالتوازي للأداء
  const [watiRow, affRow, tplRes, access, spec, dip, accred, proj, uni, lib] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "wati").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "affiliates").maybeSingle(),
    supabase.from("wa_templates").select("id,name,body").order("created_at"),
    safeList(supabase, "access_options", "label"),
    safeList(supabase, "specialties", "name_ar"),
    safeList(supabase, "diplomas", "name_ar"),
    safeList(supabase, "accreditations", "name"),
    safeList(supabase, "projects", "name"),
    safeList(supabase, "universities", "name"),
    safeList(supabase, "libraries", "name"),
  ]);

  const wati = (watiRow.data?.value as any) || { endpoint: "https://live-server.wati.io/api/v1", token: "", sender: "" };
  const affiliates = Array.isArray(affRow.data?.value) ? (affRow.data!.value as any[]) : [];
  const templates = tplRes.error ? [] : (tplRes.data || []);
  const tablesMissing = accred.missing || proj.missing || uni.missing || tplRes.error;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-h"><div><h1>{tr("settings")}</h1><p>{tr("settingsDesc")}</p></div></div>

      {tablesMissing && (
        <div className="banner" style={{ marginBottom: 16 }}>
          ⚠️ {tr("settingsSqlHint1")} <b>batch2-tables.sql</b> {tr("settingsSqlHint2")}
        </div>
      )}

      <WatiCard initial={wati} />
      <TemplatesManager initial={templates as any} />

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="card-h"><h3>{tr("manageAff")}</h3></div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 12px" }}>
          {tr("affiliatesManagerHint")}
        </p>
        <AffiliatesManager initial={affiliates} />
      </div>

      <OptionsList title={tr("manageAccessOptions")} hint={tr("manageAccessOptionsHint")} table="access_options" labelCol="label" initial={access.items} />
      <OptionsList title={tr("manageSpecialties")} hint={tr("manageSpecialtiesHint")} table="specialties" labelCol="name_ar" initial={spec.items} />
      <OptionsList title={tr("manageDiplomas")} hint={tr("manageDiplomasHint")} table="diplomas" labelCol="name_ar" initial={dip.items} />
      <OptionsList title={tr("manageAccreditations")} hint={tr("manageAccreditationsHint")} table="accreditations" labelCol="name" initial={accred.items} />
      <OptionsList title={tr("manageProjects")} hint={tr("manageProjectsHint")} table="projects" labelCol="name" initial={proj.items} />
      <OptionsList title={tr("manageLibraries")} hint={tr("manageLibrariesHint")} table="libraries" labelCol="name" initial={lib.items} />
      <OptionsList title={tr("manageUniversities")} hint={tr("manageUniversitiesHint")} table="universities" labelCol="name" initial={uni.items} />
    </div>
  );
}
