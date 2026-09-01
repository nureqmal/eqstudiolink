// Cloudflare Pages Function — GET /api/founding-member-count
// Public, unauthenticated — used by the landing page (public counter display)
// and billing.html (deciding whether to show the Founding Member toggle at
// all). Returns only the COUNT, never any owner data, so it's safe to expose
// without auth.
//
// Required Pages env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const FOUNDING_MEMBER_CAP = 50;

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?is_founding_member=eq.true&select=id`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "count=exact",
        },
      }
    );
    if (!res.ok) throw new Error(`Supabase count query failed: ${res.status}`);
    const contentRange = res.headers.get("content-range") || "";
    const taken = parseInt(contentRange.split("/")[1], 10) || 0;

    return new Response(JSON.stringify({
      taken,
      cap: FOUNDING_MEMBER_CAP,
      remaining: Math.max(FOUNDING_MEMBER_CAP - taken, 0),
      available: taken < FOUNDING_MEMBER_CAP,
    }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=30" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
