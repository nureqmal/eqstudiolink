-- ═══════════════════════════════════════════════════════════
-- Bayaran Ansuran (Milestone/Installment Payments) — schema
-- Extends the existing `customers` table (which already functions as a
-- payment/reminder tracker with amount + due_date + status) rather than
-- creating a new disconnected table. This means the existing automatic
-- reminder system (reminders_log, reminder_settings, worker-cron) keeps
-- working for every milestone with zero changes to that logic.
-- Jalankan dalam Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

-- Link a payment record to a specific booking (nullable — existing/standalone
-- reminders with no booking keep working exactly as before).
alter table public.customers add column if not exists booking_id uuid references public.bookings(id) on delete cascade;

-- Short label distinguishing milestones on the same booking (e.g. "Deposit",
-- "Bayaran 2", "Baki"). Null for standalone (non-booking) reminders.
alter table public.customers add column if not exists milestone_label text;

create index if not exists customers_booking_id_idx on public.customers(booking_id) where booking_id is not null;
