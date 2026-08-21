-- eqstudio.link — Fasa 25 migration (appointment reminder, separate from deposit reminder)

alter table public.bookings
  add column if not exists appointment_reminder_sent_at timestamptz;

-- Allow the new email type in the existing log table
alter table public.email_send_log drop constraint if exists email_send_log_email_type_check;
alter table public.email_send_log add constraint email_send_log_email_type_check
  check (email_type in ('reminder', 'billing_reminder', 'digest', 'receipt', 'appointment_reminder'));
