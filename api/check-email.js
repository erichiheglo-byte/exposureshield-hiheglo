// api/check-email.js
// ExposureShield — HIBP breach check (Node runtime, correct headers, robust responses)

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  try {
    // Only allow GET (optional but cleaner)
    if (req.method && req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed." });
    }

    const email = (req.query.email || "").toString().trim();
    if (!email) {
      return res.status(400).json({ ok: false, error: "Missing email parameter." });
    }

    const apiKey = (process.env.HIBP_API_KEY || "").toString().trim();
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "Server missing HIBP_API_KEY." });
    }

    // HIBP endpoint (breached account)
    // Use truncateResponse=true for smaller payload and faster response
    const hibpUrl =
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}` +
      `?truncateResponse=true`;

    // Timeout protection
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let hibpRes;
    try {
      hibpRes = await fetch(hibpUrl, {
        method: "GET",
        headers: {
          // IMPORTANT: header name must be exactly hibp-api-key
          "hibp-api-key": apiKey,
          // IMPORTANT: user-agent is required by HIBP
          "user-agent": "ExposureShield (support@exposureshield.com)",
          accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // If no breaches, HIBP returns 404 (normal)
    if (hibpRes.status === 404) {
      return res.status(200).json({ ok: true, breaches: [] });
    }

    // Try JSON first, fall back to text
    const contentType = (hibpRes.headers.get("content-type") || "").toLowerCase();
    const rawBody = contentType.includes("application/json")
      ? await hibpRes.json().catch(() => null)
      : await hibpRes.text().catch(() => null);

    if (!hibpRes.ok) {
      return res.status(hibpRes.status).json({
        ok: false,
        error: `HIBP API error: ${hibpRes.status}`,
        detail:
          typeof rawBody === "string"
            ? rawBody
            : rawBody
            ? JSON.stringify(rawBody)
            : "No response body",
        breaches: [],
      });
    }

    // HIBP returns an array of breaches on success
    const breaches = Array.isArray(rawBody) ? rawBody : [];
    return res.status(200).json({ ok: true, breaches });
  } catch (err) {
    const isAbort = err && (err.name === "AbortError" || String(err).includes("AbortError"));
    return res.status(isAbort ? 504 : 500).json({
      ok: false,
      error: isAbort ? "HIBP request timed out." : "Server error.",
      detail: String(err?.message || err),
      breaches: [],
    });
  }
}
