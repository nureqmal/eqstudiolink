-- eqstudio.link — Fasa 24 migration (multi-bahasa: per-customer preferred language)

alter table public.customers
  add column if not exists preferred_language text not null default 'ms'
    check (preferred_language in ('ms', 'en', 'zh', 'ta'));
