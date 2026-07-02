-- ============================================================
--  CRM-NIQAT  |  SQL Fix Batch 2  (POST-DEPLOY)
--  حماية مبالغ الريفند والإضافات خلف can_finance()
--  ⚠️ يتشغّل بعد ما الكود الجديد يترفع على Vercel
-- ============================================================

-- 1) نقل مبالغ الريفند القديمة للجدول المحمي
insert into refund_finance (refund_id, amount, currency, shot_url)
select id, amount, currency, nullif(shot_url, '')
from refunds
where amount is not null and amount > 0
on conflict (refund_id) do nothing;

-- 2) نقل مبالغ الإضافات القديمة للجدول المحمي
insert into addon_finance (customer_addon_id, amount, currency)
select id, amount, currency
from customer_addons
where amount is not null and amount > 0
on conflict (customer_addon_id) do nothing;

-- 3) مسح الأعمدة المكشوفة (المبالغ بقت في *_finance المحمية)
alter table refunds        drop column if exists amount;
alter table refunds        drop column if exists currency;
alter table refunds        drop column if exists shot_url;
alter table customer_addons drop column if exists amount;
alter table customer_addons drop column if exists currency;
