-- eqstudio.link — Fasa 51 migration (Chat: owner <-> customer, post-booking)
--
-- Scoped to customers (not per-booking) since one customer may have several
-- bookings with the same owner — one continuous conversation thread makes
-- more sense than a fresh thread per booking.
--
-- Access model:
--   Owner:    direct Supabase client access, RLS scoped by auth.uid()
--             (real Supabase Realtime works safely here since owner_id
--             is verified by Supabase Auth, not just a client-supplied value)
--   Customer: NO direct table access at all. Customer has no Supabase Auth
--             session (they authenticate via portal_token, like the rest of
--             the customer portal). All customer reads/writes go through
--             Cloudflare Functions that validate portal_token server-side
--             with the service role key. This avoids a "using (true)" RLS
--             policy on private conversation content, which would let any
--             anonymous visitor listen to every customer's chat platform-wide.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sender_type text not null check (sender_type in ('owner', 'customer')),
  message_text text not null,
  created_at timestamptz not null default now(),
  read_by_owner boolean not null default false,
  read_by_customer boolean not null default false
);

create index if not exists chat_messages_customer_idx on public.chat_messages(customer_id, created_at);
create index if not exists chat_messages_owner_idx on public.chat_messages(owner_id, created_at);

alter table public.chat_messages enable row level security;

-- Owner-only direct access. No customer-facing policy — see note above.
create policy "chat_messages_owner_all" on public.chat_messages
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Throttle tracking for customer chat-notification emails, so a burst of
-- owner replies doesn't burn through the Resend free-tier daily cap.
alter table public.customers
  add column if not exists chat_last_emailed_at timestamptz;
