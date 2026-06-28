import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TicketDetail from "./TicketDetail";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id,title,body,status,priority,customer_id,assignee_id,created_at")
    .eq("id", params.id)
    .single();

  if (!ticket) notFound();

  const [{ data: customer }, { data: assignees }, { data: notes }] = await Promise.all([
    ticket.customer_id
      ? supabase.from("customers").select("id,name,phone1").eq("id", ticket.customer_id).single()
      : Promise.resolve({ data: null } as any),
    supabase.from("profiles").select("id,full_name,team").in("team", ["support", "admin"]),
    supabase
      .from("ticket_notes")
      .select("id,body,created_at,author_id")
      .eq("ticket_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  const { data: profs } = await supabase.from("profiles").select("id,full_name");
  const pName = new Map((profs || []).map((p) => [p.id, p.full_name]));

  const notesView = (notes || []).map((n) => ({
    id: n.id,
    body: n.body,
    created_at: n.created_at,
    author: pName.get(n.author_id || "") || "—",
  }));

  const { data: auth } = await supabase.auth.getUser();
  const currentUserId = auth?.user?.id || null;

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/support" className="text-sm text-muted hover:text-ink">
          ← رجوع للدعم
        </Link>
      </div>
      <TicketDetail
        ticket={ticket as any}
        customer={(customer as any) || null}
        assignees={(assignees as any) || []}
        notes={notesView}
        currentUserId={currentUserId}
      />
    </div>
  );
}
