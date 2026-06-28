"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  customerName: string;
  assigneeId: string;
  assigneeName: string;
  date: string;
};

const STATUSES = [
  { key: "open", label: "مفتوحة", color: "#2F6BFF" },
  { key: "progress", label: "قيد المعالجة", color: "#E6A700" },
  { key: "resolved", label: "محلولة", color: "#18A957" },
  { key: "closed", label: "مغلقة", color: "#94A2BB" },
];

const PRC: Record<string, string> = {
  high: "#E0483B",
  medium: "#E6A700",
  low: "#0FA3A3",
  normal: "#94A2BB",
};

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

export default function SupportBoard({ initial }: { initial: Ticket[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function drop(status: string) {
    const id = dragId;
    setOverCol(null);
    setDragId(null);
    if (!id) return;
    const tk = tickets.find((t) => t.id === id);
    if (!tk || tk.status === status) return;
    const prev = tickets;
    setTickets((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) {
      setTickets(prev);
      alert("تعذّر نقل التذكرة: " + error.message);
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>الدعم</h1>
          <p>{tickets.length} تذكرة — اسحب التذكرة بين الأعمدة</p>
        </div>
        <Link
          href="/support/new"
          className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-brand-dark shrink-0"
        >
          + تذكرة جديدة
        </Link>
      </div>

      <div className="pipe">
        {STATUSES.map((s) => {
          const items = tickets.filter((t) => (t.status || "open") === s.key);
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
                {items.map((t) => {
                  const pc = PRC[t.priority] || PRC.normal;
                  return (
                    <div
                      key={t.id}
                      className={"tk" + (dragId === t.id ? " ghost" : "")}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      onClick={() => router.push(`/support/${t.id}`)}
                    >
                      <div className="th">
                        <span className="pr" style={{ background: pc }} />
                        <span className="tt">{t.title}</span>
                      </div>
                      <div className="tm">
                        <span>{t.customerName}</span>
                        <span>•</span>
                        <span className="num">{t.date}</span>
                        <span>•</span>
                        <span className="who-mini">
                          <span
                            className="av-xs"
                            style={{
                              background: avColor(t.assigneeId),
                              width: 18,
                              height: 18,
                              fontSize: 9,
                            }}
                          >
                            {initials(t.assigneeName)}
                          </span>
                          {t.assigneeName}
                        </span>
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
