import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import OnboardingCards from "./OnboardingCards";
export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const supabase = createClient();
  // موجة 1: handoffs + profiles (مستقلين)
  const [{ data: hRows }, { data: profs }] = await Promise.all([
    supabase.from("handoffs").select("id,customer_id,assignee_id,note,status,created_at").eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name"),
  ]);
  const pMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));

  const rows = hRows || [];
  const custIds = Array.from(new Set(rows.map((h: any) => h.customer_id).filter(Boolean)));
  const hIds = rows.map((h: any) => h.id);

  // موجة 2: العملاء + التسجيلات + بنود التسليم (كلهم يعتمدوا على IDs من موجة 1، لكن مستقلين عن بعض)
  const [custsRes, enrRes, itemsRes] = await Promise.all([
    custIds.length ? supabase.from("customers").select("id,name,phone1").in("id", custIds) : Promise.resolve({ data: [] as any[] }),
    custIds.length ? supabase.from("enrollments").select("customer_id, diplomas(name_ar)").in("customer_id", custIds) : Promise.resolve({ data: [] as any[] }),
    hIds.length ? supabase.from("handoff_items").select("id,handoff_id,label,done,done_by,done_at").in("handoff_id", hIds).order("id") : Promise.resolve({ data: [] as any[] }),
  ]);

  const custs = custsRes.data;
  const cMap = new Map((custs || []).map((c: any) => [c.id, c]));

  const dipMap = new Map<string, string[]>();
  for (const e of enrRes.data || []) {
    const cid = (e as any).customer_id as string;
    const nm = (e as any).diplomas?.name_ar as string | undefined;
    if (cid && nm) dipMap.set(cid, [...(dipMap.get(cid) || []), nm]);
  }

  const itemsMap = new Map<string, any[]>();
  for (const it of itemsRes.data || []) {
    const hid = (it as any).handoff_id as string;
    itemsMap.set(hid, [...(itemsMap.get(hid) || []), {
      id: it.id, label: it.label, done: !!it.done,
      by: pMap.get((it as any).done_by || "") || null,
      at: String((it as any).done_at || "").replace("T", " ").slice(0, 16),
    }]);
  }

  const cards = rows.map((h: any) => ({
    handoffId: h.id as string,
    custId: h.customer_id as string,
    name: cMap.get(h.customer_id)?.name || "—",
    phone: cMap.get(h.customer_id)?.phone1 || "",
    status: h.status || "pending",
    note: h.note || "",
    assignee: pMap.get(h.assignee_id || "") || "",
    diplomas: dipMap.get(h.customer_id) || [],
    items: itemsMap.get(h.id) || [],
  }));

  const pendCount = cards.filter((c) => c.status === "pending").length;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("onboarding")}</h1>
          <p>{pendCount} {tr("customerNeedsActivation")}</p>
        </div>
      </div>
      <OnboardingCards cards={cards} />
    </div>
  );
}
