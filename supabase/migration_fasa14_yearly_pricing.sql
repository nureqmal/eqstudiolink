-- eqstudio.link — Fasa 14 migration (yearly pricing option)

alter table public.profiles
  add column if not exists subscription_plan text not null default 'monthly'
    check (subscription_plan in ('monthly', 'yearly'));
