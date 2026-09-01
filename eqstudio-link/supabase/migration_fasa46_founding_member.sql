-- eqstudio.link — Fasa 46 migration (Founding Member offer)
--
-- Slot counting is based on CONFIRMED PAYMENT, not signup — `is_founding_member`
-- only gets set true at the moment an admin verifies an owner's FIRST-EVER
-- payment (transitioning them to active for the first time), not at trial
-- signup. `wants_founding_member` is just the owner's stated intent when they
-- submit their payment claim, captured separately so the actual grant can be
-- checked atomically against the 50-slot cap at verify time.

alter table public.profiles add column if not exists is_founding_member boolean not null default false;
alter table public.profiles add column if not exists founding_member_locked_price_monthly numeric(10,2);
alter table public.profiles add column if not exists founding_member_locked_price_yearly numeric(10,2);
alter table public.profiles add column if not exists wants_founding_member boolean not null default false;

create index if not exists profiles_founding_member_idx on public.profiles(is_founding_member) where is_founding_member = true;

-- Atomic slot-claim function. A simple "check count then update" from
-- application code has a genuine race condition (two concurrent grants could
-- both read count=49 before either commits, landing on 51). This function
-- uses a Postgres advisory lock to fully SERIALIZE every grant attempt
-- against every other one (even for different owner rows) before doing the
-- count check + update in the same transaction, so the 50-slot cap is
-- provably exact regardless of how many admin actions happen concurrently.
create or replace function public.grant_founding_member_slot(p_owner_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_granted boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('founding_member_slot_grant'));

  update public.profiles
  set is_founding_member = true,
      founding_member_locked_price_monthly = 15,
      founding_member_locked_price_yearly = 150
  where id = p_owner_id
    and is_founding_member = false
    and (select count(*) from public.profiles where is_founding_member = true) < 50
  returning true into v_granted;

  return coalesce(v_granted, false);
end;
$$;
