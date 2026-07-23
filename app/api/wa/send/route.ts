import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

// تطبيع رقم المستلم لصيغة دولية بأرقام فقط (افتراضي مصر لو بيبدأ بصفر)
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

  // صلاحية إرسال واتساب
  const { data: me } = await supabase.from("profiles").select("can_message, team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!me?.can_message && !isAdmin) return NextResponse.json({ error: "مالكش صلاحية إرسال واتساب" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const { to, channel, mode, text, template_name, broadcast_name, parameters, customer_id } = body || {};
  if (!to) return NextResponse.json({ error: "رقم المستلم مفقود" }, { status: 400 });

  // قراءة إعداد WATI بصلاحية سيرفر (التوكن ماينزلش للمتصفح أبداً)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY مش متضاف في Vercel" }, { status: 500 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: row } = await admin.from("app_settings").select("value").eq("key", "wati").maybeSingle();
  const wati: any = row?.value || {};
  const endpoint = String(wati.endpoint || "").replace(/\/+$/, "");
  const token = String(wati.token || "").replace(/^\s*bearer\s+/i, "").trim();
  const sender = channel === "support" ? (wati.sender_support || wati.sender) : (wati.sender_sales || wati.sender);
  if (!endpoint || !token) return NextResponse.json({ error: "إعدادات WATI ناقصة (endpoint/token) — ظبّطها من الإعدادات" }, { status: 400 });
  if (!sender) return NextResponse.json({ error: "رقم المُرسِل مش متظبط للقناة دي — ظبّطه من الإعدادات" }, { status: 400 });

  const rcpt = normNum(to);
  const senderCh = String(sender).replace(/[^\d+]/g, "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  let apiUrl = "";
  let payload: any = {};
  if (mode === "template") {
    if (!template_name) return NextResponse.json({ error: "اسم القالب مفقود" }, { status: 400 });
    apiUrl = `${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${rcpt}`;
    payload = {
      template_name,
      broadcast_name: broadcast_name || template_name,
      parameters: Array.isArray(parameters) ? parameters : [],
      // تحديد الرقم المُرسِل (حساب واحد بأكتر من رقم) — بنبعت الاسمين احتياطاً
      channelNumber: senderCh,
      channelPhoneNumber: senderCh,
    };
  } else {
    if (!text) return NextResponse.json({ error: "نص الرسالة مفقود" }, { status: 400 });
    apiUrl = `${endpoint}/api/v1/sendSessionMessage/${rcpt}?messageText=${encodeURIComponent(text)}`;
    payload = { channelNumber: senderCh, channelPhoneNumber: senderCh };
  }

  let watiRes: any = null;
  let ok = false;
  let errMsg = "";
  try {
    const r = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(payload) });
    watiRes = await r.json().catch(() => ({}));
    ok = r.ok && watiRes?.result !== false && watiRes?.ok !== false;
    if (!ok) errMsg = watiRes?.info || watiRes?.message || watiRes?.error || `WATI HTTP ${r.status}`;
  } catch (e: any) {
    errMsg = e?.message || "فشل الاتصال بـ WATI";
  }

  if (ok && customer_id) {
    await admin.from("communications").insert({
      customer_id, channel: "whatsapp", direction: "out",
      body: mode === "template" ? `[قالب] ${template_name}` : text, by_id: user.id,
    });
  }

  if (!ok) return NextResponse.json({ error: errMsg || "فشل الإرسال", wati: watiRes }, { status: 502 });
  return NextResponse.json({ ok: true, wati: watiRes });
}
