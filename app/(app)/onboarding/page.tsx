import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("handoffs")
    .select("id,customer_id,assignee_id,note,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: custs } = await supabase.from("customers").select("id,name");
  const cMap = new Map((custs || []).map((c) => [c.id, c.name]));
  const { data: profs } = await supabase.from("profiles").select("id,full_name");
  const pMap = new Map((profs || []).map((p) => [p.id, p.full_name]));

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("onboarding")}</h1>
          <p>{(rows || []).length} تسليم في الانتظار</p>
        </div>
      </div>
      {(!rows || rows.length === 0) ? (
        <div className="empty"><b>لا توجد عمليات تسليم معلّقة</b></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(rows || []).map((h) => (
            <Link key={h.id as string} href={`/customers/${h.customer_id}`} className="card" style={{ padding: 14, display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ color: "var(--ink)" }}>{cMap.get(h.customer_id as string) || "—"}</b>
                <span className="stg" style={{ background: "#E6A7001a", color: "#E6A700" }}>في الانتظار</span>
              </div>
              {h.note && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>{h.note}</div>}
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                المسؤول: {pMap.get(h.assignee_id || "") || "غير معيّن"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
