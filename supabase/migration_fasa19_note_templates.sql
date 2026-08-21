-- eqstudio.link — Fasa 19 migration (note/catatan templates, per-owner custom presets)

create table if not exists public.note_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now()
);

create index if not exists note_templates_owner_id_idx on public.note_templates(owner_id);

alter table public.note_templates enable row level security;

create policy "note_templates_select_own" on public.note_templates
  for select using (auth.uid() = owner_id);
create policy "note_templates_insert_own" on public.note_templates
  for insert with check (auth.uid() = owner_id);
create policy "note_templates_delete_own" on public.note_templates
  for delete using (auth.uid() = owner_id);
