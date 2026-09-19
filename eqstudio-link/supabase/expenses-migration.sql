-- ═══════════════════════════════════════════════════════════
-- Perbelanjaan (Expenses) — for AI receipt scan + Borang B tax export
-- Jalankan dalam Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  vendor_name text,
  amount numeric not null,
  expense_date date not null,
  category text default 'lain-lain' check (category in ('bahan', 'peralatan', 'sewa', 'pengangkutan', 'pemasaran', 'utiliti', 'lain-lain')),
  notes text,
  receipt_image_url text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_owner_id_idx on public.expenses(owner_id);
create index if not exists expenses_date_idx on public.expenses(expense_date);

alter table public.expenses enable row level security;

create policy "expenses_all_own" on public.expenses
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
