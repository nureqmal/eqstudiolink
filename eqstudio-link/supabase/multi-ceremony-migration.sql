-- ═══════════════════════════════════════════════════════════
-- Multi-Ceremony Bookings — schema
-- Multiple `bookings` rows can share a `group_id` to represent one project
-- with several sessions/ceremonies (e.g. Nikah + Sanding + Resepsi), each
-- keeping its own date/time/duration but displayed together with one
-- running total. Single-session bookings (the vast majority, created via
-- the public book.html) are completely unaffected — group_id stays null.
-- Jalankan dalam Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

alter table public.bookings add column if not exists group_id uuid;
alter table public.bookings add column if not exists ceremony_label text;

create index if not exists bookings_group_id_idx on public.bookings(group_id) where group_id is not null;
