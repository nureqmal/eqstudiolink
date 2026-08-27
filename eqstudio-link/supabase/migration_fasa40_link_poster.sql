-- eqstudio.link — Fasa 40 migration (description + poster for flat-default booking_links)

alter table public.booking_links add column if not exists description text;
alter table public.booking_links add column if not exists poster_url text;
