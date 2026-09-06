-- eqstudio.link — Fasa 49b migration (fix: gallery bucket was missing its
-- storage.objects RLS policies, causing "new row violates row-level security
-- policy" on every upload attempt — the bucket itself doesn't grant access,
-- only these policies do)

create policy "gallery_public_read" on storage.objects
  for select using (bucket_id = 'gallery');

create policy "gallery_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "gallery_owner_update" on storage.objects
  for update using (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "gallery_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
