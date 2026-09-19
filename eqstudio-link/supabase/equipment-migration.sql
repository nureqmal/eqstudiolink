-- ═══════════════════════════════════════════════════════════
-- Inventori Peralatan (Equipment Inventory)
-- Jalankan dalam Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity integer not null default 1,
  status text not null default 'tersedia' check (status in ('tersedia', 'digunakan', 'penyelenggaraan', 'rosak')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists equipment_owner_id_idx on public.equipment(owner_id);

alter table public.equipment enable row level security;

create policy "equipment_all_own" on public.equipment
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
