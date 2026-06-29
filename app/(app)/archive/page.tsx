import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export default async function Archive() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("customers")
    .select("id,name,email,phone1")
    .eq("archived", true)
    .order("updated_at", { ascending: false })
    .limit(300);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("archive")}</h1>
          <p>{(rows || []).length} عميل مؤرشف</p>
        </div>
      </div>
      {(!rows || rows.length === 0) ? (
        <div className="empty"><b>الأرشيف فاضي</b></div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>الاسم</th><th>الموبايل / الإيميل</th></tr></thead>
            <tbody>
              {(rows || []).map((c) => (
                <tr key={c.id as string}>
                  <td>
                    <Link href={`/customers/${c.id}`} style={{ color: "var(--blue)", fontWeight: 700 }}>
                      <div className="cust-name">{c.name}</div>
                    </Link>
                  </td>
                  <td className="num" dir="ltr">{c.phone1 || c.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
