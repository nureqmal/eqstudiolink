-- eqstudio.link — Fasa 37 migration (admin audit log + internal notes)

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target_owner_id uuid,
  details text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log(target_owner_id, created_at desc);
alter table public.admin_audit_log enable row level security;
-- Admin-only table, always accessed via service-role Functions. No public policies
-- needed — RLS enabled with zero policies locks it fully closed to anon/authenticated.

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_notes_owner_idx on public.admin_notes(owner_id, created_at desc);
alter table public.admin_notes enable row level security;
