-- eqstudio.link — Fasa 45 migration (dedupe + unique constraint on availability_dates)
-- Fixes a real risk: repeated use of the "Salin ke 4 Minggu Depan" button on
-- overlapping windows could insert duplicate (booking_link_id, specific_date,
-- start_time, end_time) rows, which would show DUPLICATE slot times to
-- customers (the slot-generation loop iterates every row for a date with no
-- dedup). This cleans up any duplicates that may already exist, then adds a
-- unique constraint so it can never happen again.

-- Remove exact duplicates, keeping the oldest row of each set.
delete from public.availability_dates a
using public.availability_dates b
where a.id > b.id
  and a.booking_link_id = b.booking_link_id
  and a.specific_date = b.specific_date
  and a.start_time = b.start_time
  and a.end_time = b.end_time;

alter table public.availability_dates
  add constraint availability_dates_unique_slot unique (booking_link_id, specific_date, start_time, end_time);
