-- eqstudio.link — Fasa 31 migration (forum thread reactions — "sesama owner saling akui")

create table if not exists public.forum_reactions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (thread_id, owner_id)
);

create index if not exists forum_reactions_thread_id_idx on public.forum_reactions(thread_id);

alter table public.forum_reactions enable row level security;

-- Public read (so reaction counts show even to anonymous visitors), but only
-- active-subscription owners can react — same gate as posting/replying.
create policy "forum_reactions_select_all" on public.forum_reactions for select using (true);
create policy "forum_reactions_insert_active_sub" on public.forum_reactions
  for insert with check (
    auth.uid() = owner_id
    and exists (select 1 from public.profiles where id = auth.uid() and subscription_status = 'active')
  );
create policy "forum_reactions_delete_own" on public.forum_reactions
  for delete using (auth.uid() = owner_id);
