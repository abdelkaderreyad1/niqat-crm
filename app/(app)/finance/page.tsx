import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import CollectionsTable from "./CollectionsTable";

export const dynamic = "force-dynamic";

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " EGP");
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color }}>{value}</div>
    </div>
  );
}

export default async function Finance() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prof } = await supabase
    .from("profiles")
    .select("can_see_finance")
    .eq("id", user?.id || "")
    .maybeSingle();

  if (!prof?.can_see_finance) {
    return (
      <div className="page-h">
        <div>
          <h1>{tr("financeTitle")}</h1>
          <p>{tr("noFinanceAccess")}</p>
        </div>
      </div>
    );
  }

  const [{ data: enrs }, { data: fin }, { data: insts }, { data: custs }, { data: dips }] =
    await Promise.all([
      supabase.from("enrollments").select("id,customer_id,diploma_id"),
      supabase.from("enrollment_finance").select("enrollment_id,agreed_amount,currency"),
      supabase.from("installments").select("id,enrollment_id,amount,currency,due_date,paid_at,status"),
      supabase.from("customers").select("id,name"),
      supabase.from("diplomas").select("id,name_ar"),
    ]);

  const cName = new Map((custs || []).map((c) => [c.id, c.name]));
  const dName = new Map((dips || []).map((d) => [d.id, d.name_ar]));
  const enrMap = new Map((enrs || []).map((e) => [e.id, e]));

  let agreed = 0;
  (fin || []).forEach((f) => {
    if (f.currency === "EGP") agreed += Number(f.agreed_amount) || 0;
  });
  let collected = 0;
  (insts || []).forEach((i) => {
    if (i.currency === "EGP" && (i.status === "paid" || i.paid_at)) collected += Number(i.amount) || 0;
  });
  const outstanding = agreed - collected;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 86400000;

  const rows = (insts || [])
    .filter((i) => i.status !== "paid" && !i.paid_at)
    .map((i) => {
      const e: any = enrMap.get(i.enrollment_id);
      const due = i.due_date ? new Date(i.due_date) : null;
      let state: "overdue" | "soon" | "upcoming" = "upcoming";
      if (due) {
        const diff = (due.getTime() - today.getTime()) / dayMs;
        if (diff < 0) state = "overdue";
        else if (diff <= 7) state = "soon";
      }
      return {
        id: i.id as string,
        customerId: (e?.customer_id as string) || "",
        customerName: cName.get(e?.customer_id || "") || "—",
        diploma: dName.get(e?.diploma_id || "") || "—",
        amount: Number(i.amount) || 0,
        currency: (i.currency as string) || "EGP",
        due: i.due_date ? String(i.due_date).slice(0, 10) : "",
        state,
      };
    })
    .sort((a, b) => (a.due || "").localeCompare(b.due || ""));

  const overdueN = rows.filter((r) => r.state === "overdue").length;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("financeTitle")}</h1>
          <p>{tr("financeDesc")}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
        <Kpi label={tr("totalAgreed")} value={money(agreed, "EGP")} color="#2F6BFF" />
        <Kpi label={tr("collected")} value={money(collected, "EGP")} color="#18A957" />
        <Kpi label={tr("remaining")} value={money(outstanding, "EGP")} color="#E6A700" />
        <Kpi label={tr("overdueInstallments")} value={String(overdueN)} color="#E0483B" />
      </div>

      <CollectionsTable rows={rows} />
    </div>
  );
}
