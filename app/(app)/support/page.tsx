import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatusMover from "./StatusMover";

export const dynamic = "force-dynamic";

const STATUSES = [
  { key: "open", label: "مفتوحة", color: "#2F6BFF" },
  { key: "progress", label: "قيد المعالجة", color: "#E6A700" },
  { key: "resolved", label: "محلولة", color: "#18A957" },
  { key: "closed", label: "مغلقة", color: "#94A2BB" },
];

const PRIO: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "عالية", color: "#E0483B", bg: "#FDECEA" },
  medium: { label: "متوسطة", color: "#B8860B", bg: "#FEF6E0" },
  low: { label: "منخفضة", color: "#5B6B85", bg: "#EEF1F6" },
  normal: { label: "عادية", color: "#5B6B85", bg: "#EEF1F6" },
};

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  customer_id: string | null;
  assignee_id: string | null;
};

export default async function Support() {
  const supabase = createClient();
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id,title,status,priority,customer_id,assignee_id,created_at")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(500);
  const { data: custs } = await supabase.from("customers").select("id,name");
  const { data: profs } = await supabase.from("profiles").select("id,full_name");

  const cName = new Map((custs || []).map((c) => [c.id, c.name]));
  const pName = new Map((profs || []).map((p) => [p.id, p.full_name]));
  const all = (tickets || []) as Ticket[];
  const byStatus = (k: string) => all.filter((t) => (t.status || "open") === k);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold">الدعم</h1>
        <Link
          href="/support/new"
          className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-brand-dark"
        >
          + تذكرة جديدة
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {STATUSES.map((s) => {
          const items = byStatus(s.key);
          return (
            <div
              key={s.key}
              className="shrink-0 w-72 bg-brand-soft/40 rounded-xl border border-line"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-line">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </div>
                <span className="text-xs bg-white border border-line rounded-full px-2 py-0.5 text-muted">
                  {items.length}
                </span>
              </div>

              <div className="p-2 space-y-2 min-h-[60px] max-h-[70vh] overflow-y-auto">
                {items.map((t) => {
                  const pr = PRIO[t.priority] || PRIO.normal;
                  return (
                    <div key={t.id} className="bg-white rounded-lg border border-line p-2.5">
                      <Link
                        href={`/support/${t.id}`}
                        className="font-bold text-sm text-brand hover:underline block"
                      >
                        {t.title}
                      </Link>
                      <div className="text-xs text-muted mt-0.5">
                        {cName.get(t.customer_id || "") || "—"}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span
                          className="text-[11px] rounded-full px-2 py-0.5 font-bold"
                          style={{ color: pr.color, background: pr.bg }}
                        >
                          {pr.label}
                        </span>
                        <span className="text-[11px] text-muted">
                          {pName.get(t.assignee_id || "") || "—"}
                        </span>
                      </div>
                      <div className="mt-2">
                        <StatusMover id={t.id} current={t.status || "open"} />
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="text-xs text-muted text-center py-3">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
