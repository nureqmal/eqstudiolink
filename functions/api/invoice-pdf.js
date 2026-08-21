// Cloudflare Pages Function — GET /api/invoice-pdf?customer_id=<id>
// Owner-triggered on-demand invoice PDF (same layout as the one attached to reminder emails).
// Required Pages environment variables/secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function getUserFromToken(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`);
  return res.json();
}

function hexToRgb01(hex) {
  const clean = (hex || "#E8834E").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r || 0, g || 0, b || 0);
}

async function buildInvoicePdf(customer, profile) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 560]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb01(profile?.brand_color);
  const ink = rgb(0.16, 0.13, 0.09);
  const inkSoft = rgb(0.42, 0.38, 0.33);

  let y = 500;
  page.drawRectangle({ x: 0, y: 552, width: 420, height: 8, color: brand });

  const bizName = profile?.business_name?.trim() || "eqstudio.link";
  page.drawText(bizName, { x: 40, y, size: 18, font: fontBold, color: ink });
  y -= 34;
  page.drawText("INVOIS", { x: 40, y, size: 11, font, color: inkSoft });
  if (profile?.ssm_number) {
    page.drawText(`No. Pendaftaran: ${profile.ssm_number}`, { x: 200, y, size: 9, font, color: inkSoft });
  }
  y -= 30;
  page.drawLine({ start: { x: 40, y }, end: { x: 380, y }, thickness: 0.5, color: rgb(0.9, 0.87, 0.8) });
  y -= 24;

  const statusLabel = { belum_bayar: "Belum Bayar", reminder_dihantar: "Reminder Dihantar", dah_bayar: "Dah Bayar" };
  const rows = [
    ["Nama Pelanggan", customer.name],
    ["Jumlah", `RM ${Number(customer.amount).toFixed(2)}`],
    ["Tarikh Due", customer.due_date],
    ["Status", statusLabel[customer.status] || customer.status],
  ];
  if (customer.notes) rows.push(["Catatan", customer.notes]);

  for (const [label, value] of rows) {
    page.drawText(label, { x: 40, y, size: 10, font, color: inkSoft });
    page.drawText(String(value), { x: 200, y, size: 10, font: fontBold, color: ink });
    y -= 22;
  }

  y -= 12;
  page.drawLine({ start: { x: 40, y }, end: { x: 380, y }, thickness: 0.5, color: rgb(0.9, 0.87, 0.8) });
  y -= 24;

  const contactBits = [profile?.contact_phone, profile?.contact_email, profile?.business_address].filter(Boolean);
  if (contactBits.length) {
    page.drawText("Hubungi kami:", { x: 40, y, size: 9, font, color: inkSoft });
    y -= 16;
    for (const bit of contactBits) {
      page.drawText(bit, { x: 40, y, size: 9, font, color: ink });
      y -= 14;
    }
  }

  page.drawText("Dijana melalui eqstudio.link", { x: 40, y: 30, size: 8, font, color: inkSoft });

  return doc.save();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer_id");
  const token = url.searchParams.get("token"); // access token passed as query param since this is a direct download link

  if (!customerId || !token) return new Response("Missing params", { status: 400 });

  try {
    const user = await getUserFromToken(env, token);
    if (!user?.id) return new Response("Unauthorized", { status: 401 });

    const customers = await sbAdmin(env, `/customers?id=eq.${customerId}&owner_id=eq.${user.id}&select=*`);
    const customer = customers[0];
    if (!customer) return new Response("Not found", { status: 404 });

    const profiles = await sbAdmin(env, `/profiles?id=eq.${user.id}&select=*`);
    const profile = profiles[0] || {};

    const pdfBytes = await buildInvoicePdf(customer, profile);

    return new Response(pdfBytes, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="invois-${customer.name.replace(/[^a-z0-9]/gi, "-")}.pdf"`,
      },
    });
  } catch (err) {
    return new Response(`Ralat pelayan: ${err.message}`, { status: 500 });
  }
}
