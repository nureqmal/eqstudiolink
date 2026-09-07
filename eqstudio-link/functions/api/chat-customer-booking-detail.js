// Cloudflare Pages Function — GET /api/chat-customer-booking-detail?token=<uuid>
// Public endpoint (no login) — portal_token pattern, same as customer-portal.js.
// Returns the customer's most recent booking, used to render the auto
// "booking summary" card at the top of their chat thread (Shopee-style
// "order detail" card), so the owner sees context immediately.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`);
  return res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return json({ error: "Token diperlukan." }, 400);

  const customers = await sbAdmin(env, `/customers?portal_token=eq.${token}&select=id`);
  if (customers.length === 0) return json({ error: "Token tidak sah." }, 404);
  const customerId = customers[0].id;

  const bookings = await sbAdmin(
    env,
    `/bookings?customer_id=eq.${customerId}&select=slot_datetime,duration_minutes,status,customer_notes&order=slot_datetime.desc&limit=1`
  );
  if (bookings.length === 0) return json({ booking: null });

  return json({ booking: bookings[0] });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
