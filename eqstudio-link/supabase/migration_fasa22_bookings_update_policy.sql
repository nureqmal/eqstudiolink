-- eqstudio.link — Fasa 22 migration (fix: owner needs UPDATE on bookings to cancel/reschedule)

create policy "bookings_update_own" on public.bookings
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
