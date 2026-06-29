import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " ج");
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  requested: { label: "في انتظار الريفند", color: "#B8860B", bg: "#FEF6E0" },
  refunded: { label: "تم الريفند — بانتظار الإغلاق", color: "#2F6BFF", bg: "#E8F0FF" },
  closed: { label: "مؤرشف", color: "#94A2BB", bg: "#EEF1F6" },
};

export default async function Refunds() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("can_see_finance").eq("id", user?.id || "").maybeSingle();

  if (!prof?.can_see_finance) {
    return (
      <div className="page-h"><div><h1>{tr("refunds")}</h1><p>مالكش صلاحية رؤية البيانات المالية.</p></div></div>
    );
  }

  const { data: rf, error } = await supabase.from("refunds")
    .select("id,customer_id,amount,currency,reason,status,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <div className="page-h"><div><h1>{tr("refunds")}</h1></div></div>
        <div className="card" style={{ padding: 20, fontSize: 14, color: "var(--muted)" }}>
          جدول الاسترداد لسه مش متعمل في قاعدة البيانات. شغّل SQL الـ refunds مرة واحدة في Supabase وهتشتغل الشاشة.
        </div>
      </div>
    );
  }

  const rows = rf || [];
  const { data: custs } = await supabase.from("customers").select("id,name");
  const cName = new Map((custs || []).map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="page-h"><div><h1>{tr("refunds")}</h1><p>{rows.length} طلب</p></div></div>

      {rows.length === 0 ? (
        <div className="empty"><b>لا توجد طلبات استرداد</b></div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>العميل</th><th>المبلغ</th><th>السبب</th><th>الحالة</th><th>التاريخ</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = STATUS[r.status as string] || STATUS.requested;
                return (
                  <tr key={r.id as string}>
                    <td>
                      <Link href={`/customers/${r.customer_id}`} style={{ color: "var(--brand)", fontWeight: 700 }}>
                        {cName.get(r.customer_id) || "—"}
                      </Link>
                    </td>
                    <td className="num" dir="ltr" style={{ fontWeight: 700 }}>{money(Number(r.amount), r.currency as string)}</td>
                    <td style={{ color: "var(--muted)", maxWidth: 260 }}>{r.reason || "—"}</td>
                    <td><span className="stg" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td className="num" dir="ltr" style={{ color: "var(--muted)" }}>{String(r.created_at || "").slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
