-- eqstudio.link — Supabase schema (Fasa 1 MVP)
-- Run this once in Supabase SQL Editor (Project > SQL Editor > New query)

-- 1. Profiles: one row per business owner (linked to Supabase Auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Customers: each order/payment entry tracked by an owner
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_email text not null,
  amount numeric(10,2) not null,
  due_date date not null,
  notes text,
  status text not null default 'belum_bayar' check (status in ('belum_bayar','reminder_dihantar','dah_bayar')),
  created_at timestamptz not null default now()
);

create index if not exists customers_owner_id_idx on public.customers(owner_id);
create index if not exists customers_due_date_idx on public.customers(due_date);

-- 3. Reminder settings: how many days before/on due date to send (per owner)
create table if not exists public.reminder_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  days_before int[] not null default '{3,1,0}'
);

-- 4. Reminder log: every reminder actually sent — powers admin stats + prevents duplicate sends same day
create table if not exists public.reminders_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  days_offset int not null, -- e.g. -3, -1, 0
  sent_at timestamptz not null default now()
);

create unique index if not exists reminders_log_unique_send
  on public.reminders_log(customer_id, days_offset);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.reminder_settings (owner_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Row Level Security ──────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.reminders_log enable row level security;

-- Profiles: a user can read/update only their own row
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Customers: owner has full CRUD on their own rows only
create policy "customers_select_own" on public.customers
  for select using (auth.uid() = owner_id);
create policy "customers_insert_own" on public.customers
  for insert with check (auth.uid() = owner_id);
create policy "customers_update_own" on public.customers
  for update using (auth.uid() = owner_id);
create policy "customers_delete_own" on public.customers
  for delete using (auth.uid() = owner_id);

-- Reminder settings: owner can read/update their own row
create policy "reminder_settings_select_own" on public.reminder_settings
  for select using (auth.uid() = owner_id);
create policy "reminder_settings_update_own" on public.reminder_settings
  for update using (auth.uid() = owner_id);

-- Reminders log: owner can read their own send history (admin bypasses via service role key)
create policy "reminders_log_select_own" on public.reminders_log
  for select using (auth.uid() = owner_id);

-- NOTE: the scheduled cron Worker uses the SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS entirely — that is expected and required for it to scan
-- across all owners' customers each day.

-- To make yourself an admin after signing up once:
--   update public.profiles set is_admin = true where id = '<your-auth-user-uuid>';
