import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import BatchesView from "./BatchesView";
export const dynamic = "force-dynamic";

export default async function Batches() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // موجة متوازية: الصلاحية + الباتشات + الدبلومات + الحجوزات (كلهم مستقلين)
  const [
    { data: meB },
    bFull,
    bd,
    { data: allDips },
  ] = await Promise.all([
    supabase.from("profiles").select("can_manage_batches").eq("id", user?.id || "").maybeSingle(),
    supabase.from("batches").select("id,code,status,start_date,end_date,capacity,notes,price,currency,price_egp,price_usd,kind").order("created_at", { ascending: false }),
    supabase.from("batches").select("id,diploma_id"),
    supabase.from("diplomas").select("id,name_ar").order("name_ar"),
  ]);
  const canManage = !!meB?.can_manage_batches;

  let batches: any[] = [];
  if (bFull.error) {
    const bMin = await supabase.from("batches")
      .select("id,code,status,start_date,capacity,notes")
      .order("created_at", { ascending: false });
    batches = bMin.data || [];
  } else batches = bFull.data || [];

  // الدبلومة لكل باتش (دفاعي)
  const dMap = new Map<string, string>();
  const dipName = new Map((allDips || []).map((d: any) => [d.id, d.name_ar]));
  if (!bd.error) for (const r of (bd.data as any[]) || []) if (r.diploma_id) dMap.set(r.id, dipName.get(r.diploma_id) || "");

  // عدد المشتركين الفعلي لكل باتش (count مستقل يتجاوز حد الـ1000 صف)
  const cntPairs = await Promise.all(
    (batches || []).map((b: any) =>
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", b.id)
        .then((r) => [b.id as string, r.count || 0] as const)
    )
  );
  const cnt = new Map<string, number>(cntPairs);

  const viewData = (batches || []).map((b) => ({
    id: b.id as string,
    code: (b.code as string) || "",
    diploma: dMap.get(b.id as string) || "",
    diploma_id: "",
    status: (b.status as string) || "open",
    start_date: (b.start_date as string) || null,
    end_date: (b.end_date as string) || null,
    capacity: (b.capacity as number) ?? null,
    enrolled: cnt.get(b.id as string) || 0,
    price: ((b as any).price as number) ?? null,
    currency: ((b as any).currency as string) || "EGP",
    price_egp: ((b as any).price_egp as number) ?? null,
    price_usd: ((b as any).price_usd as number) ?? null,
    kind: ((b as any).kind as string) || "diploma",
    notes: (b.notes as string) || null,
  }));
  // ربط diploma_id لكل باتش (للفلترة)
  if (!bd.error) for (const r of (bd.data as any[]) || []) {
    const row = viewData.find((v) => v.id === r.id);
    if (row && r.diploma_id) row.diploma_id = r.diploma_id;
  }

  const diplomaOpts = (allDips || []).map((d: any) => ({ v: d.id, label: d.name_ar }));

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("batches")}</h1>
          <p>{(batches || []).length} {tr("batchWord")}</p>
        </div>
      </div>
      <BatchesView batches={viewData} canManage={canManage} diplomaOpts={diplomaOpts}
        diplomas={(allDips || []).map((d: any) => ({ id: d.id, name: d.name_ar }))} />
    </div>
  );
}
