// /api/check-email.js
// ExposureShield — HIBP breach check (production-safe, correct headers, full details)

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  // 1) Only allow GET
  if ((req.method || "GET") !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // 2) Validate email
  const email = (req.query.email || "").toString().trim();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ ok: false, error: "Valid email parameter is required" });
  }

  // 3) Read API key from Vercel env var
  const apiKey = (process.env.HIBP_API_KEY || "").toString().trim();
  if (!apiKey) {
    // Do not leak secrets, just log a generic message
    console.error("HIBP_API_KEY environment variable is not set.");
    return res.status(500).json({ ok: false, error: "Server configuration error" });
  }

  // 4) Call HIBP API (full details for UI: Domain, BreachDate, DataClasses, etc.)
  const hibpUrl =
    `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}` +
    `?truncateResponse=false`;

  // 5) Timeout protection
  const controller = new AbortController();
  const timeoutMs = 15000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const hibpResponse = await fetch(hibpUrl, {
      method: "GET",
      headers: {
        // IMPORTANT: must be exactly "hibp-api-key"
        "hibp-api-key": apiKey,
        // IMPORTANT: HIBP requires a User-Agent
        "user-agent": "ExposureShield (support@exposureshield.com)",
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    // 6) Handle "no breaches" (HIBP uses 404 for not found)
    if (hibpResponse.status === 404) {
      return res.status(200).json({ ok: true, email, breaches: [] });
    }

    // 7) Parse response body (JSON if possible, else text)
    const contentType = (hibpResponse.headers.get("content-type") || "").toLowerCase();
    const body = contentType.includes("application/json")
      ? await hibpResponse.json().catch(() => null)
      : await hibpResponse.text().catch(() => null);

    // 8) Handle HIBP errors (401, 429, etc.)
    if (!hibpResponse.ok) {
      const detail =
        typeof body === "string"
          ? body
          : body
          ? JSON.stringify(body)
          : "No response body";

      console.error(`HIBP API error ${hibpResponse.status}:`, detail);

      return res.status(hibpResponse.status).json({
        ok: false,
        error: `HIBP API error: ${hibpResponse.status}`,
        detail,
        breaches: [],
      });
    }

    // 9) Success — HIBP returns an array of breaches
    const breaches = Array.isArray(body) ? body : [];
    return res.status(200).json({ ok: true, email, breaches });
  } catch (error) {
    const isAbort = error && (error.name === "AbortError" || String(error).includes("AbortError"));
    console.error("Failed to call HIBP API:", error);

    return res.status(isAbort ? 504 : 500).json({
      ok: false,
      error: isAbort ? "HIBP request timed out. Please try again." : "Internal server error. Please try again later.",
      breaches: [],
    });
  } finally {
    clearTimeout(timeout);
  }
}
