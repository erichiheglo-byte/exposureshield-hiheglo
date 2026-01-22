/**
 * Admin: List Essential subscribers (fast + safe)
 * - Exports a CommonJS handler function (module.exports = handler)
 * - Adds request timeouts
 * - Uses limited concurrency to avoid 5-minute function timeouts
 */

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getEnv() {
  // Support both naming styles
  const UPSTASH_URL =
    process.env.UPSTASH_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    "";

  const UPSTASH_TOKEN =
    process.env.UPSTASH_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    "";

  return { UPSTASH_URL, UPSTASH_TOKEN };
}

async function fetchWithTimeout(url, options, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// Simple concurrency limiter (no extra deps)
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;

  async function runOne() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, runOne);
  await Promise.all(runners);
  return results;
}

// IMPORTANT: You may already have an admin auth check; if so, keep it.
// This is a minimal guard: requires Authorization header to exist.
// Replace with your real admin validation if needed.
function requireAuthHeader(req) {
  const h = req.headers || {};
  const auth = h.authorization || h.Authorization || "";
  return typeof auth === "string" && auth.startsWith("Bearer ");
}

async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }

    // If you do NOT want auth here, remove this block.
    // Keeping it prevents public access to subscriber list.
    if (!requireAuthHeader(req)) {
      return json(res, 401, { ok: false, error: "Missing Authorization: Bearer " });
    }

    const { UPSTASH_URL, UPSTASH_TOKEN } = getEnv();
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return json(res, 500, { ok: false, error: "Missing Upstash env vars" });
    }

    // ------------------------------------------------------------
    // STEP A: get the email list
    // You likely store subscriber emails somewhere (set/list).
    // This example assumes a Redis SET key: "subscribers:essential"
    // Adjust ONLY this key if your actual key is different.
    // ------------------------------------------------------------
    const listKey = "subscribers:essential";

    const emailsRes = await fetchWithTimeout(`${UPSTASH_URL}/smembers/${encodeURIComponent(listKey)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const emailsData = await emailsRes.json().catch(() => null);
    const emails = Array.isArray(emailsData?.result) ? emailsData.result : [];

    // Cap for safety/performance
    const limited = emails.slice(0, 50);

    // ------------------------------------------------------------
    // STEP B: fetch user records in parallel (limited concurrency)
    // ------------------------------------------------------------
    const subscribers = [];

    const userJsons = await mapLimit(limited, 10, async (email) => {
      const url = `${UPSTASH_URL}/get/user:essential:${encodeURIComponent(email)}`;
      const r = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.result) return null;

      try {
        return JSON.parse(j.result);
      } catch {
        return null;
      }
    });

    for (const user of userJsons) {
      if (!user) continue;
      subscribers.push({
        email: user.email,
        plan: user.plan || "essential",
        status: user.status || "unknown",
        enabled: !!user.enabled,
        createdAt: user.createdAt,
        lastCheckedAt: user.lastCheckedAt,
        breachCount: user.breachCount || 0,
        alertsSent: user.alertsSent || 0,
        subscriptionId: user.subscriptionId,
        isTest: !!user.test,
      });
    }

    return json(res, 200, {
      ok: true,
      count: subscribers.length,
      key: listKey,
      subscribers,
    });
  } catch (err) {
    console.error("list-subscribers failed:", err && (err.stack || err));
    return json(res, 500, { ok: false, error: "list_subscribers_failed" });
  }
}

module.exports = handler;
