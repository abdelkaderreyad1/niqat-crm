import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerEdit from "./CustomerEdit";
import FinancePanel from "./FinancePanel";
import CustomerActivity from "./CustomerActivity";
import AccessPanel from "./AccessPanel";
import FollowUpPanel from "./FollowUpPanel";
import RefundPanel from "./RefundPanel";

export const dynamic = "force-dynamic";

const STAGE: Record<string, { label: string; color: string }> = {
  new: { label: "جديد", color: "#2F6BFF" }, contacted: { label: "تم التواصل", color: "#0FA3A3" },
  interested: { label: "مهتم", color: "#7B61FF" }, negotiation: { label: "تفاوض", color: "#F08A24" },
  enrolled: { label: "مسجّل / دفع", color: "#18A957" }, onhold: { label: "معلّق", color: "#E6A700" },
  lost: { label: "مؤجل / مرفوض", color: "#94A2BB" },
};
const ini = (n: string) => { const p = (n || "?").trim().split(/\s+/); return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2); };

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meProf } = await supabase.from("profiles").select("can_see_finance").eq("id", user?.id || "").maybeSingle();
  const canFinance = !!meProf?.can_see_finance;

  const { data: c } = await supabase.from("customers")
    .select("id,name,phone1,phone2,email,company,residency,grad_year,stage,specialty_id,lms_status,source,affiliate_code,created_at")
    .eq("id", params.id).maybeSingle();
  if (!c) notFound();

  const { data: specs } = await supabase.from("specialties").select("id,name_ar").order("name_ar");

  // اشتراكات (دبلومة + باتش) — للكل
  const { data: enrRows } = await supabase.from("enrollments")
    .select("id,status, diplomas(name_ar), batches(code)").eq("customer_id", params.id);
  const enrolls = (enrRows || []).map((e: any) => ({
    id: e.id, diploma: e.diplomas?.name_ar || "—", batch: e.batches?.code || "—", status: e.status || "",
  }));

  // مهام + ملاحظات + سجل
  const { data: profs } = await supabase.from("profiles").select("id,full_name");
  const pMap = new Map((profs || []).map((p) => [p.id, p.full_name]));
  const { data: taskRows } = await supabase.from("tasks").select("id,title,due_at,done").eq("customer_id", params.id).order("created_at", { ascending: false });
  const tasks = (taskRows || []).map((k) => ({ id: k.id as string, title: (k.title as string) || "", due: k.due_at ? String(k.due_at).slice(0, 10) : "", done: !!k.done }));
  const { data: commRows } = await supabase.from("communications").select("id,body,by_id,at").eq("customer_id", params.id).order("at", { ascending: false }).limit(50);
  const notes = (commRows || []).map((n: any) => ({ id: n.id as string, body: n.body || "", by: pMap.get(n.by_id || "") || "—", at: String(n.at || "").replace("T", " ").slice(0, 16) }));
  const { data: auditRows } = await supabase.from("audit_log").select("action,detail,actor_id,at").eq("customer_id", params.id).order("at", { ascending: false }).limit(30);

  // تذاكر الدعم
  const { data: tickets } = await supabase.from("tickets").select("id,title,status").eq("customer_id", params.id).eq("archived", false).order("created_at", { ascending: false });
  const TK: Record<string, { label: string; color: string }> = {
    open: { label: "مفتوحة", color: "#2F6BFF" }, progress: { label: "قيد المعالجة", color: "#E6A700" },
    resolved: { label: "محلولة", color: "#18A957" }, closed: { label: "مغلقة", color: "#94A2BB" },
  };

  // المالية (محمية)
  let finEnrollments: any[] = [];
  if (canFinance && enrolls.length) {
    const { data: enrs } = await supabase.from("enrollments").select("id,diploma_id,status,free,free_reason").eq("customer_id", params.id);
    const ids = (enrs || []).map((e) => e.id);
    if (ids.length) {
      const [{ data: fin }, { data: insts }, { data: dips }] = await Promise.all([
        supabase.from("enrollment_finance").select("enrollment_id,agreed_amount,currency").in("enrollment_id", ids),
        supabase.from("installments").select("id,enrollment_id,amount,currency,due_date,paid_at,status").in("enrollment_id", ids).order("due_date", { ascending: true }),
        supabase.from("diplomas").select("id,name_ar"),
      ]);
      const dName = new Map((dips || []).map((d) => [d.id, d.name_ar]));
      const finMap = new Map((fin || []).map((f) => [f.enrollment_id, f]));
      finEnrollments = (enrs || []).map((e) => {
        const f: any = finMap.get(e.id);
        return {
          id: e.id, diploma: dName.get(e.diploma_id || "") || "—", status: e.status || "",
          free: !!(e as any).free, freeReason: (e as any).free_reason || "",
          agreed: Number(f?.agreed_amount) || 0, currency: f?.currency || "EGP",
          installments: (insts || []).filter((i) => i.enrollment_id === e.id).map((i) => ({
            id: i.id, amount: Number(i.amount) || 0, currency: i.currency || "EGP",
            due: i.due_date ? String(i.due_date).slice(0, 10) : "", status: i.status || "pending", paidAt: i.paid_at || null,
          })),
        };
      });
    }
  }

  // الأكسس / handoff
  const { data: hoRows } = await supabase.from("handoffs")
    .select("id,status,note,assignee_id,created_by,created_at")
    .eq("customer_id", params.id).order("created_at", { ascending: false }).limit(1);
  const ho: any = (hoRows || [])[0] || null;
  let accessItems: any[] = [];
  if (ho) {
    const { data: it } = await supabase.from("handoff_items")
      .select("id,label,done,done_by,done_at").eq("handoff_id", ho.id).order("id");
    accessItems = (it || []).map((x: any) => ({
      id: x.id, label: x.label, done: !!x.done,
      done_by: pMap.get(x.done_by || "") || null, done_at: x.done_at || null,
    }));
  }
  const handoff = ho ? {
    id: ho.id, status: ho.status || "pending", note: ho.note || "",
    assignee: pMap.get(ho.assignee_id || "") || "", by: pMap.get(ho.created_by || "") || "",
    at: String(ho.created_at || "").replace("T", " ").slice(0, 16),
  } : null;
  const { data: accOpts } = await supabase.from("access_options").select("id,label").order("label");

  // متابعات
  const { data: fuRows } = await supabase.from("follow_ups")
    .select("id,due_at,note,done").eq("customer_id", params.id).order("due_at", { ascending: false });
  const fuAll = (fuRows || []).map((x: any) => ({ id: x.id, due_at: x.due_at, note: x.note || "", done: !!x.done }));
  const fuOpen = fuAll.find((x) => !x.done) || null;
  const fuHistory = fuAll.filter((x) => x.done).slice(0, 5);

  // الاسترداد (محصّن لو الجدول لسه مش متعمل)
  let refund: any = null;
  let refundTableMissing = false;
  if (canFinance) {
    const { data: rf, error: rfErr } = await supabase.from("refunds")
      .select("id,amount,currency,reason,shot_url,status,created_at")
      .eq("customer_id", params.id).order("created_at", { ascending: false }).limit(1);
    if (rfErr) refundTableMissing = true;
    else refund = (rf || [])[0] || null;
  }

  const st = STAGE[c.stage as string] || STAGE.new;

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="page-h">
        <Link href="/customers" style={{ color: "var(--muted)", fontSize: 13 }}>← رجوع للعملاء</Link>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 14 }}>
        <div className="dr-h">
          <div className="av">{ini(c.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{c.name}</h2>
            <div style={{ marginTop: 4 }}>
              <span className="stg" style={{ background: st.color + "1a", color: st.color }}>{st.label}</span>
            </div>
          </div>
        </div>
      </div>

      <CustomerEdit customer={c as any} specialties={specs || []} />

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="sec-t">الاشتراكات (الدبلومة / الباتش)</div>
        {enrolls.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد اشتراكات.</div>
        ) : enrolls.map((e) => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
            <b style={{ color: "var(--ink)" }}>{e.diploma}</b>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>باتش: <span className="num">{e.batch}</span></span>
          </div>
        ))}
      </div>

      <AccessPanel customerId={c.id as string} handoff={handoff} items={accessItems}
        accessOptions={accOpts || []} meId={user?.id || ""} meName="" />

      <FollowUpPanel customerId={c.id as string} meId={user?.id || ""} open={fuOpen} history={fuHistory} />

      {canFinance && <FinancePanel enrollments={finEnrollments} />}

      {canFinance && <RefundPanel customerId={c.id as string} refund={refund} meId={user?.id || ""} tableMissing={refundTableMissing} />}

      <CustomerActivity customerId={c.id as string} meId={user?.id || ""} initialTasks={tasks} initialNotes={notes} />

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="sec-t" style={{ margin: 0 }}>تذاكر الدعم</div>
          <Link href={`/support/new?customer=${c.id}`} className="btn" style={{ height: 32, padding: "0 12px", fontSize: 13 }}>+ تذكرة</Link>
        </div>
        {(!tickets || tickets.length === 0) ? (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>لا توجد تذاكر.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {(tickets || []).map((t) => {
              const ts = TK[t.status as string] || TK.open;
              return (
                <Link key={t.id as string} href={`/support/${t.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                  <span style={{ fontWeight: 700, color: "var(--ink)" }}>{t.title}</span>
                  <span className="stg" style={{ background: ts.color + "1a", color: ts.color }}>{ts.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="sec-t">سجل التعديلات</div>
        {(!auditRows || auditRows.length === 0) ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>لا يوجد سجل.</div>
        ) : (auditRows || []).map((a: any, idx) => (
          <div key={idx} className="comm">
            <div className="ci" style={{ background: "#eef2f8", color: "var(--muted)" }}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{a.action}{a.detail ? " — " + a.detail : ""}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                <b>{pMap.get(a.actor_id || "") || "—"}</b> • <span className="num">{String(a.at || "").replace("T", " ").slice(0, 16)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
