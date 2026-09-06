-- eqstudio.link — Fasa 48 migration (Resend webhook delivery tracking)
--
-- Adds the fields needed to match a Resend webhook event back to the right
-- reminders_log row, and to store the actual delivery lifecycle status
-- (not just "we successfully called the Resend API").

alter table public.reminders_log
  add column if not exists resend_email_id text,
  add column if not exists delivery_status text not null default 'sent'
    check (delivery_status in ('sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'opened')),
  add column if not exists delivery_status_updated_at timestamptz;

create index if not exists reminders_log_resend_email_id_idx on public.reminders_log(resend_email_id);

-- Also track delivery status on the general email_send_log for admin visibility
-- (contact form, billing reminders, receipts, digests — not just appointment reminders).
alter table public.email_send_log
  add column if not exists resend_email_id text,
  add column if not exists delivery_status text default 'sent'
    check (delivery_status in ('sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'opened')),
  add column if not exists delivery_status_updated_at timestamptz;

create index if not exists email_send_log_resend_email_id_idx on public.email_send_log(resend_email_id);
