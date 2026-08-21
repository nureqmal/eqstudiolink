-- eqstudio.link — Fasa 6 migration (per-invoice payment, WhatsApp, analytics)

alter table public.customers
  add column if not exists contact_phone text,
  add column if not exists paid_at timestamptz;

alter table public.bills
  add column if not exists bill_type text not null default 'subscription'
    check (bill_type in ('subscription', 'customer_invoice')),
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

create index if not exists bills_customer_id_idx on public.bills(customer_id);
