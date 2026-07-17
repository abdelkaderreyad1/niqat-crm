"use client";
import { useState, useRef, useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NewTicketModal from "./NewTicketModal";

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
  { key: "open", labelKey: "openLabel", color: "#2F6BFF" },
  { key: "progress", labelKey: "inProgressLabel", color: "#E6A700" },
  { key: "resolved", labelKey: "resolvedLabel", color: "#18A957" },
  { key: "closed", labelKey: "closedLabel", color: "#94A2BB" },
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
  // مزامنة القائمة بعد router.refresh() (إنشاء تذكرة/تحديث) — تظهر من غير ريفرش كامل
  useEffect(() => { setTickets(initial); }, [initial]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [colSort, setColSort] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
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
      setNotes((ns) => [{ id: data.id, body: b, author: tr("me"), at: String(data.created_at || "").replace("T", " ").slice(0, 16) }, ...ns]);
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
      alert(tr("moveTicketFailed") + error.message);
    }
  }

  async function archive(id: string) {
    const prev = tickets;
    setTickets((l) => l.filter((t) => t.id !== id));
    const { error } = await supabase.from("tickets").update({ archived: true }).eq("id", id);
    if (error) {
      setTickets(prev);
      alert(tr("archiveFailed") + error.message);
    }
  }

  async function archiveColumn(ids: string[]) {
    if (!ids.length) return;
    if (!confirm(`${tr("archiveColumnQ")} (${ids.length})`)) return;
    const idset = new Set(ids);
    const prev = tickets;
    setTickets((l) => l.filter((t) => !idset.has(t.id)));
    const CH = 100;
    for (let i = 0; i < ids.length; i += CH) {
      const { error } = await supabase.from("tickets").update({ archived: true }).in("id", ids.slice(i, i + CH));
      if (error) { setTickets(prev); alert(tr("archiveFailed") + error.message); return; }
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("support")}</h1>
          <p>{tickets.length} {tr("ticketWord")} — {tr("dragTicketHint")}</p>
        </div>
        <button type="button" className="btn" onClick={() => setNewOpen(true)}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
          {tr("newTicket")}
        </button>
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
                  {tr(s.labelKey)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {items.length > 0 && (
                    <button title={tr("archiveColumn")}
                      onClick={(e) => { e.stopPropagation(); archiveColumn(items.map((t) => t.id)); }}
                      style={{ cursor: "pointer", background: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "2px 6px", fontSize: 13, lineHeight: 1, color: "var(--muted)" }}>
                      🗄️
                    </button>
                  )}
                  <select className="sortsel" value={colSort[s.key] || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setColSort((q) => ({ ...q, [s.key]: e.target.value }))}>
                    <option value="">{tr("sortPlaceholder")}</option>
                    <option value="name">{tr("byName")}</option>
                    <option value="new">{tr("newestLabel")}</option>
                    <option value="pr">{tr("byPriority")}</option>
                  </select>
                  <span className="ct">{items.length}</span>
                </div>
              </div>
              <div className="col-b enter">
                {items.map((t) => {
                  const pc = PRC[t.priority] || PRC.normal;
                  const isHigh = t.priority === "high";
                  const prLabel = t.priority === "high" ? tr("priorityHigh") : t.priority === "medium" ? tr("priorityMedium") : tr("priorityLow");
                  const ageMs = (() => { const d = new Date(String(t.date).replace(" ", "T")); return isNaN(d.getTime()) ? 0 : Date.now() - d.getTime(); })();
                  const ageDays = Math.floor(ageMs / 86400000);
                  const ageHrs = Math.floor(ageMs / 3600000);
                  const ageTxt = ageMs <= 0 ? tr("ageJustNow")
                    : ageDays >= 1 ? `${tr("ageSince")} ${ageDays} ${tr("ageDay")}`
                    : ageHrs >= 1 ? `${tr("ageSince")} ${ageHrs} ${tr("ageHour")}`
                    : tr("ageJustNow");
                  const ageLate = ageDays >= 3 && t.status !== "closed";
                  return (
                    <div
                      key={t.id}
                      className={"tk" + (isHigh ? " tk-high" : "") + (dragId === t.id ? " ghost" : "")}
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
                      style={{ cursor: "pointer", borderInlineStart: `4px solid ${pc}` }}
                    >
                      <button className="cardx" title={tr("doneHideBoard")} onMouseDown={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); archive(t.id); }}>
                        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>
                      </button>
                      <div className="th">
                        <span className="pr-pill" style={{ color: pc, background: pc + "1a" }}>{prLabel}</span>
                        <span className="tt">{t.title}</span>
                      </div>
                      {t.body && <div className="tk-body">{t.body}</div>}
                      <div className="tm">
                        <span>{t.customerName}</span>
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
                        <span className={"tk-age" + (ageLate ? " late" : "")} style={{ marginInlineStart: "auto" }}>⏱ {ageTxt}</span>
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
              <h3>{tr("editTicket")}</h3>
              <button className="x" onClick={() => setOpenId(null)}>✕</button>
            </div>
            <div className="modal-b">
              <div className="fld">
                <label>{tr("customer")}</label>
                <div className="inp" style={{ background: "var(--muted-soft)", display: "flex", alignItems: "center" }}>{openTk.customerName || "—"}</div>
              </div>
              <div className="fld">
                <label>{tr("subject")}</label>
                <input className="inp" list="tk_subjlist" value={openTk.title}
                  onChange={(e) => patchTk(openTk.id, { title: e.target.value })}
                  onBlur={(e) => saveField(openTk.id, "title", e.target.value.trim(), { title: e.target.value.trim() })} />
                <datalist id="tk_subjlist">{subjects.map((s, i) => <option key={i} value={s} />)}</datalist>
              </div>
              <div className="frow">
                <div className="fld" style={{ margin: 0 }}>
                  <label>{tr("priority")}</label>
                  <select className="inp" value={openTk.priority} onChange={(e) => saveField(openTk.id, "priority", e.target.value, { priority: e.target.value })}>
                    <option value="high">{tr("priorityHigh")}</option>
                    <option value="medium">{tr("priorityMedium")}</option>
                    <option value="low">{tr("priorityLow")}</option>
                  </select>
                </div>
                <div className="fld" style={{ margin: 0 }}>
                  <label>{tr("status")}</label>
                  <select className="inp" value={openTk.status} onChange={(e) => saveField(openTk.id, "status", e.target.value, { status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{tr(s.labelKey)}</option>)}
                  </select>
                </div>
              </div>
              <div className="fld" style={{ marginTop: 12 }}>
                <label>{tr("assigneeField")}</label>
                <select className="inp" value={openTk.assigneeId}
                  onChange={(e) => {
                    const nm = assignees.find((a) => a.id === e.target.value)?.name || "—";
                    saveField(openTk.id, "assignee_id", e.target.value, { assigneeId: e.target.value, assigneeName: nm });
                  }}>
                  <option value="">{tr("unassignedDash")}</option>
                  {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="sec-t">{tr("ticketNotes")}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input className="inp" placeholder={tr("addNotePh")} value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
                <button className="btn ghost" type="button" disabled={busy} onClick={addNote}>{tr("send")}</button>
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
              <Link className="btn ghost" href={`/support/${openTk.id}`}>{tr("openFullPage")}</Link>
              <button className="btn" style={{ marginInlineStart: "auto" }} onClick={() => { setOpenId(null); router.refresh(); }}>{tr("done")}</button>
            </div>
          </div>
        </>
      )}

      <NewTicketModal open={newOpen} onClose={() => setNewOpen(false)} problems={subjects} />
    </div>
  );
}
