-- eqstudio.link — Fasa 15 migration (SES migration: email send log for admin visibility)

create table if not exists public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  recipient text not null,
  subject text,
  email_type text not null check (email_type in ('reminder', 'billing_reminder', 'digest', 'receipt')),
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists email_send_log_created_at_idx on public.email_send_log(created_at desc);
create index if not exists email_send_log_status_idx on public.email_send_log(status);

-- Admin-only access (via service role key in Pages Functions) — no public policies needed.
alter table public.email_send_log enable row level security;
