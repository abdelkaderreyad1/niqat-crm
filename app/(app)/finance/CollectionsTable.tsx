"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string;
  customerId: string;
  customerName: string;
  diploma: string;
  amount: number;
  currency: string;
  due: string;
  state: "overdue" | "soon" | "upcoming";
};

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " ج");
}

const STATE: Record<string, { label: string; color: string; bg: string }> = {
  overdue: { label: "متأخر", color: "#E0483B", bg: "#FDECEA" },
  soon: { label: "خلال ٧ أيام", color: "#B8860B", bg: "#FEF6E0" },
  upcoming: { label: "قادم", color: "#5B6B85", bg: "#EEF1F6" },
};

export default function CollectionsTable({ rows }: { rows: Row[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [list, setList] = useState<Row[]>(rows);
  const [busy, setBusy] = useState<string | null>(null);

  async function markPaid(id: string) {
    setBusy(id);
    const { error } = await supabase
      .from("installments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) {
      alert("تعذّر التحديث: " + error.message);
      return;
    }
    setList((l) => l.filter((r) => r.id !== id));
    router.refresh();
  }

  if (list.length === 0)
    return (
      <div className="bg-white rounded-xl border border-line p-6 text-center text-muted text-sm">
        مفيش أقساط مستحقة 🎉
      </div>
    );

  return (
    <div className="bg-white rounded-xl border border-line overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-brand-soft/50 text-muted text-xs">
          <tr>
            <th className="text-start px-4 py-3 font-bold">العميل</th>
            <th className="text-start px-4 py-3 font-bold">الدبلومة</th>
            <th className="text-start px-4 py-3 font-bold">المبلغ</th>
            <th className="text-start px-4 py-3 font-bold">الاستحقاق</th>
            <th className="text-start px-4 py-3 font-bold">الحالة</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const st = STATE[r.state];
            return (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link
                    href={`/customers/${r.customerId}`}
                    className="text-brand font-bold hover:underline"
                  >
                    {r.customerName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink">{r.diploma}</td>
                <td className="px-4 py-3 num font-bold" dir="ltr">
                  {money(r.amount, r.currency)}
                </td>
                <td className="px-4 py-3 num text-muted" dir="ltr">
                  {r.due || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-[11px] rounded-full px-2 py-0.5 font-bold"
                    style={{ color: st.color, background: st.bg }}
                  >
                    {st.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-end">
                  <button
                    onClick={() => markPaid(r.id)}
                    disabled={busy === r.id}
                    className="bg-green text-white text-xs font-bold rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === r.id ? "..." : "تم الدفع"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
