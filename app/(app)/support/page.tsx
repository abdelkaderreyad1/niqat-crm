import { createClient } from "@/lib/supabase/server";
import SupportBoard from "./SupportBoard";

export const dynamic = "force-dynamic";

export default async function Support() {
  const supabase = createClient();
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id,title,status,priority,customer_id,assignee_id,created_at")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(500);
  const { data: custs } = await supabase.from("customers").select("id,name");
  const { data: profs } = await supabase.from("profiles").select("id,full_name");

  const cName = new Map((custs || []).map((c) => [c.id, c.name]));
  const pName = new Map((profs || []).map((p) => [p.id, p.full_name]));

  const items = (tickets || []).map((t) => ({
    id: t.id as string,
    title: (t.title as string) || "—",
    status: (t.status as string) || "open",
    priority: (t.priority as string) || "medium",
    customerName: cName.get(t.customer_id || "") || "—",
    assigneeId: (t.assignee_id as string) || "",
    assigneeName: pName.get(t.assignee_id || "") || "—",
    date: t.created_at ? String(t.created_at).slice(0, 10) : "",
  }));

  return <SupportBoard initial={items} />;
}
