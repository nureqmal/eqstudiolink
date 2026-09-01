-- eqstudio.link — Fasa 47 migration (Web Push subscriptions)
--
-- One owner can have multiple subscriptions (different devices/browsers).
-- endpoint is the unique identifier per subscription (each browser push
-- service gives a unique URL per subscribed device).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_owner_idx on public.push_subscriptions(owner_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_all_own" on public.push_subscriptions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
