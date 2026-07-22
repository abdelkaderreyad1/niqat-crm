-- ═══════════════════════════════════════════════════════════
--  النقل بين الباتشات عبر تأكيد الدعم
--  إضافة عمودين لجدول handoffs عشان يميّز نوع الطلب ويحمل بياناته
-- ═══════════════════════════════════════════════════════════

-- نوع الطلب: 'activation' (تسليم عميل) أو 'batch_transfer' (نقل بين باتشات)
alter table handoffs
  add column if not exists kind text not null default 'activation';

-- بيانات إضافية للطلب (للنقل: enrollment_id + target_batch_id + labels)
alter table handoffs
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- تحديث الـ schema cache عشان PostgREST يشوف الأعمدة الجديدة فوراً
notify pgrst, 'reload schema';
