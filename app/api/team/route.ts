import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PERM_KEYS = [
  "can_edit_customers", "can_see_finance", "can_view_reports", "can_manage_tickets",
  "can_manage_batches", "can_manage_settings", "can_manage_users", "can_grant_access",
  "can_message", "can_export",
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
  const password = String(body.password || "");
  const fullName = String(body.full_name || "").trim();
  const team = String(body.team || "").trim();
  const perms = (body.perms || {}) as Record<string, boolean>;
  if (!email || !password) return NextResponse.json({ error: "الإيميل وكلمة السر مطلوبين" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "كلمة السر لازم 6 حروف على الأقل" }, { status: 400 });

  // 4) إنشاء الحساب بمفتاح الإدارة
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (cErr || !created?.user) {
    const msg = /already|exists|registered/i.test(cErr?.message || "") ? "فيه حساب بنفس الإيميل ده قبل كده." : (cErr?.message || "تعذّر إنشاء الحساب");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 5) تحديث البروفايل (الـ trigger بيعمله تلقائي — هنا بنحدّث الاسم/الفريق/الصلاحيات)
  const update: Record<string, any> = { full_name: fullName, team };
  for (const k of PERM_KEYS) update[k] = !!perms[k];
  const { error: uErr } = await admin.from("profiles").update(update).eq("id", created.user.id);
  if (uErr) return NextResponse.json({ error: "اتعمل الحساب بس فشل ضبط الصلاحيات: " + uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: created.user.id });
}
