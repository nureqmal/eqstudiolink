-- eqstudio.link — Fasa 52 migration (Chat FAQ templates)
--
-- Owner-editable quick-reply templates. Customer-side questions are a fixed
-- set (same for every business, hardcoded in book.html/portal.html) since
-- they're about the PLATFORM'S process (reschedule, cancel, deposit) not
-- business-specific — no table needed for those.

create table if not exists public.chat_faq_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,       -- short button label, e.g. "Cara Reschedule"
  answer_text text not null, -- full text sent when tapped
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists chat_faq_templates_owner_idx on public.chat_faq_templates(owner_id, sort_order);

alter table public.chat_faq_templates enable row level security;
create policy "chat_faq_templates_owner_all" on public.chat_faq_templates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
