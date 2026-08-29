-- eqstudio.link — Fasa 44 migration (explicit-date availability, replaces recurring day-of-week pattern)
--
-- Why: real solo operators (salon example: hair + facial, availability differs
-- week to week, not a fixed weekly rhythm) need to publish specific open
-- date+time blocks rather than a recurring "every Monday" pattern. The old
-- `availability` table (day_of_week based) is left in place, untouched and
-- unused going forward — not dropped, since dropping live data is riskier
-- than just leaving an inert table.

create table if not exists public.availability_dates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_link_id uuid not null references public.booking_links(id) on delete cascade,
  specific_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);
create index if not exists availability_dates_link_date_idx on public.availability_dates(booking_link_id, specific_date);

alter table public.availability_dates enable row level security;

create policy "availability_dates_all_own" on public.availability_dates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "availability_dates_public_read" on public.availability_dates
  for select using (true); -- public booking page needs to read this unauthenticated (served via service-role Function in practice, but kept permissive to match the pattern used by `availability`/`event_types` for direct-client reads elsewhere)

-- One-time data migration: expand each existing owner's recurring day-of-week
-- pattern into explicit dates for the next 60 days, so no currently-live
-- booking link goes dark the moment this ships. Owners then adjust/replace
-- via the new calendar UI going forward — this is a starting point, not an
-- ongoing sync (the old `availability` table is not read by the app after
-- this migration; editing it further has no effect).
insert into public.availability_dates (owner_id, booking_link_id, specific_date, start_time, end_time)
select
  a.owner_id,
  a.booking_link_id,
  gs.day::date as specific_date,
  a.start_time,
  a.end_time
from public.availability a
cross join lateral generate_series(current_date, current_date + interval '60 days', interval '1 day') as gs(day)
where a.booking_link_id is not null
  and extract(dow from gs.day) = a.day_of_week
on conflict do nothing;
