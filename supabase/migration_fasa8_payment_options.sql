-- eqstudio.link — Fasa 8 migration (alternate payment method + owner contact CTA)

alter table public.profiles
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_holder text,
  add column if not exists qr_code_url text;
