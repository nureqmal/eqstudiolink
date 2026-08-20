-- eqstudio.link — Fasa 7 migration (recurring, customer portal, CSV/calendar support)

alter table public.customers
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurring_days int not null default 30,
  add column if not exists next_generated boolean not null default false,
  add column if not exists portal_token uuid not null default gen_random_uuid();

create unique index if not exists customers_portal_token_idx on public.customers(portal_token);

-- Portal token lookups happen via service-role Pages Function (customer isn't
-- authenticated), so no new RLS policy needed — existing policies are untouched.
