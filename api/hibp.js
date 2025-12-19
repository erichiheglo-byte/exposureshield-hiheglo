export default async function handler(req, res) {
  try {
    const email = (req.query.email || "").toString().trim();

    if (!email) {
      return res.status(400).json({ ok: false, error: "Missing email parameter." });
    }

    const apiKey = process.env.HIBP_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "HIBP_API_KEY is not set in Vercel environment variables."
      });
    }

    const url =
      "https://haveibeenpwned.com/api/v3/breachedaccount/" +
      encodeURIComponent(email) +
      "?truncateResponse=false";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "hibp-api-key": apiKey,
        "user-agent": "ExposureShield (contact@exposureshield.com)",
        "api-version": "3"
      }
    });

    // HIBP uses 404 = no breaches
    if (response.status === 404) {
  // Cache "no breaches" too (safe and reduces repeated calls)
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ ok: true, breaches: [] });
}


    if (!response.ok) {
      const text = await response.text();
      res.setHeader("Cache-Control", "no-store");

      return res.status(response.status).json({
        ok: false,
        error: "HIBP request failed",
        status: response.status,
        details: text
      });
    }

    const breaches = await response.json();
    // Cache breach results at the edge for 1 hour; allow stale up to 24h while revalidating
res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

    return res.status(200).json({ ok: true, breaches });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err)
    });
  }
}
