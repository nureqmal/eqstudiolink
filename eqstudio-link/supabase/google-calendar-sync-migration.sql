-- ═══════════════════════════════════════════════════════════
-- Google Calendar Sync (one-way push) — schema draft
-- Jalankan ni dalam Supabase SQL Editor SELEPAS Google Cloud
-- Console setup siap.
-- ═══════════════════════════════════════════════════════════

-- 1. Token OAuth setiap owner (satu row per owner yang sambung)
create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade unique,
  google_calendar_id text not null,        -- ID kalendar Google yang dipilih (bukan semestinya "primary")
  refresh_token text not null,             -- disulitkan di application layer sebelum simpan (bukan plaintext)
  access_token text,                       -- token sementara (1 jam), refresh bila perlu
  access_token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_sync_error text,                    -- simpan mesej error terakhir untuk owner nampak status
  last_sync_at timestamptz
);

alter table public.google_calendar_connections enable row level security;

create policy "Owners manage their own calendar connection"
  on public.google_calendar_connections
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- 2. Rujukan Google Event ID untuk setiap booking (untuk update/padam bila reschedule/cancel)
alter table public.bookings add column if not exists google_event_id text;

-- Index untuk cari pantas bila perlu update/padam event
create index if not exists idx_bookings_google_event_id
  on public.bookings(google_event_id) where google_event_id is not null;
