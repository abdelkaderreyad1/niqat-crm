import { createClient } from "@/lib/supabase/server";
import PipelineBoard from "./PipelineBoard";

export const dynamic = "force-dynamic";

export default async function Pipeline({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const q = (searchParams?.q || "").trim().toLowerCase();

  let rowsRes = await supabase
    .from("customers")
    .select("id,name,company,phone1,phone2,email,stage,owner_id,created_at")
    .eq("deleted", false)
    .eq("archived", false)
    .eq("board_done", false)
    .order("created_at", { ascending: false })
    .limit(500);
  if (rowsRes.error) {
    rowsRes = await supabase
      .from("customers")
      .select("id,name,company,phone1,phone2,email,stage,owner_id,created_at")
      .eq("deleted", false)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(500);
  }
  const rows = rowsRes.data;

  const { data: profs } = await supabase.from("profiles").select("id,full_name");
  const pName = new Map((profs || []).map((p) => [p.id, p.full_name]));

  // الدبلومة لكل عميل (أول اشتراك) من جدول enrollments
  const { data: enr } = await supabase
    .from("enrollments")
    .select("customer_id, diplomas(name_ar)")
    .order("enrolled_at", { ascending: true });
  const dipName = new Map<string, string>();
  for (const e of enr || []) {
    const cid = (e as any).customer_id as string;
    const nm = (e as any).diplomas?.name_ar as string | undefined;
    if (cid && nm && !dipName.has(cid)) dipName.set(cid, nm);
  }

  let src = rows || [];
  if (q) src = src.filter((c: any) =>
    ((c.name || "") + " " + (c.phone1 || "") + " " + (c.phone2 || "") + " " + (c.email || "")).toLowerCase().includes(q));

  const items = src.map((c: any) => ({
    id: c.id as string,
    name: (c.name as string) || "—",
    diploma: dipName.get(c.id as string) || "",
    stage: (c.stage as string) || "new",
    ownerId: (c.owner_id as string) || "",
    ownerName: pName.get(c.owner_id || "") || "",
    createdAt: (c.created_at as string) || "",
  }));

  return <PipelineBoard key={q || "all"} initial={items} />;
}
