-- eqstudio.link — Fasa 39 migration (service description + poster image, Pro-only)

alter table public.event_types add column if not exists description text;
alter table public.event_types add column if not exists poster_url text;

-- Storage bucket for service poster images. Public read (posters are shown on
-- the public booking page to anyone), write restricted to the owning business
-- owner only, enforced via the folder-per-owner convention below (path must
-- start with the uploader's own auth uid).
insert into storage.buckets (id, name, public, file_size_limit)
values ('posters', 'posters', true, 2097152) -- 2MB hard cap, matches app-level check
on conflict (id) do nothing;

create policy "posters_public_read" on storage.objects
  for select using (bucket_id = 'posters');

create policy "posters_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "posters_owner_update" on storage.objects
  for update using (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "posters_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
