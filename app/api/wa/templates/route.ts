import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("can_message, team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!me?.can_message && !isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY مش متضاف في Vercel" }, { status: 500 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: row } = await admin.from("app_settings").select("value").eq("key", "wati").maybeSingle();
  const wati: any = row?.value || {};
  const endpoint = String(wati.endpoint || "").replace(/\/+$/, "");
  const token = wati.token;
  if (!endpoint || !token) return NextResponse.json({ error: "إعدادات WATI ناقصة — ظبّطها من الإعدادات" }, { status: 400 });

  try {
    const r = await fetch(`${endpoint}/api/v1/getMessageTemplates?pageSize=200&pageNumber=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: j?.info || j?.message || `WATI HTTP ${r.status}` }, { status: 502 });
    const arr: any[] = j?.messageTemplates || j?.templates || j?.data || [];
    // نطلّع الاسم + عدد المتغيّرات (لو موجود) + معاينة مختصرة للنص
    const templates = arr.map((t) => {
      const name = t.elementName || t.name || t.template_name || "";
      const body = t.bodyOriginal || t.body || (Array.isArray(t.elements) ? (t.elements.find((e: any) => e.type === "BODY")?.text || "") : "") || "";
      const vars = (String(body).match(/\{\{\s*\d+\s*\}\}/g) || []).length;
      const status = t.status || t.templateStatus || "";
      return { name, body, vars, status };
    }).filter((t) => t.name);
    return NextResponse.json({ ok: true, templates });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "فشل الاتصال بـ WATI" }, { status: 502 });
  }
}
