"use client";
import Link from "next/link";

type Row = {
  id: string; customer_id: string; customerName: string;
  amount: number; currency: string; reason: string; status: string; created_at: string;
};

const STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: "في انتظار الريفند", color: "#E6A700" },
  refunded: { label: "تم الريفند — بانتظار الإغلاق", color: "#2F6BFF" },
  closed: { label: "مؤرشف", color: "#94A2BB" },
};

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " ج");
}

export default function RefundTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <div className="empty"><b>لا توجد طلبات استرداد</b></div>;
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr><th>العميل</th><th>الخدمة / السبب</th><th>المبلغ</th><th>الحالة</th><th>الإجراءات</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = STATUS[r.status] || STATUS.requested;
            return (
              <tr key={r.id}>
                <td>
                  <Link href={`/customers/${r.customer_id}`} style={{ color: "var(--brand)", fontWeight: 700 }}>
                    {r.customerName || "—"}
                  </Link>
                </td>
                <td style={{ color: "var(--muted)", maxWidth: 260 }}>{r.reason || "—"}</td>
                <td className="num" dir="ltr" style={{ fontWeight: 700, color: "var(--ink)" }}>{money(r.amount, r.currency)}</td>
                <td><span className="stg" style={{ background: st.color + "22", color: st.color }}>{st.label}</span></td>
                <td>
                  <Link href={`/customers/${r.customer_id}`} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12.5 }}>
                    فتح الكارت
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
