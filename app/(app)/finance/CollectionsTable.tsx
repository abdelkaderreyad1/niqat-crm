"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string; customerId: string; customerName: string; diploma: string;
  amount: number; currency: string; due: string; state: "overdue" | "soon" | "upcoming";
};

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " EGP");
}

const STATE: Record<string, { labelKey: string; color: string; bg: string }> = {
  overdue: { labelKey: "overdueWord", color: "#E0483B", bg: "#FDECEA" },
  soon: { labelKey: "within7days", color: "#B8860B", bg: "#FEF6E0" },
  upcoming: { labelKey: "upcomingWord", color: "#5B6B85", bg: "#EEF1F6" },
};

export default function CollectionsTable({ rows }: { rows: Row[] }) {
  const tr = useT();
  const supabase = createClient();
  const router = useRouter();
  const [list, setList] = useState<Row[]>(rows);
  const [busy, setBusy] = useState<string | null>(null);

  async function markPaid(id: string) {
    setBusy(id);
    const { error } = await supabase.from("installments")
      .update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    setBusy(null);
    if (error) { alert(tr("updateFailed") + error.message); return; }
    setList((l) => l.filter((r) => r.id !== id));
    router.refresh();
  }

  if (list.length === 0)
    return (
      <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
        {tr("noDueInstallments")} 🎉
      </div>
    );

  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>{tr("customer")}</th>
            <th>{tr("theDiploma")}</th>
            <th>{tr("amount")}</th>
            <th>{tr("dueDate2")}</th>
            <th>{tr("status")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const st = STATE[r.state];
            return (
              <tr key={r.id}>
                <td>
                  <Link href={`/customers/${r.customerId}`} style={{ color: "var(--brand)", fontWeight: 700 }}>
                    {r.customerName}
                  </Link>
                </td>
                <td>{r.diploma}</td>
                <td className="num" dir="ltr" style={{ fontWeight: 700 }}>{money(r.amount, r.currency)}</td>
                <td className="num" dir="ltr" style={{ color: "var(--muted)" }}>{r.due || "—"}</td>
                <td>
                  <span style={{ fontSize: 11, borderRadius: 20, padding: "2px 9px", fontWeight: 700, color: st.color, background: st.bg }}>
                    {tr(st.labelKey)}
                  </span>
                </td>
                <td style={{ textAlign: "end" }}>
                  <button onClick={() => markPaid(r.id)} disabled={busy === r.id}
                    className="btn" style={{ background: "var(--green)", padding: "6px 12px", fontSize: 12 }}>
                    {busy === r.id ? "..." : tr("markPaid")}
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
