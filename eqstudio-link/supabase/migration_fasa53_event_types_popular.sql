-- eqstudio.link — Fasa 53 migration (event_types popular column)
alter table public.event_types add column if not exists popular boolean default false;
