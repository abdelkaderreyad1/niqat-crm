"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Task = { id: string; title: string; due: string; done: boolean };
type Note = { id: string; body: string; by: string; at: string };

const today = () => new Date().toISOString().slice(0, 10);

export default function CustomerActivity({
  customerId, meId, initialTasks, initialNotes,
}: { customerId: string; meId: string; initialTasks: Task[]; initialNotes: Note[] }) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [tTitle, setTTitle] = useState("");
  const [tDue, setTDue] = useState(today());
  const [noteText, setNoteText] = useState("");

  async function addTask() {
    const title = tTitle.trim();
    if (!title) return;
    const { data, error } = await supabase.from("tasks")
      .insert({ customer_id: customerId, assignee_id: meId, title, due_at: tDue || null, done: false })
      .select("id").single();
    if (error) return alert("تعذّر إضافة المهمة: " + error.message);
    setTasks((l) => [{ id: data!.id as string, title, due: tDue, done: false }, ...l]);
    setTTitle("");
  }
  async function toggleTask(id: string) {
    const cur = tasks.find((t) => t.id === id); if (!cur) return;
    const next = !cur.done;
    setTasks((l) => l.map((t) => (t.id === id ? { ...t, done: next } : t)));
    await supabase.from("tasks").update({ done: next }).eq("id", id);
  }
  async function addNote() {
    const body = noteText.trim();
    if (!body) return;
    const { data, error } = await supabase.from("communications")
      .insert({ customer_id: customerId, body, channel: "note", direction: "out", by_id: meId })
      .select("id, at").single();
    if (error) return alert("تعذّر إضافة الملاحظة: " + error.message);
    setNotes((l) => [{ id: data!.id as string, body, by: "أنا", at: String((data as any).at || "").replace("T", " ").slice(0, 16) }, ...l]);
    setNoteText("");
  }

  return (
    <>
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="sec-t">المهام</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input className="inp" placeholder="مهمة جديدة…" value={tTitle} onChange={(e) => setTTitle(e.target.value)} />
          <input className="inp num" type="date" style={{ width: 150 }} value={tDue} onChange={(e) => setTDue(e.target.value)} />
          <button className="btn" style={{ height: 38 }} onClick={addTask}>إضافة</button>
        </div>
        {tasks.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد مهام.</div>}
        {tasks.map((k) => (
          <div key={k.id} className={"task" + (k.done ? " done" : "")}>
            <div className={"cb" + (k.done ? " on" : "")} onClick={() => toggleTask(k.id)}>
              {k.done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 12l5 5L20 7" /></svg> : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tt">{k.title}</div>
              <div className="tinfo"><span className="num">{k.due || "—"}</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="sec-t">الملاحظات والتواصل</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input className="inp" placeholder="أضف ملاحظة…" value={noteText} onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
          <button className="btn" style={{ height: 38 }} onClick={addNote}>حفظ</button>
        </div>
        {notes.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد ملاحظات.</div>}
        {notes.map((n) => (
          <div key={n.id} className="comm">
            <div className="ci" style={{ background: "#eef2f8", color: "var(--muted)" }}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 5h16v11H7l-3 3z" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{n.body}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}><b>{n.by}</b> • <span className="num">{n.at}</span></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
