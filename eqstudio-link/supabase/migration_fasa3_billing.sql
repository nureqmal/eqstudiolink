-- eqstudio.link — Fasa 3 migration (subscription + Billplz billing)
-- Run in Supabase SQL Editor AFTER schema.sql. Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards).

-- 1. Subscription tracking on profiles
alter table public.profiles
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due')),
  add column if not exists subscription_end_date timestamptz not null default (now() + interval '14 days');

-- 2. Bills — one row per Billplz bill generated
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  billplz_bill_id text unique,
  amount numeric(10,2) not null default 15.00,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  billplz_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists bills_owner_id_idx on public.bills(owner_id);

alter table public.bills enable row level security;

create policy "bills_select_own" on public.bills
  for select using (auth.uid() = owner_id);

-- NOTE: bills are created/updated by server-side code only (Pages Function using
-- anon+JWT for create-bill, Worker/webhook using service role key) — no insert/update
-- policy needed for regular users, RLS default-denies those and that's correct.
