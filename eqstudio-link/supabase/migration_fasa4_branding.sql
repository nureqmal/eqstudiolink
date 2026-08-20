-- eqstudio.link — Fasa 4 migration (business profile / branding)
-- Run in Supabase SQL Editor AFTER schema.sql and migration_fasa3_billing.sql.

alter table public.profiles
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists business_address text,
  add column if not exists logo_url text;

-- All nullable — existing accounts keep working with no data entered yet.
-- Owner fills these in via the new "Profil Perniagaan" settings section;
-- the reminder email falls back to generic eqstudio.link branding when empty.
