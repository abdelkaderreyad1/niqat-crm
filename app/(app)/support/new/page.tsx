import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import NewTicketForm from "./NewTicketForm";

export const dynamic = "force-dynamic";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: { customer?: string };
}) {
  const supabase = createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id,name")
    .eq("deleted", false)
    .order("name", { ascending: true });

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/support" style={{ fontSize: 13, color: "var(--muted)" }}>← رجوع للدعم</Link>
      </div>
      <div className="page-h"><h1>{tr("newTicket")}</h1></div>
      <NewTicketForm
        customers={(customers as any) || []}
        presetCustomer={searchParams.customer || ""}
      />
    </div>
  );
}
