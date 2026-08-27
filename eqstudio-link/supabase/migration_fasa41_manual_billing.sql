-- eqstudio.link — Fasa 41 migration (manual bank-transfer subscription billing)

-- Set when the owner clicks "Saya Dah Bayar" — cleared once admin verifies
-- and manually upgrades/extends them (a signal for the admin Owners table
-- to show "pending verification", not an automatic confirmation).
alter table public.profiles add column if not exists payment_claimed_at timestamptz;
