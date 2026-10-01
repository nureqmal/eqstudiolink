// functions/lib/availability-resolver.js
// Shared by booking-availability.js and booking-customer-manage.js so the public
// booking page and the customer self-service reschedule page ALWAYS agree on
// which times are bookable.
//
// For every calendar date the bookable ranges come from (highest priority first):
//   1. availability_closed_dates  -> the owner closed this specific date (no slots)
//   2. availability_dates         -> a date-specific override (custom hours for that date)
//   3. availability_weekly        -> the recurring weekly template for that weekday
// An owner who never sets a weekly template behaves exactly as before.

// dateKey is already a Malaysia-local calendar date ("YYYY-MM-DD"). The weekday of a
// calendar date does not depend on time zone, so read it from UTC midnight.
function dowOfDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0=Ahad .. 6=Sabtu
}

// The two newer tables may not exist yet if the SQL migration hasn't been run.
// Degrade to the previous behaviour instead of breaking the public booking page.
async function optional(fetcher) {
  try { return await fetcher(); } catch { return []; }
}

export async function loadAvailabilityInputs(sbAdmin, env, linkId, todayKey, endKey) {
  const [overrides, weekly, closed] = await Promise.all([
    sbAdmin(env, `/availability_dates?booking_link_id=eq.${linkId}&specific_date=gte.${todayKey}&specific_date=lte.${endKey}&select=specific_date,start_time,end_time`),
    optional(() => sbAdmin(env, `/availability_weekly?booking_link_id=eq.${linkId}&select=day_of_week,start_time,end_time&order=start_time.asc`)),
    optional(() => sbAdmin(env, `/availability_closed_dates?booking_link_id=eq.${linkId}&specific_date=gte.${todayKey}&specific_date=lte.${endKey}&select=specific_date`)),
  ]);

  const overridesByDate = new Map();
  for (const a of overrides) {
    if (!overridesByDate.has(a.specific_date)) overridesByDate.set(a.specific_date, []);
    overridesByDate.get(a.specific_date).push(a);
  }
  const weeklyByDow = new Map();
  for (const w of weekly) {
    if (!weeklyByDow.has(w.day_of_week)) weeklyByDow.set(w.day_of_week, []);
    weeklyByDow.get(w.day_of_week).push(w);
  }
  const closedDates = new Set(closed.map(c => c.specific_date));
  return { overridesByDate, weeklyByDow, closedDates };
}

// Returns an array of { start_time, end_time } for that date, or null when closed.
export function rangesForDate(dateKey, inputs) {
  if (inputs.closedDates.has(dateKey)) return null;
  const override = inputs.overridesByDate.get(dateKey);
  if (override && override.length > 0) return override;
  const weekly = inputs.weeklyByDow.get(dowOfDateKey(dateKey));
  return weekly && weekly.length > 0 ? weekly : null;
}
