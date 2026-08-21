-- eqstudio.link — Fasa 21 migration (booking/scheduling: new entry point feature)

alter table public.profiles add column if not exists booking_slug text unique;
alter table public.profiles add column if not exists slot_duration_minutes int not null default 60;
alter table public.profiles add column if not exists booking_min_notice_hours int not null default 24;
alter table public.profiles add column if not exists default_deposit_amount numeric;

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Ahad .. 6=Sabtu
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  slot_datetime timestamptz not null,
  duration_minutes int not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  customer_notes text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (owner_id, slot_datetime)
);

create index if not exists availability_owner_id_idx on public.availability(owner_id);
create index if not exists bookings_owner_id_idx on public.bookings(owner_id);
create index if not exists bookings_slot_datetime_idx on public.bookings(slot_datetime);

-- Owner manages their own rows directly (dashboard, authenticated). Public booking
-- page access (reading availability, creating a booking) goes through Pages Functions
-- using the service role key — no public RLS policies needed for that.
alter table public.availability enable row level security;
alter table public.bookings enable row level security;

create policy "availability_all_own" on public.availability
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "bookings_select_own" on public.bookings
  for select using (auth.uid() = owner_id);
