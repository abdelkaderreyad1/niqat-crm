"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Inst = {
  id: string;
  amount: number;
  currency: string;
  due: string;
  status: string;
  paidAt: string | null;
};
type Enr = {
  id: string;
  diploma: string;
  status: string;
  free: boolean;
  freeReason: string;
  agreed: number;
  currency: string;
  installments: Inst[];
};

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " ج");
}
function paidOf(e: Enr) {
  return e.installments
    .filter((i) => i.status === "paid" || i.paidAt)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
}
function isOverdue(i: Inst) {
  if (i.status === "paid" || i.paidAt || !i.due) return false;
  return new Date(i.due) < new Date(new Date().toDateString());
}

export default function FinancePanel({ enrollments }: { enrollments: Enr[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [due, setDue] = useState("");

  async function markPaid(id: string) {
    setBusy(id);
    const { error } = await supabase
      .from("installments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) return alert("تعذّر التحديث: " + error.message);
    router.refresh();
  }

  async function addInstallment(e: Enr) {
    const a = Number(amt);
    if (!a || a <= 0) return alert("اكتب مبلغ صحيح.");
    setBusy("add");
    const { error } = await supabase.from("installments").insert({
      enrollment_id: e.id,
      amount: a,
      currency: e.currency || "EGP",
      due_date: due || null,
      status: "pending",
    });
    setBusy(null);
    if (error) return alert("تعذّر إضافة القسط: " + error.message);
    setAddFor(null);
    setAmt("");
    setDue("");
    router.refresh();
  }

  if (enrollments.length === 0)
    return (
      <div className="bg-white rounded-xl border border-line p-4 mt-4">
        <h2 className="font-extrabold mb-2">المالية والأقساط</h2>
        <div className="text-xs text-muted">لا توجد اشتراكات لهذا العميل.</div>
      </div>
    );

  return (
    <div className="bg-white rounded-xl border border-line p-4 mt-4">
      <h2 className="font-extrabold mb-3">المالية والأقساط</h2>
      <div className="space-y-4">
        {enrollments.map((e) => {
          const paid = paidOf(e);
          const remaining = (Number(e.agreed) || 0) - paid;
          return (
            <div key={e.id} className="border border-line rounded-lg p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-bold text-ink">
                  {e.diploma}
                  {e.free && <span className="text-xs text-brand mr-2">🎁 هدية</span>}
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-muted">
                    المتفق: <b className="num text-ink">{money(e.agreed, e.currency)}</b>
                  </span>
                  <span className="text-green">
                    المدفوع: <b className="num">{money(paid, e.currency)}</b>
                  </span>
                  <span className="text-amber">
                    المتبقّي: <b className="num">{money(remaining, e.currency)}</b>
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {e.installments.length === 0 && (
                  <div className="text-xs text-muted">لا توجد أقساط مسجّلة.</div>
                )}
                {e.installments.map((i) => {
                  const paidNow = i.status === "paid" || i.paidAt;
                  const over = isOverdue(i);
                  return (
                    <div
                      key={i.id}
                      className="flex items-center justify-between gap-2 text-sm border border-line rounded-md px-2.5 py-1.5"
                    >
                      <span className="num font-bold" dir="ltr">
                        {money(i.amount, i.currency)}
                      </span>
                      <span className="num text-muted text-xs" dir="ltr">
                        {i.due || "—"}
                      </span>
                      {paidNow ? (
                        <span className="text-[11px] rounded-full px-2 py-0.5 font-bold" style={{ color: "#18A957", background: "#EAF7EF" }}>
                          مدفوع
                        </span>
                      ) : over ? (
                        <span className="text-[11px] rounded-full px-2 py-0.5 font-bold" style={{ color: "#E0483B", background: "#FDECEA" }}>
                          متأخر
                        </span>
                      ) : (
                        <span className="text-[11px] rounded-full px-2 py-0.5 font-bold" style={{ color: "#5B6B85", background: "#EEF1F6" }}>
                          مستحق
                        </span>
                      )}
                      {!paidNow ? (
                        <button
                          onClick={() => markPaid(i.id)}
                          disabled={busy === i.id}
                          className="bg-green text-white text-[11px] font-bold rounded-md px-2.5 py-1 hover:opacity-90 disabled:opacity-50"
                        >
                          تم الدفع
                        </button>
                      ) : (
                        <span className="w-[60px]" />
                      )}
                    </div>
                  );
                })}
              </div>

              {addFor === e.id ? (
                <div className="flex gap-2 mt-3">
                  <input
                    className="border border-line rounded-md px-2 py-1 text-sm w-28 num"
                    placeholder="المبلغ"
                    value={amt}
                    onChange={(ev) => setAmt(ev.target.value)}
                  />
                  <input
                    type="date"
                    className="border border-line rounded-md px-2 py-1 text-sm num"
                    value={due}
                    onChange={(ev) => setDue(ev.target.value)}
                  />
                  <button
                    onClick={() => addInstallment(e)}
                    disabled={busy === "add"}
                    className="bg-brand text-white text-xs font-bold rounded-md px-3 py-1 hover:bg-brand-dark disabled:opacity-50"
                  >
                    حفظ
                  </button>
                  <button
                    onClick={() => setAddFor(null)}
                    className="text-xs text-muted px-2"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAddFor(e.id);
                    setAmt("");
                    setDue("");
                  }}
                  className="text-xs text-brand font-bold mt-3 hover:underline"
                >
                  + قسط
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
