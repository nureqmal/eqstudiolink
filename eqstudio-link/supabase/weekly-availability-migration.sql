-- ═══════════════════════════════════════════════════════════
-- Jadual Mingguan Tetap (Weekly Recurring Availability)
-- Jalankan dalam Supabase SQL Editor SEBELUM deploy fail frontend/API baharu.
--
-- Cara kerja (keutamaan dari tinggi ke rendah untuk setiap tarikh):
--   1. availability_closed_dates  -> tarikh ditutup khas (cuti, kecemasan) = tiada slot
--   2. availability_dates         -> waktu khas untuk tarikh itu (override sedia ada)
--   3. availability_weekly        -> jadual mingguan tetap ikut hari (0=Ahad .. 6=Sabtu)
-- Kalau owner tak set jadual mingguan, sistem berfungsi sama seperti sebelum ini.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.availability_weekly (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_link_id uuid not null references public.booking_links(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Ahad .. 6=Sabtu
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists availability_weekly_link_dow_idx
  on public.availability_weekly(booking_link_id, day_of_week);

alter table public.availability_weekly enable row level security;
drop policy if exists "availability_weekly_all_own" on public.availability_weekly;
create policy "availability_weekly_all_own" on public.availability_weekly
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.availability_closed_dates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_link_id uuid not null references public.booking_links(id) on delete cascade,
  specific_date date not null,
  created_at timestamptz not null default now(),
  unique (booking_link_id, specific_date)
);
create index if not exists availability_closed_dates_link_date_idx
  on public.availability_closed_dates(booking_link_id, specific_date);

alter table public.availability_closed_dates enable row level security;
drop policy if exists "availability_closed_dates_all_own" on public.availability_closed_dates;
create policy "availability_closed_dates_all_own" on public.availability_closed_dates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Nota: kedua-dua jadual hanya dibaca oleh halaman booking awam melalui Cloudflare
-- Function (service role), jadi tiada polisi baca awam diperlukan.
