"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Tpl = { id: string; name: string; body: string };
type Ctx = { name: string; phone1: string; diploma: string; batch: string; remaining: string };

function fill(text: string, c: Ctx) {
  return text
    .replace(/\{name\}/g, c.name || "")
    .replace(/\{diploma\}/g, c.diploma || "")
    .replace(/\{batch\}/g, c.batch || "")
    .replace(/\{remaining\}/g, c.remaining || "");
}
function waLink(phone: string, text: string) {
  const num = (phone || "").replace(/[^\d]/g, "").replace(/^0/, "20");
  return `https://wa.me/${num}${text ? "?text=" + encodeURIComponent(text) : ""}`;
}

export default function WhatsAppPanel({
  customerId, meId, ctx, templates,
}: { customerId: string; meId: string; ctx: Ctx; templates: Tpl[] }) {
  const supabase = createClient();
  const [preview, setPreview] = useState<string>("");

  async function send(tpl: Tpl) {
    const text = fill(tpl.body, ctx);
    window.open(waLink(ctx.phone1, text), "_blank");
    await supabase.from("communications").insert({
      customer_id: customerId, channel: "whatsapp", direction: "out", body: text, by_id: meId,
    });
    toast("اتفتحت محادثة واتساب");
  }

  if (!ctx.phone1) {
    return (
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="sec-t">واتساب</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>مفيش رقم موبايل للعميل.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t">واتساب — قوالب جاهزة</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
        {templates.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>مفيش قوالب — تتضاف من الإعدادات.</span>}
        {templates.map((t) => (
          <button key={t.id} className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
            onMouseEnter={() => setPreview(fill(t.body, ctx))} onMouseLeave={() => setPreview("")}
            onClick={() => send(t)}>
            {t.name}
          </button>
        ))}
        <a className="btn wa" style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
          href={waLink(ctx.phone1, "")} target="_blank" rel="noreferrer">فتح محادثة فارغة</a>
      </div>
      {preview && (
        <div style={{ fontSize: 12.5, color: "var(--muted)", background: "rgba(24,169,87,.07)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, whiteSpace: "pre-wrap" }}>
          {preview}
        </div>
      )}
    </div>
  );
}
