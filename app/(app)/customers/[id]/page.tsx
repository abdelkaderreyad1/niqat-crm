import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerDrawer from "./CustomerDrawer";
import CopyNumbers from "./CopyNumbers";
import { getLang, tFor } from "@/lib/i18n";
import { receiptSignedUrl } from "@/lib/supabase/receipts";

export const dynamic = "force-dynamic";

const STAGE: Record<string, { labelKey: string; color: string }> = {
  new: { labelKey: "dashStageNew", color: "#2F6BFF" }, contacted: { labelKey: "dashStageContacted", color: "#0FA3A3" },
  interested: { labelKey: "dashStageInterested", color: "#7B61FF" }, negotiation: { labelKey: "dashStageNegotiation", color: "#F08A24" },
  quote: { labelKey: "dashStageQuote", color: "#E6A700" },
  enrolled: { labelKey: "dashStageEnrolled", color: "#18A957" }, onhold: { labelKey: "dashStageOnhold", color: "#7C8AA5" },
  lost: { labelKey: "dashStageLost", color: "#94A2BB" },
};

const AUDIT_KEYS: Record<string, string> = {
  batch_transfer: "auditBatchTransfer", enrollment_add: "auditEnrollmentAdd",
  installment_add: "auditInstallmentAdd", installment_paid: "auditInstallmentPaid",
  create: "auditCreate", update: "auditUpdate", stage_change: "auditStageChange",
  refund_request: "auditRefundRequest", refunded: "auditRefunded", handoff: "auditHandoff",
};

const TK: Record<string, { labelKey: string; color: string }> = {
  open: { labelKey: "openLabel", color: "#2F6BFF" }, progress: { labelKey: "inProgressLabel", color: "#E6A700" },
  resolved: { labelKey: "resolvedLabel", color: "#18A957" }, closed: { labelKey: "closedLabel", color: "#94A2BB" },
};

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const tr = tFor(getLang());
  const { data: { user } } = await supabase.auth.getUser();

  // ===== الموجة المتوازية: كل الاستعلامات المستقلة عن بعضها تتنفّذ مع بعض =====
  const [
    { data: meProf },
    { data: c },
    { data: specs },
    { data: enrRows },
    { data: allDips },
    { data: allBatches },
    { data: profs },
    { data: taskRows },
    { data: commRows },
    { data: auditRows },
    { data: tickets },
    { data: hoRows },
    { data: accOpts },
    { data: libOpts },
    docsRes,
    { data: fuRows },
    { data: tplRows },
    adRes,
    { data: accredRows },
    { data: projRows },
  ] = await Promise.all([
    supabase.from("profiles").select("can_see_finance,can_message").eq("id", user?.id || "").maybeSingle(),
    supabase.from("customers").select("id,name,phone1,phone2,email,company,residency,grad_year,stage,specialty_id,lms_status,source,affiliate_code,onhold_reason,created_at,terms_signed,terms_signed_at,handed_off").eq("id", params.id).maybeSingle(),
    supabase.from("specialties").select("id,name_ar").order("name_ar"),
    supabase.from("enrollments").select("id,status,diploma_id,batch_id, diplomas(name_ar), batches(code)").eq("customer_id", params.id),
    supabase.from("diplomas").select("id,name_ar").order("name_ar"),
    supabase.from("batches").select("id,code,status,price,currency,price_egp,price_usd").order("code"),
    supabase.from("profiles").select("id,full_name"),
    supabase.from("tasks").select("id,title,due_at,done").eq("customer_id", params.id).order("created_at", { ascending: false }),
    supabase.from("communications").select("id,body,by_id,at").eq("customer_id", params.id).order("at", { ascending: false }).limit(50),
    supabase.from("audit_log").select("action,detail,actor_id,at").eq("customer_id", params.id).order("at", { ascending: false }).limit(60),
    supabase.from("tickets").select("id,title,status").eq("customer_id", params.id).eq("archived", false).order("created_at", { ascending: false }),
    supabase.from("handoffs").select("id,status,note,assignee_id,created_by,created_at").eq("customer_id", params.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("access_options").select("id,label").order("label"),
    supabase.from("libraries").select("id,name").order("name"),
    supabase.from("customer_docs").select("id,url,name,created_at").eq("customer_id", params.id).order("created_at", { ascending: false }),
    supabase.from("follow_ups").select("id,due_at,note,done").eq("customer_id", params.id).order("due_at", { ascending: false }),
    supabase.from("wa_templates").select("id,name,body").order("created_at"),
    supabase.from("customer_addons").select("id,type,name,amount,free,note,paid,shot_url").eq("customer_id", params.id).order("created_at"),
    supabase.from("accreditations").select("name").order("name"),
    supabase.from("projects").select("name").order("name"),
  ]);

  const canFinance = !!meProf?.can_see_finance;
  const canMessage = !!meProf?.can_message;

  if (!c) notFound();

  const enrolls = (enrRows || []).map((e: any) => ({
    id: e.id, diploma: e.diplomas?.name_ar || "—", batch: e.batches?.code || "—",
    diplomaId: e.diploma_id || "", batchId: e.batch_id || "",
  }));
  const dipOpts = (allDips || []).map((d: any) => ({ v: d.id, label: d.name_ar }));
  const batchOpts = (allBatches || []).map((b: any) => ({ v: b.id, label: b.code, price: Number(b.price) || 0, currency: b.currency || "EGP", price_egp: Number(b.price_egp) || 0, price_usd: Number(b.price_usd) || 0 }));

  const pMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
  const tasks = (taskRows || []).map((k: any) => ({ id: k.id, title: k.title || "", due: k.due_at ? String(k.due_at).slice(0, 10) : "", done: !!k.done }));
  const notes = (commRows || []).map((n: any) => ({ id: n.id, body: n.body || "", by: pMap.get(n.by_id || "") || "—", at: String(n.at || "").replace("T", " ").slice(0, 16) }));

  // ===== المالية: تعتمد على canFinance + enrolls (تفضل بعد الموجة) =====
  let finEnrollments: any[] = [];
  if (canFinance && enrolls.length) {
    const enrs = enrRows || [];
    const ids = enrs.map((e: any) => e.id);
    if (ids.length) {
      const [{ data: fin }, { data: insts }] = await Promise.all([
        supabase.from("enrollment_finance").select("enrollment_id,agreed_amount,currency").in("enrollment_id", ids),
        supabase.from("installments").select("id,enrollment_id,amount,currency,due_date,paid_at,status,screenshot_url").in("enrollment_id", ids).order("due_date", { ascending: true }),
      ]);
      const dName = new Map((allDips || []).map((d: any) => [d.id, d.name_ar]));
      const finMap = new Map((fin || []).map((f: any) => [f.enrollment_id, f]));
      finEnrollments = await Promise.all(enrs.map(async (e: any) => {
        const f: any = finMap.get(e.id);
        return {
          id: e.id, diploma: dName.get(e.diploma_id || "") || "—", status: e.status || "",
          batchId: e.batch_id || "", batch: e.batches?.code || "",
          free: !!(e as any).free, freeReason: (e as any).free_reason || "",
          agreed: Number(f?.agreed_amount) || 0, currency: f?.currency || "EGP",
          installments: await Promise.all((insts || []).filter((i: any) => i.enrollment_id === e.id).map(async (i: any) => ({
            id: i.id, amount: Number(i.amount) || 0, currency: i.currency || "EGP",
            due: i.due_date ? String(i.due_date).slice(0, 10) : "", status: i.status || "pending", paidAt: i.paid_at || null,
            shot: (i as any).screenshot_url ? await receiptSignedUrl(supabase, (i as any).screenshot_url) : null,
          }))),
        };
      }));
    }
  }

  // ===== handoff_items: تعتمد على hoRows (تفضل بعد الموجة) =====
  const ho: any = (hoRows || [])[0] || null;
  let accessItems: any[] = [];
  if (ho) {
    const { data: it } = await supabase.from("handoff_items")
      .select("id,label,done,done_by,done_at").eq("handoff_id", ho.id).order("id");
    accessItems = (it || []).map((x: any) => ({ id: x.id, label: x.label, done: !!x.done, done_by: pMap.get(x.done_by || "") || null, done_at: x.done_at || null }));
  }
  const handoff = ho ? { id: ho.id, status: ho.status || "pending", note: ho.note || "", assignee: pMap.get(ho.assignee_id || "") || "", by: pMap.get(ho.created_by || "") || "", at: String(ho.created_at || "").replace("T", " ").slice(0, 16) } : null;

  const docsMissing = !!docsRes.error;
  const docs = await Promise.all((docsRes.data || []).map(async (d: any) => ({ id: d.id, url: await receiptSignedUrl(supabase, d.url), name: d.name || tr("docFallback"), at: String(d.created_at || "").slice(0, 10) })));

  const fuAll = (fuRows || []).map((x: any) => ({ id: x.id, due_at: x.due_at, note: x.note || "", done: !!x.done }));
  const fuOpen = fuAll.find((x: any) => !x.done) || null;

  // ===== refund: يعتمد على canFinance (يفضل بعد الموجة) =====
  let refund: any = null;
  let refundTableMissing = false;
  if (canFinance) {
    const { data: rf, error: rfErr } = await supabase.from("refunds").select("id,amount,currency,reason,shot_url,status,created_at").eq("customer_id", params.id).order("created_at", { ascending: false }).limit(1);
    if (rfErr) refundTableMissing = true; else refund = (rf || [])[0] || null;
    if (refund?.shot_url) refund = { ...refund, shot_url: await receiptSignedUrl(supabase, refund.shot_url) };
  }

  const templates = tplRows || [];
  const waCtx = { name: (c.name as string) || "", phone1: (c.phone1 as string) || "", diploma: enrolls[0]?.diploma || "", batch: enrolls[0]?.batch || "", remaining: "" };

  let addons: any[] = []; let addonsMissing = false;
  if (adRes.error) addonsMissing = true; else addons = await Promise.all((adRes.data || []).map(async (a: any) => ({ id: a.id, type: a.type, name: a.name, amount: Number(a.amount) || 0, free: !!a.free, note: a.note || "", paid: !!a.paid, shot_url: a.shot_url ? await receiptSignedUrl(supabase, a.shot_url) : "" })));
  const accredList = (accredRows || []).map((x: any) => x.name);
  const projList = (projRows || []).map((x: any) => x.name);

  const st = STAGE[c.stage as string] || STAGE.new;
  const ini = (n: string) => { const p = (n || "?").trim().split(/\s+/); return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2); };

  return (
    <>
      <Link href="/customers" className="drawer-scrim" aria-label={tr("close")} />
      <aside className="drawer-panel">
        <div className="dr-h">
          <div className="av">{ini(c.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{c.name}</h2>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="stg" style={{ background: st.color + "1a", color: st.color }}>{tr(st.labelKey)}</span>
              {c.stage === "onhold" && (c as any).onhold_reason && (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>⏸️ {(c as any).onhold_reason}</span>
              )}
              <CopyNumbers phones={[c.phone1 as string, c.phone2 as string]} />
            </div>
          </div>
          <Link href="/customers" className="dr-x" aria-label={tr("close")}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
          </Link>
        </div>
        <div className="dr-b" style={{ display: "flex", flexDirection: "column" }}>
          <CustomerDrawer
            user={user} c={c} specs={specs || []}
            enrolls={enrolls} dipOpts={dipOpts} batchOpts={batchOpts} addons={addons}
            accredList={accredList} projList={projList} libNames={(libOpts || []).map((l: any) => l.name)}
            handoff={handoff} accessItems={accessItems} accOpts={accOpts || []} libOpts={(libOpts || []).map((l: any) => ({ id: l.id, name: l.name }))}
            fuOpen={fuOpen} fuHistory={(fuAll || []).filter((x: any) => x.done).slice(0, 5)}
            finEnrollments={finEnrollments}
            refund={refund} refundTableMissing={refundTableMissing}
            canFinance={canFinance} canMessage={canMessage}
            docs={docs} docsMissing={docsMissing}
            waCtx={waCtx} templates={templates as any}
            tasks={tasks} notes={notes}
            tickets={tickets || []} auditRows={auditRows || []} pMap={pMap} AUDIT_KEYS={AUDIT_KEYS} TK={TK}
          />
        </div>
      </aside>
    </>
  );
}
