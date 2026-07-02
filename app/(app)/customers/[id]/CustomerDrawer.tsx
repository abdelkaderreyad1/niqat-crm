"use client";
import { useRef } from "react";
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
  canFinance: boolean; canMessage: boolean;
  docs: any[]; docsMissing: boolean;
  waCtx: any; templates: any[];
  tasks: any[]; notes: any[];
  tickets: any[]; auditRows: any[]; pMap: any; AUDIT_LABELS: any; TK: any;
}) {
  const editRef = useRef<CustomerEditHandle>(null);

  return (
    <DrawerTabs
      basic={<div className="px-5 py-5">
        <CustomerEdit ref={editRef} customer={props.c as any} specialties={props.specs || []} />
      </div>}
      sales={<>
        <ServicesPanel customerId={props.c.id} meId={props.user?.id || ""}
          enrolls={props.enrolls} dipOpts={props.dipOpts} batchOpts={props.batchOpts}
          addons={props.addons} accreditations={props.accredList}
          projects={props.projList} libraries={props.libNames} canFinance={props.canFinance} />

        <AccessPanel customerId={props.c.id} handoff={props.handoff} items={props.accessItems}
          accessOptions={[...(props.accOpts || []), ...props.enrolls.map((e: any, i: number) => ({ id: "dip-" + i, label: "تفعيل: " + e.diploma }))]}
          libraries={props.libOpts} meId={props.user?.id || ""} meName="" />

        <FollowUpPanel customerId={props.c.id} meId={props.user?.id || ""} open={props.fuOpen} history={props.fuHistory} />

        {props.canFinance && <FinancePanel enrollments={props.finEnrollments} customerId={props.c.id} meId={props.user?.id || ""} />}

        {props.canFinance && <RefundPanel customerId={props.c.id} refund={props.refund} meId={props.user?.id || ""} tableMissing={props.refundTableMissing} />}
      </>}
      docs={<>
        <DocsPanel customerId={props.c.id} initial={props.docs} tableMissing={props.docsMissing} />

        {props.canMessage && <WhatsAppPanel customerId={props.c.id} meId={props.user?.id || ""} ctx={props.waCtx} templates={props.templates as any} />}

        <CustomerActivity customerId={props.c.id} meId={props.user?.id || ""} initialTasks={props.tasks} initialNotes={props.notes} />

        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="sec-t" style={{ margin: 0 }}>تذاكر الدعم</div>
            <a href={`/support/new?customer=${props.c.id}`} className="btn" style={{ height: 32, padding: "0 12px", fontSize: 13 }}>+ تذكرة</a>
          </div>
          {(!props.tickets || props.tickets.length === 0) ? (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>لا توجد تذاكر.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {(props.tickets || []).map((t: any) => {
                const ts = props.TK[t.status] || props.TK.open;
                return (
                  <a key={t.id} href={`/support/${t.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", textDecoration: "none" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink)" }}>{t.title}</span>
                    <span className="stg" style={{ background: ts.color + "1a", color: ts.color }}>{ts.label}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="sec-t">سجل العميل (Timeline)</div>
          {(!props.auditRows || props.auditRows.length === 0) ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>لا يوجد سجل.</div>
          ) : (props.auditRows || []).map((a: any, idx: number) => (
            <div key={idx} className="comm">
              <div className="ci" style={{ background: "#eef2f8", color: "var(--muted)" }}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{props.AUDIT_LABELS[a.action] || a.action}{a.detail ? " — " + a.detail : ""}</div>
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
