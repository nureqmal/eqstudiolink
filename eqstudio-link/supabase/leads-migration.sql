-- ═══════════════════════════════════════════════════════════
-- Lead Tracking — pre-booking enquiry pipeline
-- Jalankan dalam Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  contact_phone text,
  contact_email text,
  potential_date date,
  notes text,
  status text not null default 'baharu' check (status in ('baharu', 'dihubungi', 'quote_dihantar', 'ditukar', 'hilang')),
  converted_booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_owner_id_idx on public.leads(owner_id);
create index if not exists leads_status_idx on public.leads(status);

alter table public.leads enable row level security;

create policy "leads_all_own" on public.leads
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
