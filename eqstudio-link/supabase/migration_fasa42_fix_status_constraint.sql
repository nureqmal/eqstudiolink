-- eqstudio.link — Fasa 42 migration (fix subscription_status check constraint)
-- The original constraint (fasa3) only allowed trialing/active/past_due.
-- Admin's "Tukar Status Langganan" action has offered 'cancelled' as an
-- option since the admin-control-panel round, but the DB constraint was
-- never updated to match — this fixes that mismatch.

alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
  check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled'));
