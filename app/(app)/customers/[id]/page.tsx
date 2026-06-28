import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerEdit from "./CustomerEdit";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();

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

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold">{c.name}</h1>
        <Link href="/customers" className="text-sm text-muted hover:text-ink">
          ← رجوع للعملاء
        </Link>
      </div>

      <CustomerEdit customer={c} specialties={specs || []} />

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
