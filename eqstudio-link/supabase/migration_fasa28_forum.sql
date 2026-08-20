-- eqstudio.link — Fasa 28 migration (public forum: read by all, post/reply by active subscribers only)

create table if not exists public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0
);

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,  -- null for founder posts
  author_name text not null,
  is_founder boolean not null default false,
  is_pinned boolean not null default false,
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,  -- null for founder posts
  author_name text not null,
  is_founder boolean not null default false,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists forum_threads_category_id_idx on public.forum_threads(category_id);
create index if not exists forum_threads_last_activity_idx on public.forum_threads(last_activity_at desc);
create index if not exists forum_replies_thread_id_idx on public.forum_replies(thread_id);

-- Public read for everyone (including anonymous visitors); post/reply only for
-- owners with an ACTIVE paid subscription (trialing does not qualify). Founder
-- posts bypass RLS via the service role key in a Pages Function.
alter table public.forum_categories enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;

create policy "forum_categories_select_all" on public.forum_categories for select using (true);

create policy "forum_threads_select_all" on public.forum_threads for select using (true);
create policy "forum_threads_insert_active_sub" on public.forum_threads
  for insert with check (
    auth.uid() = owner_id
    and exists (select 1 from public.profiles where id = auth.uid() and subscription_status = 'active')
  );

create policy "forum_replies_select_all" on public.forum_replies for select using (true);
create policy "forum_replies_insert_active_sub" on public.forum_replies
  for insert with check (
    auth.uid() = owner_id
    and exists (select 1 from public.profiles where id = auth.uid() and subscription_status = 'active')
  );

-- Seed the 4 starting categories
insert into public.forum_categories (slug, name, description, sort_order) values
  ('pengumuman', 'Pengumuman', 'Kemas kini rasmi & pengumuman dari pasukan eqstudio.link', 1),
  ('soalan-bantuan', 'Soalan & Bantuan', 'Ada masalah atau tak faham sesuatu? Tanya di sini', 2),
  ('cadangan-feature', 'Cadangan Feature', 'Ada idea untuk buat eqstudio.link lagi baik? Kongsi di sini', 3),
  ('perbualan-umum', 'Perbualan Umum', 'Diskusi umum antara sesama business owner', 4)
on conflict (slug) do nothing;
