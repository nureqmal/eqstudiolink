-- eqstudio.link — Fasa 43 migration (in-app notifications, Phase 1: forum reply)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_owner_unread_idx on public.notifications(owner_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = owner_id);

create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = owner_id);

-- Inserts happen via forum.html directly (customer's own Supabase session,
-- inserting a notification FOR the thread author) — so a normal authenticated
-- insert policy is needed, not just service-role. Anyone signed in with an
-- active subscription can create a notification for someone else's owner_id
-- (that's the whole point — notifying a DIFFERENT person), so this check is
-- deliberately about the ACTOR being a real, active subscriber, not about
-- owner_id matching auth.uid() the way select/update do.
create policy "notifications_insert_active_sub" on public.notifications
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and subscription_status = 'active')
  );
