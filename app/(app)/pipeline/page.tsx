import { createClient } from "@/lib/supabase/server";
import PipelineBoard from "./PipelineBoard";

export const dynamic = "force-dynamic";

export default async function Pipeline() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("customers")
    .select("id,name,company,phone1,stage,owner_id")
    .eq("deleted", false)
    .order("created_at", { ascending: false })
    .limit(500);
  const { data: profs } = await supabase.from("profiles").select("id,full_name");
  const pName = new Map((profs || []).map((p) => [p.id, p.full_name]));

  const items = (rows || []).map((c) => ({
    id: c.id as string,
    name: (c.name as string) || "—",
    company: (c.company as string) || "",
    phone1: (c.phone1 as string) || "",
    stage: (c.stage as string) || "new",
    ownerId: (c.owner_id as string) || "",
    ownerName: pName.get(c.owner_id || "") || "",
  }));

  return <PipelineBoard initial={items} />;
}
