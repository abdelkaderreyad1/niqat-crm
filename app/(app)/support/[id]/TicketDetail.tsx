"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  priority: string;
  customer_id: string | null;
  assignee_id: string | null;
  created_at: string;
};
type Customer = { id: string; name: string; phone1: string | null } | null;
type Prof = { id: string; full_name: string | null; team: string | null };
type Note = { id: string; body: string; created_at: string; author: string };

const STATUSES = [
  { key: "open", label: "مفتوحة" },
  { key: "progress", label: "قيد المعالجة" },
  { key: "resolved", label: "محلولة" },
  { key: "closed", label: "مغلقة" },
];
const PRIOS = [
  { key: "high", label: "عالية" },
  { key: "medium", label: "متوسطة" },
  { key: "low", label: "منخفضة" },
];

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

export default function TicketDetail({
  ticket,
  customer,
  assignees,
  notes,
  currentUserId,
}: {
  ticket: Ticket;
  customer: Customer;
  assignees: Prof[];
  notes: Note[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(ticket.title || "");
  const [body, setBody] = useState(ticket.body || "");
  const [priority, setPriority] = useState(ticket.priority || "medium");
  const [status, setStatus] = useState(ticket.status || "open");
  const [assignee, setAssignee] = useState(ticket.assignee_id || "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  async function save() {
    setSaving(true);
    setSavedMsg("");
    const { error } = await supabase
      .from("tickets")
      .update({
        title: title.trim(),
        body: body.trim() || null,
        priority,
        status,
        assignee_id: assignee || null,
      })
      .eq("id", ticket.id);
    setSaving(false);
    if (error) {
      setSavedMsg("خطأ: " + error.message);
      return;
    }
    setSavedMsg("تم الحفظ ✓");
    router.refresh();
  }

  async function addNote() {
    const b = noteText.trim();
    if (!b) return;
    setAddingNote(true);
    const { error } = await supabase.from("ticket_notes").insert({
      ticket_id: ticket.id,
      author_id: currentUserId,
      body: b,
    });
    setAddingNote(false);
    if (error) {
      alert("تعذّر إضافة الملاحظة: " + error.message);
      return;
    }
    setNoteText("");
    router.refresh();
  }

  const lbl = "block text-xs font-bold text-muted mb-1";
  const inp = "w-full border border-line rounded-lg px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      {/* بيانات التذكرة */}
      <div className="bg-white rounded-xl border border-line p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold">تعديل التذكرة</h2>
          {customer && (
            <Link
              href={`/customers/${customer.id}`}
              className="text-xs text-brand hover:underline"
            >
              {customer.name}
            </Link>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className={lbl}>الموضوع</label>
            <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>الأولوية</label>
              <select
                className={inp}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIOS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>الحالة</label>
              <select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>المكلّف</label>
            <select className={inp} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— غير محدّد —</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || "—"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>تفاصيل</label>
            <textarea
              className={inp}
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="bg-brand text-white rounded-lg px-5 py-2 text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? "جاري الحفظ…" : "حفظ"}
            </button>
            {savedMsg && <span className="text-xs text-muted">{savedMsg}</span>}
          </div>
        </div>
      </div>

      {/* ملاحظات التذكرة */}
      <div className="bg-white rounded-xl border border-line p-4">
        <h2 className="font-extrabold mb-3">ملاحظات التذكرة</h2>

        <div className="space-y-2 mb-3">
          {notes.length === 0 && (
            <div className="text-xs text-muted">لا توجد ملاحظات بعد.</div>
          )}
          {notes.map((n) => (
            <div key={n.id} className="bg-brand-soft/40 border border-line rounded-lg p-2.5">
              <div className="text-sm">{n.body}</div>
              <div className="text-[11px] text-muted mt-1">
                {n.author} · {fmt(n.created_at)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            className={inp}
            placeholder="أضف ملاحظة…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addNote();
            }}
          />
          <button
            onClick={addNote}
            disabled={addingNote || !noteText.trim()}
            className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-brand-dark disabled:opacity-50 shrink-0"
          >
            إضافة
          </button>
        </div>
      </div>
    </div>
  );
}
