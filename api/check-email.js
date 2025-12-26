// api/check-email.js
// CommonJS version (most compatible on Vercel)
// Calls Have I Been Pwned (HIBP) with required headers.

module.exports = async (req, res) => {
  try {
    // Only allow GET
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const email = (req.query?.email || "").toString().trim();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Valid email parameter is required" });
    }

    const apiKey = (process.env.HIBP_API_KEY || "").toString().trim();
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "Server missing HIBP_API_KEY" });
    }

    const hibpUrl =
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}` +
      `?truncateResponse=false`;

    const hibpResponse = await fetch(hibpUrl, {
      method: "GET",
      headers: {
        // Header name must be EXACT
        "hibp-api-key": apiKey,
        // HIBP requires a user agent
        "user-agent": "ExposureShield (support@exposureshield.com)",
        "accept": "application/json",
      },
    });

    // 404 means "no breaches" in HIBP (normal)
    if (hibpResponse.status === 404) {
      return res.status(200).json({ ok: true, email, breaches: [] });
    }

    const bodyText = await hibpResponse.text();

    // If HIBP returned an error
    if (!hibpResponse.ok) {
      return res.status(hibpResponse.status).json({
        ok: false,
        error: `HIBP API error: ${hibpResponse.status}`,
        detail: bodyText,
        breaches: [],
      });
    }

    // Success: parse breaches array
    let breaches = [];
    try {
      const parsed = JSON.parse(bodyText);
      breaches = Array.isArray(parsed) ? parsed : [];
    } catch {
      // If parse fails, return raw text for debugging
      return res.status(502).json({
        ok: false,
        error: "Invalid JSON from HIBP",
        detail: bodyText,
        breaches: [],
      });
    }

    return res.status(200).json({ ok: true, email, breaches });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Function crash (FUNCTION_INVOCATION_FAILED)",
      detail: String(err?.stack || err?.message || err),
      breaches: [],
    });
  }
};
