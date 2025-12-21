// api/hibp.js
// Compatibility alias for the HIBP email check.
// This keeps /api/hibp working while the main implementation lives in /api/check-email.

export default async function handler(req, res) {
  try {
    // Support either ?email= or ?q=
    const email = (req.query.email || req.query.q || "").toString().trim();

    if (!email) {
      return res.status(400).json({ ok: false, error: "Missing email parameter." });
    }

    // Call the same origin endpoint /api/check-email
    // NOTE: On Vercel, absolute URL is safer. We'll infer it from headers.
    const proto = (req.headers["x-forwarded-proto"] || "https").toString();
    const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();

    if (!host) {
      // Fallback: still try relative (works in many cases)
      const r = await fetch(`/api/check-email?email=${encodeURIComponent(email)}`);
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    const url = `${proto}://${host}/api/check-email?email=${encodeURIComponent(email)}`;
    const r = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json(
        data || { ok: false, error: `check-email failed (${r.status})` }
      );
    }

    // Return exactly what check-email returns (should include { ok, breaches, ... })
    return res.status(200).json(data || { ok: false, error: "Empty response from check-email." });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error.", detail: String(err?.message || err) });
  }
}
