// Cloudflare Pages Function — POST /api/billplz-webhook
// Billplz calls this (form-encoded POST) when a bill's payment state changes.
// We verify X-Signature, then on paid=true: mark the bill paid and either mark
// the customer as paid (customer_invoice) or extend the owner's subscription.
//
// Required Pages environment variables/secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BILLPLZ_X_SIGNATURE_KEY

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

async function verifySignature(env, params) {
  // Billplz signs every field except x_signature itself, sorted by key, joined "key=value|",
  // then HMAC-SHA256 with the X Signature Key, hex digest.
  const entries = Object.keys(params)
    .filter((k) => k !== "x_signature")
    .sort()
    .map((k) => `${k}${params[k]}`);
  const source = entries.join("|");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.BILLPLZ_X_SIGNATURE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(source));
  const hex = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === params.x_signature;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const raw = await request.formData();
  const params = {};
  for (const [k, v] of raw.entries()) params[k] = v;

  const valid = await verifySignature(env, params);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const billId = params.id;
  const paid = params.paid === "true";

  if (!paid) {
    return new Response("OK", { status: 200 }); // ignore unpaid/other state changes
  }

  const bills = await sbAdmin(env, `/bills?gateway_bill_id=eq.${billId}&select=*`);
  const bill = bills[0];
  if (!bill) {
    return new Response("Bill not found", { status: 404 });
  }
  if (bill.status === "paid") {
    return new Response("OK", { status: 200 }); // already processed
  }

  await sbAdmin(env, `/bills?id=eq.${bill.id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString() }),
  });

  if (bill.bill_type === "customer_invoice" && bill.customer_id) {
    // A customer paid their own reminder invoice — mark them paid, don't touch owner's subscription
    await sbAdmin(env, `/customers?id=eq.${bill.customer_id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ status: "dah_bayar", paid_at: new Date().toISOString() }),
    });
    return new Response("OK", { status: 200 });
  }

  // Otherwise: this was a subscription bill — extend owner's subscription based on their plan
  const profileRes = await sbAdmin(env, `/profiles?id=eq.${bill.owner_id}&select=subscription_end_date,subscription_plan`);
  const current = profileRes[0]?.subscription_end_date ? new Date(profileRes[0].subscription_end_date) : new Date();
  const base = current > new Date() ? current : new Date();
  const plan = profileRes[0]?.subscription_plan || "monthly";
  const intervalDays = plan === "yearly" ? 365 : 30;
  const newEnd = new Date(base.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  await sbAdmin(env, `/profiles?id=eq.${bill.owner_id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ subscription_status: "active", subscription_end_date: newEnd.toISOString() }),
  });

  return new Response("OK", { status: 200 });
}
