-- eqstudio.link — Fasa 33 migration (admin notice/banner system)

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('info', 'warning', 'success', 'critical')),
  message text not null,
  cta_text text,
  cta_url text,
  is_active boolean not null default true,
  is_dismissible boolean not null default true,
  target_audience text not null default 'all' check (target_audience in ('all', 'trial', 'starter', 'pro')),
  target_location text not null default 'both' check (target_location in ('landing', 'dashboard', 'both')),
  start_at timestamptz,
  end_at timestamptz,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notices_active_idx on public.notices(is_active, target_location);

alter table public.notices enable row level security;

-- Public (anon key) can only ever see notices that are active AND currently
-- inside their scheduling window — admin management always goes through the
-- service-role Functions below, which bypass RLS entirely, so admin can still
-- see/manage inactive or scheduled-future notices.
create policy "notices_public_read_live" on public.notices
  for select using (
    is_active = true
    and (start_at is null or start_at <= now())
    and (end_at is null or end_at >= now())
  );
