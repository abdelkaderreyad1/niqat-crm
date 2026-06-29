import { createClient } from "@/lib/supabase/server";
import SupportBoard from "./SupportBoard";

export const dynamic = "force-dynamic";

export default async function Support({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const q = (searchParams?.q || "").trim().toLowerCase();
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id,title,status,priority,customer_id,assignee_id,created_at")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(500);
  const { data: custs } = await supabase.from("customers").select("id,name,phone1");
  const { data: profs } = await supabase.from("profiles").select("id,full_name");

  const cName = new Map((custs || []).map((c) => [c.id, c.name]));
  const cPhone = new Map((custs || []).map((c) => [c.id, c.phone1]));
  const pName = new Map((profs || []).map((p) => [p.id, p.full_name]));

  let tks = tickets || [];
  if (q) tks = tks.filter((t: any) =>
    ((t.title || "") + " " + (cName.get(t.customer_id || "") || "") + " " + (cPhone.get(t.customer_id || "") || "")).toLowerCase().includes(q));

  const items = tks.map((t) => ({
    id: t.id as string,
    title: (t.title as string) || "—",
    status: (t.status as string) || "open",
    priority: (t.priority as string) || "medium",
    customerName: cName.get(t.customer_id || "") || "—",
    assigneeId: (t.assignee_id as string) || "",
    assigneeName: pName.get(t.assignee_id || "") || "—",
    date: t.created_at ? String(t.created_at).slice(0, 10) : "",
  }));

  return <SupportBoard key={q || "all"} initial={items} />;
}
