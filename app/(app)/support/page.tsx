import { createClient } from "@/lib/supabase/server";
import SupportBoard from "./SupportBoard";

export const dynamic = "force-dynamic";

export default async function Support({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const q = (searchParams?.q || "").trim().toLowerCase();
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id,title,body,status,priority,customer_id,assignee_id,created_at")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(500);
  const { data: custs } = await supabase.from("customers").select("id,name,phone1");
  const { data: profs } = await supabase.from("profiles").select("id,full_name,team");
  const { data: { user } } = await supabase.auth.getUser();

  // المواضيع المتكررة (datalist)
  let subjects: string[] = [];
  const { data: ts } = await supabase.from("app_settings").select("value").eq("key", "ticket_problems").maybeSingle();
  if (ts?.value) { try { subjects = JSON.parse(ts.value as string); } catch { subjects = []; } }

  const cName = new Map((custs || []).map((c) => [c.id, c.name]));
  const cPhone = new Map((custs || []).map((c) => [c.id, c.phone1]));
  const pName = new Map((profs || []).map((p) => [p.id, p.full_name]));
  const assignees = (profs || [])
    .filter((p: any) => p.team === "support" || p.team === "admin")
    .map((p: any) => ({ id: p.id, name: p.full_name || "—" }));

  let tks = tickets || [];
  if (q) tks = tks.filter((t: any) =>
    ((t.title || "") + " " + (cName.get(t.customer_id || "") || "") + " " + (cPhone.get(t.customer_id || "") || "")).toLowerCase().includes(q));

  const items = tks.map((t) => ({
    id: t.id as string,
    title: (t.title as string) || "—",
    body: (t.body as string) || "",
    status: (t.status as string) || "open",
    priority: (t.priority as string) || "medium",
    customerId: (t.customer_id as string) || "",
    customerName: cName.get(t.customer_id || "") || "—",
    assigneeId: (t.assignee_id as string) || "",
    assigneeName: pName.get(t.assignee_id || "") || "—",
    date: t.created_at ? String(t.created_at).slice(0, 10) : "",
  }));

  return <SupportBoard key={q || "all"} initial={items} assignees={assignees} subjects={subjects} meId={user?.id || ""} />;
}
