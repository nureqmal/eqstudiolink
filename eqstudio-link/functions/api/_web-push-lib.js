// web-push-lib.js — a from-scratch Web Push protocol implementation using
// only Web Crypto API (Cloudflare Workers/Pages Functions runtime does NOT
// have Node's `crypto` module, so the standard `web-push` npm package will
// not run here — this reimplements exactly what's needed, following
// RFC 8291 (message encryption) and RFC 8292 (VAPID).

function base64UrlToUint8Array(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatUint8Arrays(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(sig);
}

// ── VAPID: builds the "Authorization: vapid t=..., k=..." header ──
async function buildVapidHeader(audience, subject, vapidPublicKeyB64Url, vapidPrivateKeyJwk) {
  const header = { typ: "JWT", alg: "ES256" };
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours, well under the 24h max
  const payload = { aud: audience, exp, sub: subject };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: vapidPrivateKeyJwk.d, x: vapidPrivateKeyJwk.x, y: vapidPrivateKeyJwk.y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(unsignedToken)
  );
  const signatureB64 = uint8ArrayToBase64Url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  return `vapid t=${jwt}, k=${vapidPublicKeyB64Url}`;
}

// ── Message encryption: RFC 8291 aes128gcm content-encoding ──
async function encryptPayload(payloadObj, p256dhKeyB64Url, authKeyB64Url) {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(payloadObj));

  const uaPublicKeyBytes = base64UrlToUint8Array(p256dhKeyB64Url); // subscriber's public key
  const authSecret = base64UrlToUint8Array(authKeyB64Url);

  // Ephemeral ECDH key pair for this message only
  const asKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const uaPublicKey = await crypto.subtle.importKey(
    "raw", uaPublicKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256
  );
  const ecdhSecret = new Uint8Array(sharedSecretBits);

  const encoder2 = new TextEncoder();

  // PRK_key = HMAC-SHA256(key=auth_secret, data=ecdh_secret)
  const prkKey = await hmacSha256(authSecret, ecdhSecret);

  // key_info = "WebPush: info" || 0x00 || ua_public || as_public
  const keyInfo = concatUint8Arrays(
    encoder2.encode("WebPush: info"), new Uint8Array([0]), uaPublicKeyBytes, asPublicKeyRaw
  );
  const ikm = (await hmacSha256(prkKey, concatUint8Arrays(keyInfo, new Uint8Array([1])))).slice(0, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);

  const cekInfo = concatUint8Arrays(encoder2.encode("Content-Encoding: aes128gcm"), new Uint8Array([0]));
  const cek = (await hmacSha256(prk, concatUint8Arrays(cekInfo, new Uint8Array([1])))).slice(0, 16);

  const nonceInfo = concatUint8Arrays(encoder2.encode("Content-Encoding: nonce"), new Uint8Array([0]));
  const nonce = (await hmacSha256(prk, concatUint8Arrays(nonceInfo, new Uint8Array([1])))).slice(0, 12);

  // Plaintext gets a single 0x02 delimiter byte appended (last/only record, no further padding)
  const paddedPlaintext = concatUint8Arrays(plaintext, new Uint8Array([2]));

  const cekCryptoKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekCryptoKey, paddedPlaintext)
  );

  // Header: salt (16) || record_size uint32BE (4) || key_id_length (1) || key_id (65)
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const keyIdLength = new Uint8Array([asPublicKeyRaw.length]);

  return concatUint8Arrays(salt, recordSize, keyIdLength, asPublicKeyRaw, ciphertext);
}

// ── Public entry point: sends one push message to one subscription ──
export async function sendWebPush(subscription, payloadObj, vapid) {
  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const [authHeader, body] = await Promise.all([
    buildVapidHeader(audience, vapid.subject, vapid.publicKey, vapid.privateKeyJwk),
    encryptPayload(payloadObj, subscription.p256dh_key, subscription.auth_key),
  ]);

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
      Authorization: authHeader,
    },
    body,
  });

  return { ok: res.ok, status: res.status, expired: res.status === 404 || res.status === 410 };
}
