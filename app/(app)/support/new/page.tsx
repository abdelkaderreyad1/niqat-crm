import Link from "next/link";
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
    <div className="max-w-lg">
      <div className="mb-4">
        <Link href="/support" className="text-sm text-muted hover:text-ink">
          ← رجوع للدعم
        </Link>
      </div>
      <h1 className="text-xl font-extrabold mb-4">تذكرة جديدة</h1>
      <NewTicketForm
        customers={(customers as any) || []}
        presetCustomer={searchParams.customer || ""}
      />
    </div>
  );
}
