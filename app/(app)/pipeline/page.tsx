import { createClient } from "@/lib/supabase/server";
import StageMover from "./StageMover";

export const dynamic = "force-dynamic";

const STAGES: { key: string; label: string; dot: string }[] = [
  { key: "new", label: "جديد", dot: "bg-slate-400" },
  { key: "contacted", label: "تم التواصل", dot: "bg-sky-400" },
  { key: "interested", label: "مهتم", dot: "bg-amber-400" },
  { key: "negotiation", label: "تفاوض", dot: "bg-violet-400" },
  { key: "enrolled", label: "مشترك", dot: "bg-emerald-500" },
  { key: "onhold", label: "معلّق", dot: "bg-gray-400" },
  { key: "lost", label: "خسارة", dot: "bg-rose-400" },
];

type Cust = {
  id: string;
  name: string;
  company: string | null;
  phone1: string | null;
  stage: string;
};

export default async function Pipeline() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("customers")
    .select("id,name,company,phone1,stage")
    .eq("deleted", false)
    .order("created_at", { ascending: false })
    .limit(500);

  const all = (rows || []) as Cust[];
  const byStage = (k: string) => all.filter((c) => (c.stage || "new") === k);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold">المراحل (Pipeline)</h1>
        <span className="text-sm text-muted">{all.length} عميل</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {STAGES.map((s) => {
          const items = byStage(s.key);
          return (
            <div
              key={s.key}
              className="shrink-0 w-64 bg-brand-soft/40 rounded-xl border border-line"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-line">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot}`} />
                  {s.label}
                </div>
                <span className="text-xs bg-white border border-line rounded-full px-2 py-0.5 text-muted">
                  {items.length}
                </span>
              </div>

              <div className="p-2 space-y-2 min-h-[60px] max-h-[70vh] overflow-y-auto">
                {items.map((c) => (
                  <div key={c.id} className="bg-white rounded-lg border border-line p-2.5">
                    <div className="font-bold text-sm">{c.name}</div>
                    <div className="text-xs text-muted mt-0.5">{c.company || "—"}</div>
                    {c.phone1 && (
                      <div className="text-xs text-muted mt-0.5" dir="ltr">
                        {c.phone1}
                      </div>
                    )}
                    <div className="mt-2">
                      <StageMover id={c.id} current={c.stage || "new"} />
                    </div>
                  </div>
                ))}
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
