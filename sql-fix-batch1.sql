-- ============================================================
--  CRM-NIQAT  |  SQL Fix Batch 1
--  الجداول الناقصة للكودبيس: refunds + customer_addons
--  شغّل مرة واحدة في Supabase ▸ SQL Editor
-- ============================================================

-- جدول الاسترداد (المطابق للكودبيس)
create table if not exists refunds (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  currency text not null default 'EGP',
  reason text default '',
  shot_url text,
  status text not null default 'requested',
  requested_by uuid references profiles(id) on delete set null,
  refunded_by uuid references profiles(id) on delete set null,
  closed_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table refunds enable row level security;
drop policy if exists rw_refunds on refunds;
create policy rw_refunds on refunds for all to authenticated using (true) with check (true);

-- جدول إضافات العملاء (اعتمادات/مشاريع)
create table if not exists customer_addons (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  type text not null default 'accred',
  name text not null,
  amount numeric(12,2) not null default 0,
  free boolean not null default false,
  note text default '',
  paid boolean not null default false,
  created_at timestamptz default now()
);

alter table customer_addons enable row level security;
drop policy if exists rw_customer_addons on customer_addons;
create policy rw_customer_addons on customer_addons for all to authenticated using (true) with check (true);

-- جدول الاعتمادات (للكتالوج)
create table if not exists accreditations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

alter table accreditations enable row level security;
drop policy if exists rw_accreditations on accreditations;
create policy rw_accreditations on accreditations for all to authenticated using (true) with check (true);

-- جدول المشاريع (للكتالوج)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

alter table projects enable row level security;
drop policy if exists rw_projects on projects;
create policy rw_projects on projects for all to authenticated using (true) with check (true);

-- إضافة عمود archived لجدول العملاء (لو مش موجود)
do $$ begin
  alter table customers add column if not exists archived boolean not null default false;
exception when others then null; end $$;

-- إضافة عمود board_done لجدول العملاء (البروتوتايب)
do $$ begin
  alter table customers add column if not exists board_done boolean not null default false;
exception when others then null; end $$;
