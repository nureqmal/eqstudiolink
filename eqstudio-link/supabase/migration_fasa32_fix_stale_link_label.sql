-- eqstudio.link — Fasa 32 migration (retroactive fix: sync primary link label to
-- current business_name)
--
-- Bug: booking_links.label was set once at creation time (either "Link Utama" for
-- a brand-new link, or a snapshot from the fasa30 migration) and never updated
-- when the owner later changed profiles.business_name in Tetapan Profil. Since
-- booking-availability.js/booking-create.js/booking-customer-manage.js/booking-
-- customer-action.js all display `link.label || profile.business_name` to
-- customers, this meant the public booking page silently kept showing the OLD
-- business name forever. Fixed going forward in the dashboard save handler; this
-- migration corrects labels that are already stale in production right now.
--
-- Only touches PRIMARY links — non-primary (Pro-tier) links intentionally carry
-- their own distinct label for a different business/venture and must not be
-- overwritten.

update public.booking_links bl
set label = p.business_name
from public.profiles p
where bl.owner_id = p.id
  and bl.is_primary = true
  and p.business_name is not null
  and bl.label is distinct from p.business_name;
