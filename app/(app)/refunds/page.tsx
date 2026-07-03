import Link from "next/link";
import RefundTable from "./RefundTable";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " EGP");
}

const STATUS: Record<string, { labelKey: string; color: string; bg: string }> = {
  requested: { labelKey: "refundRequested2", color: "#B8860B", bg: "#FEF6E0" },
  refunded: { labelKey: "refundDone2", color: "#2F6BFF", bg: "#E8F0FF" },
  closed: { labelKey: "archived", color: "#94A2BB", bg: "#EEF1F6" },
};

export default async function Refunds() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("can_see_finance").eq("id", user?.id || "").maybeSingle();

  if (!prof?.can_see_finance) {
    return (
      <div className="page-h"><div><h1>{tr("refunds")}</h1><p>{tr("noFinanceAccess")}</p></div></div>
    );
  }

  const [{ data: rf, error }, { data: custs }] = await Promise.all([
    supabase.from("refunds").select("id,customer_id,amount,currency,reason,status,created_at").order("created_at", { ascending: false }),
    supabase.from("customers").select("id,name"),
  ]);

  if (error) {
    const missingTable = (error as any)?.code === "42P01" || /does not exist|relation .* does not/i.test((error as any)?.message || "");
    return (
      <div>
        <div className="page-h"><div><h1>{tr("refunds")}</h1></div></div>
        <div className="card" style={{ padding: 20, fontSize: 14, color: "var(--muted)" }}>
          {missingTable
            ? tr("refundsTableMissing")
            : `${tr("refundsLoadFailed")} ${(error as any)?.message || tr("unknownError")}`}
        </div>
      </div>
    );
  }

  const rows = rf || [];
  const cName = new Map((custs || []).map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="page-h"><div><h1>{tr("refunds")}</h1><p>{rows.length} {tr("requestWord")}</p></div></div>

      {rows.length === 0 ? (
        <div className="empty"><b>{tr("noRefundRequests")}</b></div>
      ) : (
        <RefundTable rows={rows.map((r) => ({
          id: r.id as string, customer_id: r.customer_id as string,
          customerName: cName.get(r.customer_id) || "—",
          amount: Number(r.amount), currency: r.currency as string,
          reason: (r.reason as string) || "", status: r.status as string,
          created_at: String(r.created_at || ""),
        }))} />
      )}
    </div>
  );
}
