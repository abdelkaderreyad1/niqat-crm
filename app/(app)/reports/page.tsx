import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(n: number) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + " ج";
}

const STAGES: Record<string, { label: string; color: string }> = {
  new: { label: "جديد", color: "#2F6BFF" },
  contacted: { label: "تم التواصل", color: "#0FA3A3" },
  interested: { label: "مهتم", color: "#7B61FF" },
  negotiation: { label: "تفاوض", color: "#F08A24" },
  enrolled: { label: "مشترك", color: "#18A957" },
  onhold: { label: "معلّق", color: "#E6A700" },
  lost: { label: "خسارة", color: "#94A2BB" },
};

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-line p-4">
      <div className="text-xs text-muted font-bold">{label}</div>
      <div className="text-2xl font-extrabold num mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export default async function Reports() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prof } = await supabase
    .from("profiles")
    .select("can_view_reports, can_see_finance")
    .eq("id", user?.id || "")
    .maybeSingle();

  if (!prof?.can_view_reports) {
    return (
      <div className="page-h">
        <div>
          <h1>التقارير</h1>
          <p>مالكش صلاحية رؤية التقارير.</p>
        </div>
      </div>
    );
  }
  const canFinance = !!prof.can_see_finance;

  const [{ data: custs }, { data: enrs }, { data: affSetting }] = await Promise.all([
    supabase
      .from("customers")
      .select("id,stage,affiliate_code")
      .eq("deleted", false)
      .eq("archived", false),
    supabase.from("enrollments").select("customer_id"),
    supabase.from("app_settings").select("value").eq("key", "affiliates").maybeSingle(),
  ]);

  // money (only if allowed; RLS returns empty otherwise)
  let agreed = 0,
    collected = 0,
    overdueN = 0;
  if (canFinance) {
    const [{ data: fin }, { data: insts }] = await Promise.all([
      supabase.from("enrollment_finance").select("agreed_amount,currency"),
      supabase.from("installments").select("amount,currency,due_date,paid_at,status"),
    ]);
    (fin || []).forEach((f) => {
      if (f.currency === "EGP") agreed += Number(f.agreed_amount) || 0;
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    (insts || []).forEach((i) => {
      const paid = i.status === "paid" || i.paid_at;
      if (i.currency === "EGP" && paid) collected += Number(i.amount) || 0;
      if (!paid && i.due_date && new Date(i.due_date) < today) overdueN++;
    });
  }

  // pipeline breakdown
  const stageCount: Record<string, number> = {};
  (custs || []).forEach((c) => {
    const s = c.stage || "new";
    stageCount[s] = (stageCount[s] || 0) + 1;
  });
  const totalCust = (custs || []).length;
  const maxStage = Math.max(1, ...Object.values(stageCount));

  // affiliate report
  const enrolledSet = new Set((enrs || []).map((e) => e.customer_id));
  const affList: { name: string; code: string; discount: number }[] = Array.isArray(
    affSetting?.value
  )
    ? (affSetting!.value as any[])
    : [];
  const affName = new Map(affList.map((a) => [a.code, a]));
  const affAgg: Record<string, { customers: number; enrolled: number }> = {};
  (custs || []).forEach((c) => {
    const code = (c.affiliate_code || "").trim();
    if (!code) return;
    if (!affAgg[code]) affAgg[code] = { customers: 0, enrolled: 0 };
    affAgg[code].customers++;
    if (enrolledSet.has(c.id)) affAgg[code].enrolled++;
  });
  const affRows = Object.entries(affAgg)
    .map(([code, v]) => ({
      code,
      name: affName.get(code)?.name || "—",
      discount: affName.get(code)?.discount ?? null,
      customers: v.customers,
      enrolled: v.enrolled,
    }))
    .sort((a, b) => b.customers - a.customers);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>التقارير</h1>
          <p>نظرة سريعة على المبيعات والتحصيل والإحالات</p>
        </div>
      </div>

      {canFinance && (
        <>
          <h2 className="font-extrabold mb-2 text-ink">التحصيل</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Kpi label="إجمالي المتفق عليه" value={money(agreed)} color="#2F6BFF" />
            <Kpi label="إجمالي المحصّل" value={money(collected)} color="#18A957" />
            <Kpi label="المتبقّي" value={money(agreed - collected)} color="#E6A700" />
            <Kpi label="أقساط متأخرة" value={String(overdueN)} color="#E0483B" />
          </div>
        </>
      )}

      <h2 className="font-extrabold mb-2 text-ink">توزيع المراحل ({totalCust} عميل)</h2>
      <div className="bg-white rounded-xl border border-line p-4 mb-6 space-y-2">
        {Object.keys(STAGES).map((s) => {
          const n = stageCount[s] || 0;
          const st = STAGES[s];
          return (
            <div key={s} className="flex items-center gap-3">
              <div className="w-24 text-sm text-ink shrink-0">{st.label}</div>
              <div className="flex-1 bg-bg rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full"
                  style={{ width: `${(n / maxStage) * 100}%`, background: st.color }}
                />
              </div>
              <div className="w-10 text-end num font-bold text-ink">{n}</div>
            </div>
          );
        })}
      </div>

      <h2 className="font-extrabold mb-2 text-ink">تقرير الإحالات / الأفيلييت</h2>
      <div className="bg-white rounded-xl border border-line overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-brand-soft/50 text-muted text-xs">
            <tr>
              <th className="text-start px-4 py-3 font-bold">الكود</th>
              <th className="text-start px-4 py-3 font-bold">الأفيلييت</th>
              <th className="text-start px-4 py-3 font-bold">الخصم</th>
              <th className="text-start px-4 py-3 font-bold">عدد العملاء</th>
              <th className="text-start px-4 py-3 font-bold">مسجّلون</th>
            </tr>
          </thead>
          <tbody>
            {affRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  لا توجد إحالات بعد.
                </td>
              </tr>
            )}
            {affRows.map((r) => (
              <tr key={r.code} className="border-t border-line">
                <td className="px-4 py-3 font-bold text-brand">{r.code}</td>
                <td className="px-4 py-3 text-ink">{r.name}</td>
                <td className="px-4 py-3 num">{r.discount != null ? r.discount + "%" : "—"}</td>
                <td className="px-4 py-3 num font-bold">{r.customers}</td>
                <td className="px-4 py-3 num font-bold text-green">{r.enrolled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
