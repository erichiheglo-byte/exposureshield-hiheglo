// api/_lib/store.js
// Persistent user store using Upstash Redis (REST over HTTP).
// IMPORTANT: This module must never crash auth endpoints.
// If Upstash is misconfigured or unavailable, it falls back to in-memory for the invocation.
//
// Env vars supported:
//
// Option A (Upstash REST):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// Option B (Vercel KV / Upstash KV):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN
//
// Note: Vercel Node runtimes support global fetch.

const mem = new Map();

function getRestUrl() {
  return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
}
function getRestToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
}
function upstashReady() {
  return Boolean(getRestUrl() && getRestToken());
}

function emailKey(email) {
  return `user:${String(email).toLowerCase().trim()}`;
}
function idKey(id) {
  return `user_id:${String(id).trim()}`;
}

async function safeUpstashGet(key) {
  try {
    const base = getRestUrl();
    const token = getRestToken();
    const url = `${base}/get/${encodeURIComponent(key)}`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error(`Upstash GET failed (${r.status}): ${body}`);
      return null; // do NOT throw
    }

    const j = await r.json().catch(() => null);
    return j?.result ?? null;
  } catch (e) {
    console.error("Upstash GET error:", e && e.message ? e.message : e);
    return null; // do NOT throw
  }
}

async function safeUpstashSet(key, value) {
  try {
    const base = getRestUrl();
    const token = getRestToken();
    const url = `${base}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error(`Upstash SET failed (${r.status}): ${body}`);
      return false; // do NOT throw
    }

    return true;
  } catch (e) {
    console.error("Upstash SET error:", e && e.message ? e.message : e);
    return false; // do NOT throw
  }
}

async function getUserByEmail(email) {
  const eKey = emailKey(email);

  if (upstashReady()) {
    const raw = await safeUpstashGet(eKey);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }

  return mem.get(eKey) || null;
}

async function getUserById(id) {
  const iKey = idKey(id);

  if (upstashReady()) {
    const email = await safeUpstashGet(iKey);
    if (email) return await getUserByEmail(email);
  }

  const email = mem.get(iKey);
  if (!email) return null;
  return mem.get(emailKey(email)) || null;
}

async function createUser(user) {
  const email = String(user.email || "").toLowerCase().trim();
  const eKey = emailKey(email);
  const iKey = idKey(user.id);

  if (upstashReady()) {
    const ok1 = await safeUpstashSet(eKey, JSON.stringify(user));
    const ok2 = await safeUpstashSet(iKey, email);
    if (ok1 && ok2) return true;
    // If Upstash fails, fall back to mem for this invocation
  }

  mem.set(eKey, user);
  mem.set(iKey, email);
  return true;
}

module.exports = { getUserByEmail, getUserById, createUser };
