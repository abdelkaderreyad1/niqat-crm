import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import NewCustomerForm from "./NewCustomerForm";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // حماية: إضافة عميل تحتاج صلاحية "تعديل العملاء"
  const { data: meProf } = await supabase.from("profiles").select("can_edit_customers").eq("id", user?.id || "").maybeSingle();
  if (!meProf?.can_edit_customers) {
    return (<div className="page-h"><div><h1>{tr("addCust")}</h1><p>{tr("noEditCustomersPerm")}</p></div></div>);
  }
  const [{ data: specs }, { data: dips }, { data: bts }, { data: affRow }] = await Promise.all([
    supabase.from("specialties").select("id,name_ar").order("name_ar"),
    supabase.from("diplomas").select("id,name_ar").order("name_ar"),
    supabase.from("batches").select("id,code,price,currency,price_egp,price_usd,diploma_id,status,kind").order("start_date", { ascending: false }),
    supabase.from("app_settings").select("value").eq("key", "affiliates").maybeSingle(),
  ]);
  const affiliates = Array.isArray(affRow?.value) ? (affRow!.value as any[]) : [];
  const openB = (bts || []).filter((b) => { const s = (b as any).status; return !s || s === "open"; });
  const mapB = (b: any) => ({ id: b.id, name: b.code, price: Number(b.price) || 0, currency: b.currency || "EGP", price_egp: Number(b.price_egp) || 0, price_usd: Number(b.price_usd) || 0, diploma_id: b.diploma_id || "", kind: b.kind || "diploma" });
  return (
    <div style={{ maxWidth: 620 }}>
      <div className="page-h"><h1>{tr("addCust")}</h1></div>
      <NewCustomerForm
        specialties={(specs || []).map((s) => ({ id: s.id, name: s.name_ar }))}
        diplomas={(dips || []).map((d) => ({ id: d.id, name: d.name_ar }))}
        batches={openB.filter((b: any) => (b.kind || "diploma") === "diploma").map(mapB)}
        services={openB.filter((b: any) => b.kind && b.kind !== "diploma").map(mapB)}
        meId={user?.id || ""}
        affiliates={affiliates as any}
      />
    </div>
  );
}
