-- eqstudio.link — Fasa 5 migration (brand color)
alter table public.profiles
  add column if not exists brand_color text not null default '#C97A2B';
