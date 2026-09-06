-- eqstudio.link — Fasa 49 migration ("Website Saya" — book.html as a full
-- personal-website-style profile page, not just a bare booking flow)

-- Business-level content: story, social links, maps
alter table public.profiles
  add column if not exists about_text text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists facebook_url text,
  add column if not exists whatsapp_number text,
  add column if not exists maps_url text;

-- Gallery: one owner, many photos, ordered
create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gallery_images_owner_idx on public.gallery_images(owner_id, sort_order);

alter table public.gallery_images enable row level security;
create policy "gallery_images_owner_all" on public.gallery_images
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "gallery_images_select_public" on public.gallery_images
  for select using (true); -- book.html is a public page, needs anon read

-- Testimonials: owner-entered only (never auto-generated), one owner many rows
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  quote_text text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists testimonials_owner_idx on public.testimonials(owner_id, sort_order);

alter table public.testimonials enable row level security;
create policy "testimonials_owner_all" on public.testimonials
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "testimonials_select_public" on public.testimonials
  for select using (true); -- book.html is a public page, needs anon read

-- Storage bucket for gallery photos (separate from existing "posters" bucket,
-- since these are standalone photos, not tied to a specific event type/link)
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;
