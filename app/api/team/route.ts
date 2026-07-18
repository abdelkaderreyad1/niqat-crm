import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PERM_KEYS = [
  "can_edit_customers", "can_see_finance", "can_view_reports", "can_manage_tickets",
  "can_manage_batches", "can_manage_settings", "can_manage_users", "can_grant_access",
  "can_message", "can_export", "can_see_daily_sales",
] as const;

export async function POST(req: Request) {
  // 1) لازم يكون مسجّل دخول وعنده صلاحية إدارة المستخدمين
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجّل دخول" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("can_manage_users").eq("id", user.id).maybeSingle();
  if (!me?.can_manage_users) return NextResponse.json({ error: "مالكش صلاحية إضافة أعضاء" }, { status: 403 });

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

  // 4) إرسال دعوة بالإيميل (المستخدم بيحط باسورده بنفسه من لينك الدعوة)
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const origin = new URL(req.url).origin;
  const redirectTo = `${origin}/accept-invite`;
  const { data: invited, error: iErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (iErr || !invited?.user) {
    const msg = /already|exists|registered/i.test(iErr?.message || "") ? "فيه حساب بنفس الإيميل ده قبل كده." : (iErr?.message || "تعذّر إرسال الدعوة");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 5) تحديث البروفايل (الـ trigger بيعمله تلقائي — هنا بنحدّث الاسم/الفريق/الصلاحيات)
  const update: Record<string, any> = { full_name: fullName, team };
  for (const k of PERM_KEYS) update[k] = !!perms[k];
  const { error: uErr } = await admin.from("profiles").update(update).eq("id", invited.user.id);
  if (uErr) return NextResponse.json({ error: "اتبعتت الدعوة بس فشل ضبط الصلاحيات: " + uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: invited.user.id, invited: true });
}

async function guard() {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { err: NextResponse.json({ error: "غير مسجّل دخول" }, { status: 401 }) };
  const { data: me } = await supabase.from("profiles").select("can_manage_users").eq("id", user.id).maybeSingle();
  if (!me?.can_manage_users) return { err: NextResponse.json({ error: "مالكش صلاحية" }, { status: 403 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { err: NextResponse.json({ error: "مفتاح SUPABASE_SERVICE_ROLE_KEY مش متضاف في Vercel." }, { status: 500 }) };
  return { meId: user.id, admin: createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export async function PATCH(req: Request) {
  const g = await guard(); if ("err" in g) return g.err;
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  const id = String(body.id);
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
    if (body.password.length < 6) return NextResponse.json({ error: "كلمة السر لازم 6 حروف على الأقل" }, { status: 400 });
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
  const { error } = await g.admin!.auth.admin.deleteUser(String(body.id));
  if (error) return NextResponse.json({ error: "تعذّر الحذف: " + error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
