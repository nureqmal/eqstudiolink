-- eqstudio.link — Fasa 20 migration (No. SSM untuk invois rasmi)

alter table public.profiles
  add column if not exists ssm_number text;
