-- eqstudio.link — Fasa 38 migration (forum category restriction + forum ban)

alter table public.forum_categories add column if not exists founder_only boolean not null default false;
update public.forum_categories set founder_only = true where slug = 'pengumuman';

alter table public.profiles add column if not exists forum_banned boolean not null default false;

-- Replace the insert policy: active subscription AND not forum-banned AND the
-- target category isn't founder_only. Regular users can still REPLY to any
-- thread (forum_replies policy is untouched) — only starting NEW threads in a
-- founder_only category, or posting at all while forum-banned, is blocked.
drop policy if exists "forum_threads_insert_active_sub" on public.forum_threads;
create policy "forum_threads_insert_active_sub" on public.forum_threads
  for insert with check (
    auth.uid() = owner_id
    and exists (select 1 from public.profiles where id = auth.uid() and subscription_status = 'active' and forum_banned = false)
    and exists (select 1 from public.forum_categories where id = category_id and founder_only = false)
  );

-- Also block a forum-banned user from replying, even to threads they could
-- previously reply to — a ban should mean "can't post in the forum," full stop.
drop policy if exists "forum_replies_insert_active_sub" on public.forum_replies;
create policy "forum_replies_insert_active_sub" on public.forum_replies
  for insert with check (
    auth.uid() = owner_id
    and exists (select 1 from public.profiles where id = auth.uid() and subscription_status = 'active' and forum_banned = false)
  );
