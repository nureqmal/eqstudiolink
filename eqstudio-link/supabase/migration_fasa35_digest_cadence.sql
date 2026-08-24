-- eqstudio.link — Fasa 35 migration (digest cadence tracking)
--
-- Digest email used to go out daily to every owner with outstanding customers.
-- Founder felt this was too frequent, especially during trial, and wanted it
-- tiered instead: Starter gets a monthly summary, Pro gets weekly. This column
-- tracks when each owner's last digest went out so the sweep can decide whether
-- today is "due" for them based on their tier's cadence.

alter table public.profiles add column if not exists last_digest_sent_at timestamptz;
