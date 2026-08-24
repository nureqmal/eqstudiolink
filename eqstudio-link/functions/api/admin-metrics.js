// Cloudflare Pages Function — GET /api/admin-metrics
// Password-gated (x-admin-key). Returns business metrics + system health snapshot.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_DASHBOARD_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const MONTHLY_VALUE = { starter: 19, pro: 39 };

export async function onRequestGet(context) {
  const { request, env } = context;
  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) return json({ error: "Unauthorized" }, 401);

  try {
    const profiles = await sbAdmin(env, "/profiles?select=id,tier,subscription_status,created_at");

    // MRR — monthly-equivalent estimate. NOTE: we don't currently track billing
    // cycle (monthly vs yearly) per owner, so this treats every active/past_due
    // subscriber at their plan's MONTHLY list price — a reasonable approximation,
    // not a precise figure (yearly subscribers effectively pay less per month).
    const payingStatuses = ["active", "past_due"];
    const paying = profiles.filter(p => payingStatuses.includes(p.subscription_status));
    const mrr = paying.reduce((sum, p) => sum + (MONTHLY_VALUE[p.tier] || 0), 0);

    const counts = {
      trialing: profiles.filter(p => p.subscription_status === "trialing").length,
      active: profiles.filter(p => p.subscription_status === "active").length,
      past_due: profiles.filter(p => p.subscription_status === "past_due").length,
      cancelled: profiles.filter(p => p.subscription_status === "cancelled" || p.subscription_status === "suspended").length,
      starter: paying.filter(p => p.tier === "starter").length,
      pro: paying.filter(p => p.tier === "pro").length,
    };

    // Snapshot-based conversion rate (not cohort-based — we don't log historical
    // status transitions yet, so this is "of everyone who ever signed up, what
    // fraction is currently paying" rather than a true trial→paid cohort rate).
    const totalEver = profiles.length;
    const conversionRate = totalEver > 0 ? Math.round((paying.length / totalEver) * 100) : 0;

    // Growth — signups this month vs last month
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const signupsThisMonth = profiles.filter(p => p.created_at?.slice(0, 7) === thisMonthKey).length;
    const signupsLastMonth = profiles.filter(p => p.created_at?.slice(0, 7) === lastMonthKey).length;

    // System health — last run of each sweep type
    const cronRuns = await sbAdmin(env, "/cron_runs?select=*&order=ran_at.desc&limit=50");
    const sweepNames = ["Reminders", "Billing", "Recurring", "Digest", "Appointment Reminder", "Reminders (frequent)"];
    const lastRunBySweep = {};
    for (const name of sweepNames) {
      lastRunBySweep[name] = cronRuns.find(r => r.sweep_name === name) || null;
    }

    return json({
      mrr,
      mrr_note: "Anggaran — dikira ikut harga bulanan setiap tier, tidak bezakan bulanan/tahunan sebenar.",
      counts,
      conversion_rate: conversionRate,
      conversion_note: "Snapshot semasa (paying / jumlah pernah daftar) — bukan cohort trial-to-paid sebenar, memandangkan status lampau tak direkod lagi.",
      signups_this_month: signupsThisMonth,
      signups_last_month: signupsLastMonth,
      last_run_by_sweep: lastRunBySweep,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
