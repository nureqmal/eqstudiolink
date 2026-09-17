// functions/api/google-calendar-auth-start.js
// Dipanggil bila owner klik "Sambungkan Google Calendar" di Profil Perniagaan.
// Bina URL kebenaran Google OAuth dan redirect owner ke sana.

export async function onRequestGet(context) {
  const { request, env } = context;

  // Sahkan owner sudah log masuk (Supabase session token dalam Authorization header,
  // dihantar sebagai query param sebab ini navigasi penuh browser, bukan fetch AJAX)
  const url = new URL(request.url);
  const accessToken = url.searchParams.get("token");
  if (!accessToken) {
    return new Response("Sila log masuk dahulu sebelum sambungkan Google Calendar.", { status: 401 });
  }

  // Sahkan token dengan Supabase untuk dapat owner_id
  const authRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });
  if (!authRes.ok) {
    return new Response("Sesi tidak sah. Sila log masuk semula.", { status: 401 });
  }
  const userData = await authRes.json();
  const ownerId = userData.id;

  // "state" param bawa owner_id balik selepas Google redirect ke callback —
  // signed/encoded ringkas supaya tak mudah dipalsukan
  const state = btoa(JSON.stringify({ ownerId, ts: Date.now() }));

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
    redirect_uri: `${url.origin}/api/google-calendar-callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline", // perlu untuk dapat refresh_token
    prompt: "consent",       // paksa Google beri refresh_token setiap kali (bukan sekali sahaja seumur hidup akaun)
    state,
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
}
