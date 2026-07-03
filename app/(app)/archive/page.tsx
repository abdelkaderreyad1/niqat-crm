import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import RestoreBtn from "./RestoreBtn";
export const dynamic = "force-dynamic";

export default async function Archive() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("customers")
    .select("id,name,email,phone1")
    .eq("archived", true)
    .order("updated_at", { ascending: false })
    .limit(300);
  // سبب الأرشفة = ريفند
  const ids = (rows || []).map((r: any) => r.id);
  const reasonMap = new Map<string, string>();
  if (ids.length) {
    const rf = await supabase.from("refunds").select("customer_id,reason,status").in("customer_id", ids);
    if (!rf.error) for (const r of (rf.data as any[]) || []) reasonMap.set(r.customer_id, r.reason || tr("refundWord"));
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("archive")}</h1>
          <p>{(rows || []).length} {tr("archivedCustomer")}</p>
        </div>
      </div>
      {(!rows || rows.length === 0) ? (
        <div className="empty"><b>{tr("archiveEmpty")}</b></div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>{tr("name")}</th><th>{tr("mobileEmail")}</th><th>{tr("archiveReason")}</th><th></th></tr></thead>
            <tbody>
              {(rows || []).map((c) => (
                <tr key={c.id as string}>
                  <td>
                    <Link href={`/customers/${c.id}`} style={{ color: "var(--blue)", fontWeight: 700 }}>
                      <div className="cust-name">{c.name}</div>
                    </Link>
                  </td>
                  <td className="num" dir="ltr">{c.phone1 || c.email || "—"}</td>
                  <td><span className="stg" style={{ background: "var(--red-soft)", color: "var(--red)" }}>{tr("refundWord")}{reasonMap.get(c.id as string) && reasonMap.get(c.id as string) !== tr("refundWord") ? " — " + reasonMap.get(c.id as string) : ""}</span></td>
                  <td><RestoreBtn id={c.id as string} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
