-- eqstudio.link — Fasa 23 migration (customer self-serve reschedule/cancel token)

alter table public.bookings
  add column if not exists manage_token uuid not null default gen_random_uuid();

create unique index if not exists bookings_manage_token_idx on public.bookings(manage_token);
