"use client";
import { useState, useRef } from "react";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  customerId: string;
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

export default function SupportBoard({ initial, assignees, subjects, meId }: {
  initial: Ticket[];
  assignees: { id: string; name: string }[];
  subjects: string[];
  meId: string;
}) {
  const tr = useT();
  const router = useRouter();
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [colSort, setColSort] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ id: string; body: string; author: string; at: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  const openTk = tickets.find((t) => t.id === openId) || null;

  async function openTicket(id: string) {
    setOpenId(id);
    setNotes([]);
    setNoteText("");
    const { data } = await supabase
      .from("ticket_notes")
      .select("id,body,created_at,author_id")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false });
    const ids = Array.from(new Set((data || []).map((n: any) => n.author_id).filter(Boolean)));
    const nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      (ps || []).forEach((p: any) => nameMap.set(p.id, p.full_name || ""));
    }
    setNotes((data || []).map((n: any) => ({
      id: n.id, body: n.body, author: nameMap.get(n.author_id) || "—",
      at: String(n.created_at || "").replace("T", " ").slice(0, 16),
    })));
  }

  function patchTk(id: string, patch: Partial<Ticket>) {
    setTickets((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function saveField(id: string, col: string, value: string, patch: Partial<Ticket>) {
    patchTk(id, patch);
    await supabase.from("tickets").update({ [col]: value || null }).eq("id", id);
  }

  async function addNote() {
    const b = noteText.trim();
    if (!b || !openId) return;
    setBusy(true);
    const { data, error } = await supabase.from("ticket_notes")
      .insert({ ticket_id: openId, author_id: meId || null, body: b })
      .select("id,created_at").single();
    setBusy(false);
    if (!error && data) {
      setNotes((ns) => [{ id: data.id, body: b, author: "أنا", at: String(data.created_at || "").replace("T", " ").slice(0, 16) }, ...ns]);
      setNoteText("");
    }
  }

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

  async function archive(id: string) {
    const prev = tickets;
    setTickets((l) => l.filter((t) => t.id !== id));
    const { error } = await supabase.from("tickets").update({ archived: true }).eq("id", id);
    if (error) {
      setTickets(prev);
      alert("تعذّر الأرشفة: " + error.message);
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("support")}</h1>
          <p>{tickets.length} تذكرة — اسحب التذكرة بين الأعمدة</p>
        </div>
        <Link href="/support/new" className="btn">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
          تذكرة جديدة
        </Link>
      </div>

      <div className="pipe">
        {STATUSES.map((s) => {
          const sortKey = colSort[s.key] || "";
          const prOrder: Record<string, number> = { high: 0, medium: 1, normal: 2, low: 2 };
          let items = tickets.filter((t) => (t.status || "open") === s.key);
          if (sortKey === "name") items = [...items].sort((a, b) => (a.title || "").localeCompare(b.title || "", "ar"));
          else if (sortKey === "new") items = [...items].sort((a, b) => String((b as any).date || "").localeCompare(String((a as any).date || "")));
          else if (sortKey === "pr") items = [...items].sort((a, b) => (prOrder[(a as any).priority] ?? 3) - (prOrder[(b as any).priority] ?? 3));
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <select className="sortsel" value={colSort[s.key] || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setColSort((q) => ({ ...q, [s.key]: e.target.value }))}>
                    <option value="">ترتيب</option>
                    <option value="name">بالاسم</option>
                    <option value="new">الأحدث</option>
                    <option value="pr">الأولوية</option>
                  </select>
                  <span className="ct">{items.length}</span>
                </div>
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
                      onMouseDown={(e) => { downRef.current = { x: e.clientX, y: e.clientY }; }}
                      onMouseUp={(e) => {
                        const d = downRef.current; downRef.current = null;
                        if (!d) return;
                        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) openTicket(t.id);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <button className="cardx" title="تم — إخفاء من البورد" onMouseDown={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); archive(t.id); }}>
                        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>
                      </button>
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

      {openTk && (
        <>
          <div className="scrim show" onClick={() => setOpenId(null)} />
          <div className="modal show" role="dialog">
            <div className="modal-h">
              <h3>تعديل التذكرة</h3>
              <button className="x" onClick={() => setOpenId(null)}>✕</button>
            </div>
            <div className="modal-b">
              <div className="fld">
                <label>العميل</label>
                <div className="inp" style={{ background: "#f7f9fc", display: "flex", alignItems: "center" }}>{openTk.customerName || "—"}</div>
              </div>
              <div className="fld">
                <label>الموضوع</label>
                <input className="inp" list="tk_subjlist" value={openTk.title}
                  onChange={(e) => patchTk(openTk.id, { title: e.target.value })}
                  onBlur={(e) => saveField(openTk.id, "title", e.target.value.trim(), { title: e.target.value.trim() })} />
                <datalist id="tk_subjlist">{subjects.map((s, i) => <option key={i} value={s} />)}</datalist>
              </div>
              <div className="frow">
                <div className="fld" style={{ margin: 0 }}>
                  <label>الأولوية</label>
                  <select className="inp" value={openTk.priority} onChange={(e) => saveField(openTk.id, "priority", e.target.value, { priority: e.target.value })}>
                    <option value="high">عالية</option>
                    <option value="medium">متوسطة</option>
                    <option value="low">منخفضة</option>
                  </select>
                </div>
                <div className="fld" style={{ margin: 0 }}>
                  <label>الحالة</label>
                  <select className="inp" value={openTk.status} onChange={(e) => saveField(openTk.id, "status", e.target.value, { status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="fld" style={{ marginTop: 12 }}>
                <label>المكلَّف</label>
                <select className="inp" value={openTk.assigneeId}
                  onChange={(e) => {
                    const nm = assignees.find((a) => a.id === e.target.value)?.name || "—";
                    saveField(openTk.id, "assignee_id", e.target.value, { assigneeId: e.target.value, assigneeName: nm });
                  }}>
                  <option value="">— غير معيّن —</option>
                  {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="sec-t">ملاحظات التذكرة</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input className="inp" placeholder="أضف ملاحظة…" value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
                <button className="btn ghost" type="button" disabled={busy} onClick={addNote}>إرسال</button>
              </div>
              <div>
                {notes.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>—</div>}
                {notes.map((n) => (
                  <div className="comm" key={n.id}>
                    <div className="ci" style={{ background: "#eef2f8", color: "var(--muted)" }}>📝</div>
                    <div>
                      <div className="ct">{n.body}</div>
                      <div className="cm"><b>{n.author}</b> • {n.at}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-f">
              <Link className="btn ghost" href={`/support/${openTk.id}`}>فتح الصفحة الكاملة</Link>
              <button className="btn" style={{ marginInlineStart: "auto" }} onClick={() => { setOpenId(null); router.refresh(); }}>تم</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
