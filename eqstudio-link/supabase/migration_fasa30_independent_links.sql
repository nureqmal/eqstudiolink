-- eqstudio.link — Fasa 30 migration (Pro tier: fully independent booking links)
--
-- Previously, Pro-tier "extra" booking_links were aliases pointing at the SAME
-- availability/event_types/settings as the primary profiles.booking_slug. This
-- migration makes every link (including the primary one) fully independent:
-- each booking_links row gets its own settings, and availability/event_types/
-- booking_questions become scoped by booking_link_id instead of owner_id.

-- 1. booking_links gains its own copy of every setting that used to live only
--    on profiles (nullable = "not yet configured", same semantics as before).
alter table public.booking_links add column if not exists slot_duration_minutes int not null default 60;
alter table public.booking_links add column if not exists buffer_minutes int not null default 0;
alter table public.booking_links add column if not exists booking_min_notice_hours int not null default 24;
alter table public.booking_links add column if not exists default_deposit_amount numeric;
alter table public.booking_links add column if not exists cancellation_notice_hours int not null default 0;
alter table public.booking_links add column if not exists is_primary boolean not null default false;

-- 2. availability / event_types / booking_questions become scoped by
--    booking_link_id instead of owner_id directly.
alter table public.availability add column if not exists booking_link_id uuid references public.booking_links(id) on delete cascade;
alter table public.event_types add column if not exists booking_link_id uuid references public.booking_links(id) on delete cascade;
alter table public.booking_questions add column if not exists booking_link_id uuid references public.booking_links(id) on delete cascade;

-- 3. bookings need to know which link they came through (nullable — legacy
--    bookings made before this migration won't have one, that's fine).
alter table public.bookings add column if not exists booking_link_id uuid references public.booking_links(id) on delete set null;

-- 4. Data migration: for every owner who already has a booking_slug configured,
--    create a "primary" booking_links row carrying over their existing profile-
--    level settings, then re-point their existing availability/event_types/
--    booking_questions rows at that new primary link.
do $$
declare
  p record;
  new_link_id uuid;
begin
  for p in
    select id, booking_slug, slot_duration_minutes, buffer_minutes, booking_min_notice_hours,
           default_deposit_amount, cancellation_notice_hours, business_name
    from public.profiles
    where booking_slug is not null
  loop
    insert into public.booking_links (
      owner_id, slug, label, is_primary, slot_duration_minutes, buffer_minutes,
      booking_min_notice_hours, default_deposit_amount, cancellation_notice_hours
    ) values (
      p.id, p.booking_slug, coalesce(p.business_name, 'Link Utama'), true, p.slot_duration_minutes,
      p.buffer_minutes, p.booking_min_notice_hours, p.default_deposit_amount, p.cancellation_notice_hours
    )
    on conflict (slug) do nothing
    returning id into new_link_id;

    if new_link_id is not null then
      update public.availability set booking_link_id = new_link_id where owner_id = p.id and booking_link_id is null;
      update public.event_types set booking_link_id = new_link_id where owner_id = p.id and booking_link_id is null;
      update public.booking_questions set booking_link_id = new_link_id where owner_id = p.id and booking_link_id is null;
    end if;
  end loop;
end $$;

-- 5. Any EXTRA (non-primary) booking_links created before this migration were
--    aliases with no settings of their own — give them a starting copy of the
--    owner's primary link settings so they aren't left blank/broken.
update public.booking_links extra
set slot_duration_minutes = primary_link.slot_duration_minutes,
    buffer_minutes = primary_link.buffer_minutes,
    booking_min_notice_hours = primary_link.booking_min_notice_hours,
    default_deposit_amount = primary_link.default_deposit_amount,
    cancellation_notice_hours = primary_link.cancellation_notice_hours
from public.booking_links primary_link
where primary_link.owner_id = extra.owner_id
  and primary_link.is_primary = true
  and extra.is_primary = false;
