// api/_lib/jwt.js
import crypto from "crypto";

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlJson(obj) {
  return base64url(JSON.stringify(obj));
}

function signHmacSha256(data, secret) {
  return base64url(crypto.createHmac("sha256", secret).update(data).digest());
}

function base64urlToUtf8(b64url) {
  let b64 = String(b64url || "").replace(/-/g, "+").replace(/_/g, "/");
  // add padding
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  else if (pad !== 0) throw new Error("Invalid base64url");
  return Buffer.from(b64, "base64").toString("utf8");
}

export function signJwt(payload, secret, opts = {}) {
  const header = { alg: "HS256", typ: "JWT" };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.expiresInSeconds || 60 * 60 * 24 * 7); // default 7 days

  const fullPayload = { ...payload, iat: now, exp };

  const encodedHeader = base64urlJson(header);
  const encodedPayload = base64urlJson(fullPayload);

  const data = `${encodedHeader}.${encodedPayload}`;
  const sig = signHmacSha256(data, secret);

  return `${data}.${sig}`;
}

export function verifyJwt(token, secret) {
  if (!token || typeof token !== "string") throw new Error("Missing token");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expectedSig = signHmacSha256(data, secret);

  // Timing-safe compare
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(String(s || ""));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid signature");
  }

  const payloadJson = base64urlToUtf8(p);
  const payload = JSON.parse(payloadJson);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("Token expired");

  return payload;
}
