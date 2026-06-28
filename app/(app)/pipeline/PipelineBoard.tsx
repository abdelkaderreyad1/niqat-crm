"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Cust = {
  id: string;
  name: string;
  company: string;
  phone1: string;
  stage: string;
  ownerId: string;
  ownerName: string;
};

// DB enum stages + prototype colors
const STAGES = [
  { key: "new", label: "جديد", color: "#2F6BFF" },
  { key: "contacted", label: "تم التواصل", color: "#0FA3A3" },
  { key: "interested", label: "مهتم", color: "#7B61FF" },
  { key: "negotiation", label: "تفاوض", color: "#F08A24" },
  { key: "enrolled", label: "مشترك", color: "#18A957" },
  { key: "onhold", label: "معلّق", color: "#E6A700" },
  { key: "lost", label: "خسارة", color: "#94A2BB" },
];

const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
function avColor(id: string) {
  let h = 0;
  for (const ch of id || "") h += ch.charCodeAt(0);
  return AV[h % AV.length];
}
function initials(name: string) {
  const p = (name || "?").trim().split(/\s+/);
  return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2);
}

export default function PipelineBoard({ initial }: { initial: Cust[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [custs, setCusts] = useState<Cust[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function drop(stage: string) {
    const id = dragId;
    setOverCol(null);
    setDragId(null);
    if (!id) return;
    const c = custs.find((x) => x.id === id);
    if (!c || c.stage === stage) return;
    const prev = custs;
    setCusts((list) => list.map((x) => (x.id === id ? { ...x, stage } : x)));
    const { error } = await supabase.from("customers").update({ stage }).eq("id", id);
    if (error) {
      setCusts(prev);
      alert("تعذّر نقل العميل: " + error.message);
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>المراحل</h1>
          <p>{custs.length} عميل — اسحب العميل بين المراحل</p>
        </div>
      </div>

      <div className="pipe">
        {STAGES.map((s) => {
          const items = custs.filter((c) => (c.stage || "new") === s.key);
          return (
            <div
              key={s.key}
              className={"col" + (overCol === s.key ? " drag" : "")}
              onDragOver={(e) => {
                e.preventDefault();
                if (overCol !== s.key) setOverCol(s.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(s.key);
              }}
            >
              <div className="col-h">
                <span className="nm">
                  <span className="dot" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="ct">{items.length}</span>
              </div>
              <div className="col-b enter">
                {items.map((c) => (
                  <div
                    key={c.id}
                    className={"pc" + (dragId === c.id ? " ghost" : "")}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <div className="pn">{c.name}</div>
                    <div className="pm">
                      {c.company && <span>{c.company}</span>}
                      {c.phone1 && (
                        <span className="num" dir="ltr">
                          {c.phone1}
                        </span>
                      )}
                      {!c.company && !c.phone1 && <span>—</span>}
                    </div>
                    <div className="pf">
                      <span className="who-mini">
                        <span className="av-xs" style={{ background: avColor(c.ownerId) }}>
                          {initials(c.ownerName || "؟")}
                        </span>
                        {c.ownerName || "غير معيّن"}
                      </span>
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
