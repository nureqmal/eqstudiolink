-- eqstudio.link — Fasa 34 migration (cron run observability)

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  sweep_name text not null,
  status text not null check (status in ('success', 'failed')),
  error_message text,
  ran_at timestamptz not null default now()
);

create index if not exists cron_runs_sweep_ran_idx on public.cron_runs(sweep_name, ran_at desc);
