"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import { revalidateCustomers } from "../actions";
import DrawerTabs from "./DrawerTabs";
import CustomerEdit, { type CustomerEditHandle } from "./CustomerEdit";
import ServicesPanel from "./ServicesPanel";
import FinancePanel from "./FinancePanel";
import CustomerActivity from "./CustomerActivity";
import DocsPanel from "./DocsPanel";
import AccessPanel from "./AccessPanel";
import FollowUpPanel from "./FollowUpPanel";
import RefundPanel from "./RefundPanel";
import WhatsAppPanel from "./WhatsAppPanel";

export default function CustomerDrawer(props: {
  user: any; c: any; specs: any[];
  enrolls: any[]; dipOpts: any[]; batchOpts: any[]; addons: any[];
  accredList: string[]; projList: string[]; libNames: string[];
  handoff: any; accessItems: any[]; accOpts: any[]; libOpts: any[];
  fuOpen: any; fuHistory: any[];
  finEnrollments: any[];
  refund: any; refundTableMissing: boolean;
  canFinance: boolean; canMessage: boolean; canManageBatches: boolean;
  docs: any[]; docsMissing: boolean;
  waCtx: any; templates: any[];
  tasks: any[]; notes: any[];
  tickets: any[]; auditRows: any[]; pMap: any; AUDIT_KEYS: any; TK: any;
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const editRef = useRef<CustomerEditHandle>(null);
  const [tab, setTab] = useState<"basic" | "sales" | "docs">("basic");
  const [archiving, setArchiving] = useState(false);

  async function archiveCustomer() {
    if (!confirm(tr("archiveCustomerQ"))) return;
    setArchiving(true);
    const { error } = await supabase.from("customers").update({ archived: true }).eq("id", props.c.id);
    if (error) { setArchiving(false); alert(tr("archiveFailed") + error.message); return; }
    await revalidateCustomers();
    toast(tr("customerArchived"));
    router.push("/customers");
  }

  function goTo(t: "basic" | "sales" | "docs", panelId: string) {
    setTab(t);
    setTimeout(() => {
      document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  const qbtn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 13px",
    borderRadius: 9, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", cursor: "pointer",
    border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", flexShrink: 0,
  };
  const qbtnWa: React.CSSProperties = { ...qbtn, background: "var(--wa)", color: "#fff", borderColor: "var(--wa)" };

  const quickBar = (
    <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "linear-gradient(0deg,var(--muted-soft),transparent)", overflowX: "auto" }}>
      {props.canMessage && (
        <button type="button" style={qbtnWa} onClick={() => goTo("docs", "panel-whatsapp")}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.3.6-.6.8-.8 1-.1.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.8.8 2.1 1 .3.1.5.2.6.3.1.2.1.7-.1 1.3z" /></svg>
          {tr("qaWhatsapp")}
        </button>
      )}
      <button type="button" style={qbtn} onClick={() => goTo("sales", "panel-followup")}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" /></svg>
        {tr("qaFollow")}
      </button>
      <button type="button" style={qbtn} onClick={() => goTo("sales", "panel-access")}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        {tr("qaHandoff")}
      </button>
      <button type="button" style={qbtn} onClick={() => goTo("sales", "panel-services")}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
        {tr("qaService")}
      </button>
    </div>
  );

  return (
    <DrawerTabs
      tab={tab} onTab={setTab} quickBar={quickBar}
      basic={<div className="px-5 py-5">
        <CustomerEdit ref={editRef} customer={props.c as any} specialties={props.specs || []} />
        {props.canManageBatches && !(props.c as any).archived && (
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>{tr("dangerZone")}</div>
            <button onClick={archiveCustomer} disabled={archiving} className="btn danger" style={{ width: "100%" }}>
              {archiving ? "..." : "🗄️ " + tr("archiveCustomerBtn")}
            </button>
          </div>
        )}
      </div>}
      sales={<>
        <div id="panel-services">
          <ServicesPanel customerId={props.c.id} meId={props.user?.id || ""}
            enrolls={props.enrolls} dipOpts={props.dipOpts} batchOpts={props.batchOpts}
            addons={props.addons} accreditations={props.accredList}
            projects={props.projList} libraries={props.libNames} canFinance={props.canFinance} />
        </div>

        <div id="panel-access">
          <AccessPanel customerId={props.c.id} handoff={props.handoff} items={props.accessItems}
            accessOptions={[
              ...(props.accOpts || []),
              ...props.enrolls.map((e: any, i: number) => ({ id: "dip-" + i, label: tr("accActivateDiploma") + ": " + e.diploma })),
              ...(props.addons || []).map((a: any, i: number) => ({
                id: "addon-" + i,
                label: (a.type === "accred" ? tr("accIssueAccred") + ": " : a.type === "project" ? tr("accPrepProject") + ": " : a.type === "library" ? tr("accOpenLibrary") + ": " : tr("accActivate") + ": ") + a.name,
              })),
            ]}
            libraries={props.libOpts} meId={props.user?.id || ""} meName="" />
        </div>

        <div id="panel-followup">
          <FollowUpPanel customerId={props.c.id} meId={props.user?.id || ""} open={props.fuOpen} history={props.fuHistory} />
        </div>

        {props.canFinance && <FinancePanel enrollments={props.finEnrollments} customerId={props.c.id} meId={props.user?.id || ""} batchOpts={props.batchOpts} addons={(props.addons || []).filter((a: any) => a.paid)} handedOff={!!(props.c as any).handed_off} />}

        {props.canFinance && <RefundPanel customerId={props.c.id} refund={props.refund} meId={props.user?.id || ""} tableMissing={props.refundTableMissing} accessItems={props.accessItems} />}
      </>}
      docs={<>
        <div id="panel-whatsapp">
          {props.canMessage && <WhatsAppPanel customerId={props.c.id} meId={props.user?.id || ""} ctx={props.waCtx} templates={props.templates as any} />}
        </div>

        <CustomerActivity customerId={props.c.id} meId={props.user?.id || ""} initialTasks={props.tasks} initialNotes={props.notes} />

        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="sec-t" style={{ margin: 0 }}>{tr("supportTickets")}</div>
            <a href={`/support/new?customer=${props.c.id}`} className="btn" style={{ height: 32, padding: "0 12px", fontSize: 13 }}>+ {tr("ticket")}</a>
          </div>
          {(!props.tickets || props.tickets.length === 0) ? (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{tr("noTickets")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {(props.tickets || []).map((t: any) => {
                const ts = props.TK[t.status] || props.TK.open;
                return (
                  <a key={t.id} href={`/support/${t.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", textDecoration: "none" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink)" }}>{t.title}</span>
                    <span className="stg" style={{ background: ts.color + "1a", color: ts.color }}>{tr(ts.labelKey)}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <DocsPanel customerId={props.c.id} initial={props.docs} tableMissing={props.docsMissing} />

        <div className="card" style={{ padding: 18 }}>
          <div className="sec-t">{tr("timeline")}</div>
          {(!props.auditRows || props.auditRows.length === 0) ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noTimeline")}</div>
          ) : (props.auditRows || []).map((a: any, idx: number) => (
            <div key={idx} className="comm">
              <div className="ci" style={{ background: "#eef2f8", color: "var(--muted)" }}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{props.AUDIT_KEYS[a.action] ? tr(props.AUDIT_KEYS[a.action]) : a.action}{a.detail ? " — " + a.detail : ""}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  <b>{props.pMap.get(a.actor_id || "") || "—"}</b> • <span className="num">{String(a.at || "").replace("T", " ").slice(0, 16)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>}
      footer={() => null}
    />
  );
}
