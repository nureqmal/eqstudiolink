-- eqstudio.link — Fasa 9 migration (image upload storage for logo + QR code)

-- Public bucket: images need to be viewable in emails (no auth), so reads are public.
-- Writes are restricted per-owner via RLS below (folder name must match their user id).
insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', true)
on conflict (id) do nothing;

create policy "business_assets_public_read" on storage.objects
  for select using (bucket_id = 'business-assets');

create policy "business_assets_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "business_assets_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'business-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "business_assets_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'business-assets' and (storage.foldername(name))[1] = auth.uid()::text);
