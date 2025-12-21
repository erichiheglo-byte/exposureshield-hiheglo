// api/check-email.js
// Accepts BOTH GET and POST.
// Returns normalized JSON: { ok: true, breaches: [...] }

const HIBP_API_BASE = "https://haveibeenpwned.com/api/v3";

function send(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.json(body);
}

function readEmail(req) {
  const q = (req.query?.email || req.query?.q || "").toString().trim();
  if (q) return q;

  const b = (req.body?.email || "").toString().trim();
  return b || "";
}

export default async function handler(req, res) {
  try {
    // Allow GET and POST only
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return send(res, 405, { ok: false, error: "Method not allowed" });
    }

    const email = readEmail(req);
    if (!email) {
      return send(res, 400, { ok: false, error: "Missing email parameter." });
    }

    const apiKey = process.env.HIBP_API_KEY;
    if (!apiKey) {
      return send(res, 500, { ok: false, error: "Missing HIBP_API_KEY on server." });
    }

    const url = `${HIBP_API_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "hibp-api-key": apiKey,
        "user-agent": "ExposureShield (contact@exposureshield.com)",
        "accept": "application/json",
      },
    });

    // HIBP: 404 means no breaches for that account
    if (r.status === 404) {
      return send(res, 200, { ok: true, breaches: [] });
    }

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return send(res, r.status, {
        ok: false,
        error: `HIBP request failed (${r.status}).`,
        detail: text.slice(0, 200),
      });
    }

    const breaches = await r.json().catch(() => []);
    return send(res, 200, { ok: true, breaches: Array.isArray(breaches) ? breaches : [] });
  } catch (err) {
    return send(res, 500, { ok: false, error: "Server error.", detail: String(err?.message || err) });
  }
}
