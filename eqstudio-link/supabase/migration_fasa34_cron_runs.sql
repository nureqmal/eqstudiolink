-- eqstudio.link — Fasa 34 migration (cron run observability)

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  sweep_name text not null,
  status text not null check (status in ('success', 'failed')),
  error_message text,
  ran_at timestamptz not null default now()
);

create index if not exists cron_runs_sweep_ran_idx on public.cron_runs(sweep_name, ran_at desc);

-- Only the Worker cron and admin Functions ever touch this table, both via the
-- service-role key (which always bypasses RLS regardless of policies). Enabling
-- RLS with zero policies locks it fully closed to the anon/authenticated keys —
-- exactly right, since no customer-facing or owner-facing client should ever be
-- able to read internal cron run logs.
alter table public.cron_runs enable row level security;
