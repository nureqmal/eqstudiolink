-- eqstudio.link — Fasa 50 migration (Hero enhancements: cover photo,
-- tagline, trust badge for the redesigned book.html)

alter table public.profiles
  add column if not exists cover_photo_url text,
  add column if not exists tagline text,
  add column if not exists since_year int;
