import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PERM_KEYS = [
  "can_edit_customers", "can_see_finance", "can_view_reports", "can_manage_tickets",
  "can_manage_batches", "can_manage_settings", "can_manage_users", "can_grant_access",
  "can_message", "can_export", "can_see_daily_sales",
] as const;

// صلاحيات حسّاسة: الأدمن بس هو اللي يقدر يمنحها (تمنع تصعيد الصلاحيات)
const ELEVATED_PERMS = ["can_see_finance", "can_manage_users", "can_manage_settings", "can_grant_access"] as const;
const VALID_TEAMS = ["admin", "sales", "support"];

// سياسة كلمة سر قوية موحّدة (١٢ حرف + تعقيد) — نفس شروط صفحة الدعوة
function passwordError(pw: string): string | null {
  if (pw.length < 12) return "كلمة السر لازم 12 حرف على الأقل";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return "كلمة السر لازم تشمل حرف كبير وحرف صغير";
  if (!/[0-9]/.test(pw)) return "كلمة السر لازم تشمل رقم";
  if (!/[^A-Za-z0-9]/.test(pw)) return "كلمة السر لازم تشمل رمز (مثل !@#$)";
  return null;
}

export async function POST(req: Request) {
  // 1) لازم يكون مسجّل دخول وعنده صلاحية إدارة المستخدمين
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجّل دخول" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("can_manage_users, team").eq("id", user.id).maybeSingle();
  if (!me?.can_manage_users) return NextResponse.json({ error: "مالكش صلاحية إضافة أعضاء" }, { status: 403 });
  const iAmAdmin = me.team === "admin";

  // 2) مفتاح الـ Service Role لازم يكون متضاف في البيئة
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "مفتاح SUPABASE_SERVICE_ROLE_KEY مش متضاف في إعدادات Vercel." }, { status: 500 });
  }

  // 3) قراءة البيانات
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || "").trim();
  const team = String(body.team || "").trim();
  const perms = (body.perms || {}) as Record<string, boolean>;
  if (!email) return NextResponse.json({ error: "الإيميل مطلوب" }, { status: 400 });

  // تحقق من قيمة الفريق (منع قيم خارج الـ enum)
  if (!VALID_TEAMS.includes(team)) return NextResponse.json({ error: "قيمة الفريق غير صحيحة" }, { status: 400 });

  // منع تصعيد الصلاحيات: غير الأدمن مايقدرش ينشئ أدمن أو يمنح صلاحيات حسّاسة
  if (!iAmAdmin) {
    if (team === "admin") return NextResponse.json({ error: "الأدمن بس هو اللي يقدر ينشئ حساب أدمن." }, { status: 403 });
    for (const k of ELEVATED_PERMS) {
      if (perms[k]) return NextResponse.json({ error: "الأدمن بس هو اللي يقدر يمنح الصلاحيات الحسّاسة (الماليات/إدارة المستخدمين/الإعدادات/منح الأكسس)." }, { status: 403 });
    }
  }

  // 4) إرسال دعوة بالإيميل (المستخدم بيحط باسورده بنفسه من لينك الدعوة)
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const origin = new URL(req.url).origin;
  
  // 🔴 هنا التعديل: التوجيه لمسار الـ Callback في الباك إند الأول
  const redirectTo = `${origin}/auth/callback?next=/accept-invite`;
  
  const { data: invited, error: iErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (iErr || !invited?.user) {
    // نجمّع كل تفاصيل الخطأ عشان نعرف السبب الحقيقي (مش {} فاضية)
    const e: any = iErr || {};
    const parts = [e.message, e.code, e.status, e.name]
      .filter((x) => x !== undefined && x !== null && x !== "" && x !== "{}")
      .map((x) => String(x));
    const raw = parts.join(" | ") || "خطأ غير معروف من Supabase";

    const blob = `${e.message || ""} ${e.code || ""} ${e.name || ""}`.toLowerCase();
    let msg: string;
    if (/already|exists|registered|422|email_exists/.test(blob)) {
      msg = "فيه حساب بنفس الإيميل ده قبل كده. امسحه من Supabase ▸ Users وجرّب تاني.";
    } else if (/sending|smtp|mail|email|relay|550|535|connection|timeout|econn/.test(blob)) {
      msg = "فشل إرسال إيميل الدعوة (مشكلة في إعدادات SMTP). التفاصيل: " + raw;
    } else {
      msg = "تعذّر إرسال الدعوة. التفاصيل: " + raw;
    }
    // نطبع كمان في لوج السيرفر (يظهر في Vercel ▸ Logs)
    console.error("inviteUserByEmail failed:", JSON.stringify(e));
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 5) تحديث البروفايل (الـ trigger بيعمله تلقائي — هنا بنحدّث الاسم/الفريق/الصلاحيات)
  const update: Record<string, any> = { full_name: fullName, team };
  for (const k of PERM_KEYS) update[k] = !!perms[k];
  // الذكاء الاصطناعي
  update.can_use_ai = !!body.can_use_ai;
  const aiOpts = (body.ai_options && typeof body.ai_options === "object") ? body.ai_options : {};
  update.ai_options = update.can_use_ai ? aiOpts : {};
  const { error: uErr } = await admin.from("profiles").update(update).eq("id", invited.user.id);
  if (uErr) return NextResponse.json({ error: "اتبعتت الدعوة بس فشل ضبط الصلاحيات: " + uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: invited.user.id, invited: true });
}

async function guard() {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { err: NextResponse.json({ error: "غير مسجّل دخول" }, { status: 401 }) };
  const { data: me } = await supabase.from("profiles").select("can_manage_users, team").eq("id", user.id).maybeSingle();
  if (!me?.can_manage_users) return { err: NextResponse.json({ error: "مالكش صلاحية" }, { status: 403 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { err: NextResponse.json({ error: "مفتاح SUPABASE_SERVICE_ROLE_KEY مش متضاف في Vercel." }, { status: 500 }) };
  return { meId: user.id, iAmAdmin: me.team === "admin", admin: createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export async function PATCH(req: Request) {
  const g = await guard(); if ("err" in g) return g.err;
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  const id = String(body.id);

  // منع تصعيد الصلاحيات: غير الأدمن مايقدرش يعدّل حساب أدمن (خصوصاً باسورد/إيميل)
  const { data: target } = await g.admin!.from("profiles").select("team").eq("id", id).maybeSingle();
  if (target?.team === "admin" && !g.iAmAdmin && id !== g.meId) {
    return NextResponse.json({ error: "الأدمن بس هو اللي يقدر يعدّل حساب أدمن تاني." }, { status: 403 });
  }

  const upd: Record<string, any> = {};
  if (typeof body.full_name === "string") upd.full_name = body.full_name.trim();
  if (typeof body.phone === "string") upd.phone = body.phone.trim();
  if (Object.keys(upd).length) {
    const { error } = await g.admin!.from("profiles").update(upd).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (typeof body.email === "string" && body.email.trim()) {
    const { error } = await g.admin!.auth.admin.updateUserById(id, { email: body.email.trim().toLowerCase() });
    if (error) return NextResponse.json({ error: "تعذّر تغيير الإيميل: " + error.message }, { status: 400 });
  }
  if (typeof body.password === "string" && body.password) {
    const pErr = passwordError(body.password);
    if (pErr) return NextResponse.json({ error: pErr }, { status: 400 });
    const { error } = await g.admin!.auth.admin.updateUserById(id, { password: body.password });
    if (error) return NextResponse.json({ error: "تعذّر تغيير كلمة السر: " + error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const g = await guard(); if ("err" in g) return g.err;
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  if (body.id === g.meId) return NextResponse.json({ error: "مينفعش تحذف نفسك" }, { status: 400 });

  // منع تصعيد الصلاحيات: غير الأدمن مايقدرش يحذف حساب أدمن
  const { data: target } = await g.admin!.from("profiles").select("team").eq("id", String(body.id)).maybeSingle();
  if (target?.team === "admin" && !g.iAmAdmin) {
    return NextResponse.json({ error: "الأدمن بس هو اللي يقدر يحذف حساب أدمن." }, { status: 403 });
  }

  const { error } = await g.admin!.auth.admin.deleteUser(String(body.id));
  if (error) return NextResponse.json({ error: "تعذّر الحذف: " + error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
