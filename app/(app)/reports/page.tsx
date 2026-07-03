import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function money(n: number) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + " EGP";
}

const STAGES: Record<string, { labelKey: string; color: string }> = {
  new: { labelKey: "dashStageNew", color: "#2F6BFF" },
  contacted: { labelKey: "dashStageContacted", color: "#0FA3A3" },
  interested: { labelKey: "dashStageInterested", color: "#7B61FF" },
  quote: { labelKey: "dashStageQuote", color: "#E6A700" },
  negotiation: { labelKey: "dashStageNegotiation", color: "#F08A24" },
  enrolled: { labelKey: "dashStageEnrolled", color: "#18A957" },
  onhold: { labelKey: "dashStageOnhold", color: "#E6A700" },
  lost: { labelKey: "dashStageLost", color: "#94A2BB" },
};

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color }}>{value}</div>
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
          <h1>{tr("reports")}</h1>
          <p>{tr("noReportsAccess")}</p>
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
  // الريفند (دول مؤرشفين فمش في custs) — نجيب أكوادهم
  const { data: refundRows } = await supabase.from("refunds").select("customer_id");
  const refundIds = Array.from(new Set((refundRows || []).map((r: any) => r.customer_id)));
  const refundCodeCount: Record<string, number> = {};
  if (refundIds.length) {
    const { data: refCusts } = await supabase.from("customers").select("affiliate_code").in("id", refundIds);
    (refCusts || []).forEach((c: any) => {
      const code = (c.affiliate_code || "").trim();
      if (code) refundCodeCount[code] = (refundCodeCount[code] || 0) + 1;
    });
  }

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
  Object.keys(refundCodeCount).forEach((code) => { if (!affAgg[code]) affAgg[code] = { customers: 0, enrolled: 0 }; });
  const affRows = Object.entries(affAgg)
    .map(([code, v]) => ({
      code,
      name: affName.get(code)?.name || "—",
      discount: affName.get(code)?.discount ?? null,
      customers: v.customers,
      enrolled: v.enrolled,
      interested: Math.max(0, v.customers - v.enrolled),
      refunded: refundCodeCount[code] || 0,
    }))
    .sort((a, b) => b.customers - a.customers);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("reports")}</h1>
          <p>{tr("reportsDesc")}</p>
        </div>
      </div>

      {canFinance && (
        <>
          <h2 className="font-extrabold mb-2 text-ink">{tr("collection")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Kpi label={tr("totalAgreed")} value={money(agreed)} color="#2F6BFF" />
            <Kpi label={tr("totalCollected")} value={money(collected)} color="#18A957" />
            <Kpi label={tr("remaining")} value={money(agreed - collected)} color="#E6A700" />
            <Kpi label={tr("overdueInstallments")} value={String(overdueN)} color="#E0483B" />
          </div>
        </>
      )}

      <h2 className="font-extrabold mb-2 text-ink">{tr("stageDistribution")} ({totalCust} {tr("customer")})</h2>
      <div className="card" style={{ padding: 16, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.keys(STAGES).map((s) => {
          const n = stageCount[s] || 0;
          const st = STAGES[s];
          return (
            <div key={s} className="flex items-center gap-3">
              <div className="w-24 text-sm text-ink shrink-0">{tr(st.labelKey)}</div>
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

      <h2 className="font-extrabold mb-2 text-ink">{tr("affiliatesReport")}</h2>
      <div className="tbl-wrap">
        <table style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th className="text-start px-4 py-3 font-bold">{tr("code")}</th>
              <th className="text-start px-4 py-3 font-bold">{tr("affiliate")}</th>
              <th className="text-start px-4 py-3 font-bold">{tr("discountCol")}</th>
              <th className="text-start px-4 py-3 font-bold">{tr("customerCount")}</th>
              <th className="text-start px-4 py-3 font-bold">{tr("enrolledCol")}</th>
              <th className="text-start px-4 py-3 font-bold">{tr("interestedStill")}</th>
              <th className="text-start px-4 py-3 font-bold">{tr("refundWord")}</th>
            </tr>
          </thead>
          <tbody>
            {affRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  {tr("noAffiliatesYet")}
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
                <td className="px-4 py-3 num font-bold" style={{ color: "#E6A700" }}>{r.interested}</td>
                <td className="px-4 py-3 num font-bold" style={{ color: "#E0483B" }}>{r.refunded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
