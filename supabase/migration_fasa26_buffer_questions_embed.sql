-- eqstudio.link — Fasa 26 migration (buffer time, custom intake questions, embeddable widget support)

alter table public.profiles
  add column if not exists buffer_minutes int not null default 0;

create table if not exists public.booking_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  question_text text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists booking_questions_owner_id_idx on public.booking_questions(owner_id);

alter table public.booking_questions enable row level security;
create policy "booking_questions_all_own" on public.booking_questions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

alter table public.bookings
  add column if not exists custom_answers jsonb;
