import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerEdit from "./CustomerEdit";
import FinancePanel from "./FinancePanel";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: meProf } = await supabase
    .from("profiles")
    .select("can_see_finance")
    .eq("id", user?.id || "")
    .maybeSingle();
  const canFinance = !!meProf?.can_see_finance;

  const { data: c } = await supabase
    .from("customers")
    .select(
      "id,name,phone1,phone2,email,company,residency,grad_year,stage,specialty_id,lms_status,source,created_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!c) notFound();

  const { data: specs } = await supabase
    .from("specialties")
    .select("id,name_ar")
    .order("name_ar");

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id,title,status,priority")
    .eq("customer_id", params.id)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  const TK: Record<string, { label: string; color: string }> = {
    open: { label: "مفتوحة", color: "#2F6BFF" },
    progress: { label: "قيد المعالجة", color: "#E6A700" },
    resolved: { label: "محلولة", color: "#18A957" },
    closed: { label: "مغلقة", color: "#94A2BB" },
  };

  let finEnrollments: any[] = [];
  if (canFinance) {
    const { data: enrs } = await supabase
      .from("enrollments")
      .select("id,diploma_id,status,free,free_reason")
      .eq("customer_id", params.id);
    const ids = (enrs || []).map((e) => e.id);
    if (ids.length) {
      const [{ data: fin }, { data: insts }, { data: dips }] = await Promise.all([
        supabase.from("enrollment_finance").select("enrollment_id,agreed_amount,currency").in("enrollment_id", ids),
        supabase
          .from("installments")
          .select("id,enrollment_id,amount,currency,due_date,paid_at,status")
          .in("enrollment_id", ids)
          .order("due_date", { ascending: true }),
        supabase.from("diplomas").select("id,name_ar"),
      ]);
      const dName = new Map((dips || []).map((d) => [d.id, d.name_ar]));
      const finMap = new Map((fin || []).map((f) => [f.enrollment_id, f]));
      finEnrollments = (enrs || []).map((e) => {
        const f: any = finMap.get(e.id);
        return {
          id: e.id,
          diploma: dName.get(e.diploma_id || "") || "—",
          status: e.status || "",
          free: !!e.free,
          freeReason: e.free_reason || "",
          agreed: Number(f?.agreed_amount) || 0,
          currency: f?.currency || "EGP",
          installments: (insts || [])
            .filter((i) => i.enrollment_id === e.id)
            .map((i) => ({
              id: i.id,
              amount: Number(i.amount) || 0,
              currency: i.currency || "EGP",
              due: i.due_date ? String(i.due_date).slice(0, 10) : "",
              status: i.status || "pending",
              paidAt: i.paid_at || null,
            })),
        };
      });
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold">{c.name}</h1>
        <Link href="/customers" className="text-sm text-muted hover:text-ink">
          ← رجوع للعملاء
        </Link>
      </div>

      <CustomerEdit customer={c} specialties={specs || []} />

      {canFinance && <FinancePanel enrollments={finEnrollments} />}

      <div className="bg-white rounded-xl border border-line p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold">تذاكر الدعم</h2>
          <Link
            href={`/support/new?customer=${c.id}`}
            className="text-sm bg-brand text-white rounded-lg px-3 py-1.5 font-bold hover:bg-brand-dark"
          >
            + تذكرة جديدة
          </Link>
        </div>

        {(!tickets || tickets.length === 0) && (
          <div className="text-xs text-muted">لا توجد تذاكر لهذا العميل.</div>
        )}

        <div className="space-y-2">
          {(tickets || []).map((t) => {
            const st = TK[t.status] || TK.open;
            return (
              <Link
                key={t.id}
                href={`/support/${t.id}`}
                className="flex items-center justify-between border border-line rounded-lg px-3 py-2 hover:bg-brand-soft/40"
              >
                <span className="text-sm font-bold text-ink">{t.title}</span>
                <span
                  className="text-[11px] rounded-full px-2 py-0.5 font-bold text-white"
                  style={{ background: st.color }}
                >
                  {st.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
