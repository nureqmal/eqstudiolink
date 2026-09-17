// functions/lib/token-crypto.js
// Ringkas AES-GCM encrypt/decrypt untuk refresh_token sebelum simpan dalam DB.
// Guna Web Crypto API (tersedia dalam Cloudflare Workers runtime, tiada
// package tambahan diperlukan).

async function getKey(env) {
  const rawKey = env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!rawKey || rawKey.length < 32) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY tidak ditetapkan atau terlalu pendek (perlu sekurang-kurangnya 32 aksara).");
  }
  const keyMaterial = new TextEncoder().encode(rawKey.slice(0, 32)); // AES-256 perlukan 32 byte
  return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptToken(env, plaintext) {
  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Simpan iv + ciphertext bersama, base64-encoded, dipisah dengan "."
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${ivB64}.${ctB64}`;
}

export async function decryptToken(env, stored) {
  const key = await getKey(env);
  const [ivB64, ctB64] = stored.split(".");
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plainBuf);
}
