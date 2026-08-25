-- eqstudio.link — Fasa 36 migration (feature request status)
--
-- Forum's "Cadangan Feature" category becomes a genuine feedback loop: admin can
-- tag any thread with a status, which then surfaces on the public Roadmap page.
-- Voting itself reuses the existing forum_reactions table (no new schema needed —
-- the same "Hargai" heart mechanic doubles as an upvote count in this category).

alter table public.forum_threads add column if not exists feature_status text
  check (feature_status is null or feature_status in ('planned', 'in_progress', 'shipped'));
