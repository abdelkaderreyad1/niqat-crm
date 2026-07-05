import type { SupabaseClient } from "@supabase/supabase-js";

// نتيجة محاولة التحويل التلقائي
export type AutoHandoffResult = {
  handedOff: boolean;   // اتعمل تحويل جديد دلوقتي؟
  alreadyDone: boolean; // كان متحوّل قبل كده؟
  itemsAdded: number;   // كام بند اتضاف
};

/**
 * تحويل تلقائي للدعم — شبكة الأمان.
 * يتنادى بعد اكتمال الدفع أو عند الهدية.
 * - لو العميل متحوّل قبل كده (handed_off = true) → ما يعملش حاجة (منع تكرار).
 * - بيغيّر المرحلة لـ enrolled.
 * - بينشئ handoff (pending) + يبني بنوده من الخدمات المعلّمة needs_activation.
 * - آمن للاستدعاء أكتر من مرة: أول استدعاء بس هو اللي بينفّذ.
 *
 * ملاحظة: ده «شبكة أمان». التحويل اليدوي من AccessPanel بيفضل شغّال زي ما هو،
 * وبيعلّم handed_off = true بحيث الشبكة دي ما تتكررش.
 */
export async function autoHandoffIfNeeded(
  supabase: SupabaseClient,
  customerId: string,
  meId: string | null,
): Promise<AutoHandoffResult> {
  const noop: AutoHandoffResult = { handedOff: false, alreadyDone: false, itemsAdded: 0 };
  if (!customerId) return noop;

  // 1) هل العميل متحوّل قبل كده؟
  const { data: cust } = await supabase
    .from("customers")
    .select("id,handed_off,stage")
    .eq("id", customerId)
    .maybeSingle();
  if (!cust) return noop;
  if ((cust as any).handed_off) return { ...noop, alreadyDone: true };

  // 2) هل فيه handoff مفتوح بالفعل؟ (أمان إضافي ضد التكرار)
  const { data: existingHo } = await supabase
    .from("handoffs")
    .select("id")
    .eq("customer_id", customerId)
    .limit(1)
    .maybeSingle();

  // 3) نبني بنود التفعيل من الخدمات المعلّمة needs_activation
  const labels: string[] = [];

  // الدبلومات المعلّمة (مع اسم الدبلومة)
  const { data: enrs } = await supabase
    .from("enrollments")
    .select("id,needs_activation, diplomas(name_ar)")
    .eq("customer_id", customerId)
    .eq("needs_activation", true);
  for (const e of (enrs as any[]) || []) {
    const nm = e?.diplomas?.name_ar;
    if (nm) labels.push(nm);
  }

  // الإضافات المعلّمة (اعتماد / مشروع / مكتبة)
  const { data: adds } = await supabase
    .from("customer_addons")
    .select("id,name,needs_activation")
    .eq("customer_id", customerId)
    .eq("needs_activation", true);
  for (const a of (adds as any[]) || []) {
    if (a?.name) labels.push(a.name);
  }

  // 4) ننشئ الـ handoff لو مش موجود، وإلا نستخدم الموجود
  let hoId = (existingHo as any)?.id as string | undefined;
  if (!hoId) {
    const { data: ho, error } = await supabase
      .from("handoffs")
      .insert({ customer_id: customerId, created_by: meId, status: "pending", note: "" })
      .select("id")
      .single();
    if (error || !ho) return noop;
    hoId = (ho as any).id;
  } else {
    // نتأكد إنه pending
    await supabase.from("handoffs").update({ status: "pending" }).eq("id", hoId);
  }

  // 5) نضيف البنود اللي لسه مش موجودة (تجنّب التكرار داخل نفس الـ handoff)
  let itemsAdded = 0;
  if (labels.length && hoId) {
    const { data: cur } = await supabase
      .from("handoff_items")
      .select("label")
      .eq("handoff_id", hoId);
    const already = new Set(((cur as any[]) || []).map((x) => x.label));
    const rows = labels
      .filter((l, i) => labels.indexOf(l) === i)  // إزالة التكرار
      .filter((l) => !already.has(l))
      .map((label) => ({ handoff_id: hoId, label, done: false }));
    if (rows.length) {
      const { error } = await supabase.from("handoff_items").insert(rows);
      if (!error) itemsAdded = rows.length;
    }
  }

  // 6) المرحلة → enrolled + علّم handed_off
  await supabase.from("customers").update({ stage: "enrolled", handed_off: true }).eq("id", customerId);

  // 7) سجل في audit_log
  await supabase.from("audit_log").insert({
    customer_id: customerId,
    actor_id: meId || null,
    action: "auto_handoff",
    detail: "auto_handoff_on_payment",
  });

  return { handedOff: true, alreadyDone: false, itemsAdded };
}
