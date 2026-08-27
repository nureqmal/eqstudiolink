// Cloudflare Pages Function — GET /api/customer-portal?token=<uuid>
// Public endpoint (no login) — token is an unguessable UUID acting as the key.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return json({ error: "Token diperlukan." }, 400);

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const custRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/customers?portal_token=eq.${token}&select=id,name,amount,due_date,status,notes,owner_id,preferred_language`,
    { headers }
  );
  if (!custRes.ok) return json({ error: "Ralat mencari invois." }, 500);
  const customers = await custRes.json();
  if (customers.length === 0) return json({ error: "Invois tidak dijumpai." }, 404);
  const customer = customers[0];

  const profRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${customer.owner_id}&select=business_name,contact_phone,contact_email,business_address,logo_url,brand_color,bank_name,bank_account_number,bank_account_holder,qr_code_url,ssm_number`,
    { headers }
  );
  const profiles = await profRes.json();
  const profile = profiles[0] || {};

  return json({
    customer: { name: customer.name, amount: customer.amount, due_date: customer.due_date, status: customer.status, notes: customer.notes },
    business: profile,
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
