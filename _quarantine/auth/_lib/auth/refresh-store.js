// api/_lib/auth/refresh-store.js
// Vercel-safe refresh token storage using Upstash Redis REST.
// Requires env vars:
// - UPSTASH_REDIS_REST_URL
// - UPSTASH_REDIS_REST_TOKEN

const crypto = require("crypto");

const PREFIX = "refresh:";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function getEnv(name) {
  return String(process.env[name] || "").trim();
}

async function upstashRequest(path) {
  const urlBase = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");

  if (!urlBase || !token) {
    const missing = [];
    if (!urlBase) missing.push("UPSTASH_REDIS_REST_URL");
    if (!token) missing.push("UPSTASH_REDIS_REST_TOKEN");
    throw new Error("Missing Upstash env vars: " + missing.join(", "));
  }

  const url = urlBase.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token }
  });

  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Upstash returned non-JSON: " + text);
  }

  if (!r.ok) {
    throw new Error("Upstash HTTP " + r.status + ": " + text);
  }
  if (data.error) {
    throw new Error("Upstash error: " + data.error);
  }
  return data;
}

/**
 * Stores refresh token metadata keyed by a HASH of the refresh token.
 * Never stores the raw refresh token as a Redis key.
 */
async function storeRefreshToken(refreshToken, meta = {}, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!refreshToken) throw new Error("Missing refreshToken");

  const tokenHash = sha256(refreshToken);
  const key = PREFIX + tokenHash;

  const record = {
    tokenHash,
    userId: meta.userId || null,
    email: meta.email || null,
    createdAt: meta.createdAt || new Date().toISOString(),
    ...meta
  };

  const value = encodeURIComponent(JSON.stringify(record));
  const ex = Number(ttlSeconds) || DEFAULT_TTL_SECONDS;

  // Upstash REST: SET key value EX seconds
  // Endpoint form: /set/<key>/<value>?EX=<seconds>
  await upstashRequest(`/set/${encodeURIComponent(key)}/${value}?EX=${ex}`);

  return { ok: true, key, tokenHash, ttlSeconds: ex };
}

/**
 * Optional: revoke refresh token by deleting the hashed key.
 */
async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) throw new Error("Missing refreshToken");

  const tokenHash = sha256(refreshToken);
  const key = PREFIX + tokenHash;

  // Upstash REST: DEL key
  await upstashRequest(`/del/${encodeURIComponent(key)}`);

  return { ok: true, key, tokenHash };
}

module.exports = {
  storeRefreshToken,
  revokeRefreshToken
};
