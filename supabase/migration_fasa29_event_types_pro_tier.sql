-- eqstudio.link — Fasa 29 migration (Event Types, RM0 deposit support, cancellation
-- window, and a Pro tier enabling multiple booking links)

-- 1. Event Types: an owner can define multiple bookable services, each with its own
--    duration/deposit/capacity. deposit_amount is nullable — null means "not set"
--    (falls back to profile default), 0 means "explicitly free". If an owner has
--    zero rows here, booking falls back entirely to the existing profile-level
--    slot_duration_minutes/default_deposit_amount (fully backward compatible).
create table if not exists public.event_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  duration_minutes int not null default 60,
  deposit_amount numeric,          -- null = use profile default, 0 = explicitly free
  capacity int not null default 1, -- >1 = group booking (same slot, multiple attendees)
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists event_types_owner_id_idx on public.event_types(owner_id);
alter table public.event_types enable row level security;
create policy "event_types_all_own" on public.event_types
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 2. Bookings need to know which event type (if any) they were made under, and the
--    strict unique(owner_id, slot_datetime) constraint has to go — capacity > 1
--    event types legitimately need multiple bookings at the same slot_datetime.
--    Conflict checking moves to application logic (booking-create.js / booking-
--    customer-action.js), matching the buffer-time approach already in place.
alter table public.bookings add column if not exists event_type_id uuid references public.event_types(id) on delete set null;
alter table public.bookings drop constraint if exists bookings_owner_id_slot_datetime_key;

-- 3. Cancellation window — how close to the appointment a customer may still
--    self-cancel. 0 (default) preserves current behaviour (no restriction beyond
--    the booking_min_notice_hours already in place for new bookings).
alter table public.profiles add column if not exists cancellation_notice_hours int not null default 0;

-- 4. Pro tier + secondary booking links. tier gates whether extra links are allowed;
--    booking_links holds ADDITIONAL slugs beyond the primary profiles.booking_slug.
--    MVP scope: extra links are alternate vanity URLs into the SAME calendar/
--    settings as the main profile (not fully independent per-link availability) —
--    useful for an owner running two differently-branded services who wants two
--    memorable links, without yet building fully separate per-link calendars.
alter table public.profiles add column if not exists tier text not null default 'starter' check (tier in ('starter', 'pro'));

create table if not exists public.booking_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  label text not null,
  created_at timestamptz not null default now()
);

create index if not exists booking_links_owner_id_idx on public.booking_links(owner_id);
alter table public.booking_links enable row level security;
create policy "booking_links_all_own" on public.booking_links
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
