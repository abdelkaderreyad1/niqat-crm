import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

function normNum(p: string) {
  let d = (p || "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "20" + d.slice(1);
  return d;
}

export async function POST(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("can_message, team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!me?.can_message && !isAdmin) return NextResponse.json({ error: "مالكش صلاحية إرسال واتساب" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const { customer_ids, channel, template_name, var_map } = body || {};
  if (!Array.isArray(customer_ids) || customer_ids.length === 0) return NextResponse.json({ error: "مفيش عملاء مختارين" }, { status: 400 });
  if (!template_name) return NextResponse.json({ error: "اختَر قالب الأول" }, { status: 400 });
  if (customer_ids.length > 1000) return NextResponse.json({ error: "الحد الأقصى 1000 في المرة" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY مش متضاف في Vercel" }, { status: 500 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: row } = await admin.from("app_settings").select("value").eq("key", "wati").maybeSingle();
  const wati: any = row?.value || {};
  const endpoint = String(wati.endpoint || "").replace(/\/+$/, "");
  const token = String(wati.token || "").replace(/^\s*bearer\s+/i, "").trim();
  const sender = channel === "support" ? (wati.sender_support || wati.sender) : (wati.sender_sales || wati.sender);
  if (!endpoint || !token) return NextResponse.json({ error: "إعدادات WATI ناقصة" }, { status: 400 });
  if (!sender) return NextResponse.json({ error: "رقم المُرسِل مش متظبط للقناة دي" }, { status: 400 });
  const senderCh = String(sender).replace(/[^\d]/g, "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // نجيب أرقام وأسماء العملاء المختارين
  const { data: custs } = await admin.from("customers").select("id, full_name, phone1").in("id", customer_ids);
  const targets = (custs || []).filter((c: any) => c.phone1).map((c: any) => ({ id: c.id, name: String(c.full_name || "").trim().split(/\s+/).slice(0, 2).join(" "), num: normNum(c.phone1) })).filter((t) => t.num);

  const vmap: any[] = Array.isArray(var_map) ? var_map : [];
  const buildParams = (t: { name: string; num: string }) => vmap.map((v, idx) => {
    let value = "";
    if (v?.field === "name") value = t.name;
    else if (v?.field === "phone") value = t.num;
    else if (v?.field === "custom") value = v.custom || "";
    return { name: v?.name || String(idx + 1), value };
  });

  let sent = 0, failed = 0;
  const logs: any[] = [];
  const BATCH = 8;
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH);
    await Promise.all(slice.map(async (t) => {
      try {
        const apiUrl = `${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${t.num}&channelPhoneNumber=${senderCh}`;
        const r = await fetch(apiUrl, {
          method: "POST", headers,
          body: JSON.stringify({ template_name, broadcast_name: template_name, parameters: buildParams(t), channel_number: senderCh, channelNumber: senderCh, channelPhoneNumber: senderCh }),
        });
        const j: any = await r.json().catch(() => ({}));
        if (r.ok && j?.result !== false) { sent++; logs.push({ customer_id: t.id, channel: "whatsapp", direction: "out", body: `[قالب جماعي] ${template_name}`, by_id: user.id }); }
        else failed++;
      } catch { failed++; }
    }));
  }
  if (logs.length) { try { await admin.from("communications").insert(logs); } catch { } }

  return NextResponse.json({ ok: true, sent, failed, total: targets.length });
}
