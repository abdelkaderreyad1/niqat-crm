"use client";
import { useState, useRef } from "react";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Cust = {
  id: string;
  name: string;
  diploma: string;
  stage: string;
  ownerId: string;
  ownerName: string;
  createdAt?: string;
};

// مراحل قاعدة البيانات (stage_t) + ألوان وتسميات البروتوتايب
const STAGES = [
  { key: "new", label: "جديد", color: "#2F6BFF" },
  { key: "contacted", label: "تم التواصل", color: "#0FA3A3" },
  { key: "interested", label: "مهتم", color: "#7B61FF" },
  { key: "quote", label: "عرض سعر مُرسل", color: "#E6A700" },
  { key: "negotiation", label: "تفاوض", color: "#F08A24" },
  { key: "enrolled", label: "مسجّل / دفع", color: "#18A957" },
  { key: "lost", label: "مؤجل / مرفوض", color: "#94A2BB" },
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
  const tr = useT();
  const router = useRouter();
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const supabase = createClient();
  const [custs, setCusts] = useState<Cust[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [colSort, setColSort] = useState<Record<string, string>>({});

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

  async function archive(id: string) {
    const prev = custs;
    setCusts((l) => l.filter((x) => x.id !== id));
    const { error } = await supabase.from("customers").update({ board_done: true }).eq("id", id);
    if (error) {
      setCusts(prev);
      alert("تعذّر الأرشفة: " + error.message);
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("pipeline")}</h1>
          <p>{custs.length} عميل — اسحب العميل بين المراحل</p>
        </div>
        <Link className="btn" href="/customers/new">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          إضافة عميل
        </Link>
      </div>

      <div className="pipe">
        {STAGES.map((s) => {
          const sortKey = colSort[s.key] || "";
          let items = custs.filter((c) => (c.stage || "new") === s.key);
          if (sortKey === "name") items = [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
          else if (sortKey === "new") items = [...items].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
          return (
            <div
              key={s.key}
              className={"col" + (overCol === s.key ? " drag" : "")}
              data-stage={s.key}
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <select className="sortsel" value={colSort[s.key] || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setColSort((q) => ({ ...q, [s.key]: e.target.value }))}>
                    <option value="">ترتيب</option>
                    <option value="name">بالاسم</option>
                    <option value="new">الأحدث</option>
                  </select>
                  <span className="ct">{items.length}</span>
                </div>
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
                    onMouseDown={(e) => { downRef.current = { x: e.clientX, y: e.clientY }; }}
                    onMouseUp={(e) => {
                      const d = downRef.current; downRef.current = null;
                      if (!d) return;
                      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) router.push(`/customers/${c.id}`);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <button
                      className="cardx"
                      title="أرشفة الكارت"
                      onMouseDown={(ev) => ev.stopPropagation()}
                      onClick={(ev) => { ev.stopPropagation(); archive(c.id); }}
                    >
                      <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>
                    </button>
                    <div className="pn">{c.name}</div>
                    <div className="pm">{c.diploma || "—"}</div>
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
                  <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "10px 0" }}>—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
