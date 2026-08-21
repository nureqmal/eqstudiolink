// Cloudflare Pages Function — POST /api/create-bill
// Called by billing.html (with the user's Supabase access token) to generate
// a Billplz bill for the current owner.
// Body (optional): { plan: "monthly" | "yearly", tier: "starter" | "pro" } — if
// omitted, reuses the owner's last chosen plan/tier (default "monthly"/"starter").
//
// Required Pages environment variables/secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//   BILLPLZ_API_KEY, BILLPLZ_COLLECTION_ID
//   PUBLIC_SITE_URL   (e.g. https://eqstudio.link — used for callback/redirect)

const PLAN_PRICING = {
  starter_monthly: { amountCents: "1900", amountRM: 19.0, label: "Langganan Starter bulanan eqstudio.link" },
  starter_yearly: { amountCents: "19000", amountRM: 190.0, label: "Langganan Starter tahunan eqstudio.link (2 bulan percuma)" },
  pro_monthly: { amountCents: "3900", amountRM: 39.0, label: "Langganan Pro bulanan eqstudio.link" },
  pro_yearly: { amountCents: "39000", amountRM: 390.0, label: "Langganan Pro tahunan eqstudio.link (2 bulan percuma)" },
};

async function getUserFromToken(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbAdmin(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Sila log masuk semula." }, 401);
  }

  const user = await getUserFromToken(env, token);
  if (!user?.id) {
    return json({ error: "Sesi tidak sah. Sila log masuk semula." }, 401);
  }

  let requestedPlan = null;
  let requestedTier = null;
  try {
    const body = await request.json();
    if (body?.plan === "monthly" || body?.plan === "yearly") requestedPlan = body.plan;
    if (body?.tier === "starter" || body?.tier === "pro") requestedTier = body.tier;
  } catch { /* no body sent — fine, fall back to stored plan/tier */ }

  // Persist the plan/tier choice so future auto-renewal bills (Worker cron) use the right amount/interval
  let plan = requestedPlan;
  let tier = requestedTier;
  if (plan || tier) {
    const patch = {};
    if (plan) patch.subscription_plan = plan;
    if (tier) patch.tier = tier;
    await sbAdmin(env, `/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify(patch),
    });
  }
  if (!plan || !tier) {
    const profRes = await sbAdmin(env, `/profiles?id=eq.${user.id}&select=subscription_plan,tier`);
    plan = plan || profRes[0]?.subscription_plan || "monthly";
    tier = tier || profRes[0]?.tier || "starter";
  }
  const pricing = PLAN_PRICING[`${tier}_${plan}`];

  // Reuse an existing pending bill created in the last 24h, if any (avoid duplicates) —
  // but only when the plan wasn't explicitly re-chosen this call, so switching plans
  // always produces a fresh bill at the right amount.
  if (!requestedPlan && !requestedTier) {
    const recent = await sbAdmin(
      env,
      `/bills?owner_id=eq.${user.id}&status=eq.pending&order=created_at.desc&limit=1`
    );
    if (recent.length > 0) {
      const ageMs = Date.now() - new Date(recent[0].created_at).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        return json({ bill_url: recent[0].gateway_bill_url });
      }
    }
  }

  const site = env.PUBLIC_SITE_URL || "https://eqstudio.link";

  const form = new URLSearchParams({
    collection_id: env.BILLPLZ_COLLECTION_ID,
    email: user.email,
    name: user.email,
    amount: pricing.amountCents,
    description: pricing.label,
    callback_url: `${site}/api/billplz-webhook`,
    redirect_url: `${site}/billing.html?paid=1`,
  });

  const billplzRes = await fetch("https://www.billplz.com/api/v3/bills", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${env.BILLPLZ_API_KEY}:`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!billplzRes.ok) {
    return json({ error: "Gagal jana bil. Cuba lagi sekejap." }, 502);
  }
  const bill = await billplzRes.json();

  await sbAdmin(env, "/bills", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      owner_id: user.id,
      gateway_bill_id: bill.id,
      payment_gateway: "billplz",
      amount: pricing.amountRM,
      status: "pending",
      gateway_bill_url: bill.url,
    }),
  });

  return json({ bill_url: bill.url });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
