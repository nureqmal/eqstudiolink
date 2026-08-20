-- eqstudio.link — Fasa 16 migration (gateway-agnostic bills columns)
-- Originally written for a Billplz → ToyyibPay swap that was reverted — kept anyway
-- since generalized column names are useful regardless of which gateway is active.
-- Safe to run even if you're staying on Billplz.

alter table public.bills rename column billplz_bill_id to gateway_bill_id;
alter table public.bills rename column billplz_url to gateway_bill_url;

alter table public.bills
  add column if not exists payment_gateway text not null default 'billplz'
    check (payment_gateway in ('billplz', 'toyyibpay'));

-- One-time backfill: any row already in the table before this migration ran was
-- created via Billplz — mark those explicitly (new rows always set this explicitly too).
update public.bills set payment_gateway = 'billplz' where gateway_bill_id is not null;
