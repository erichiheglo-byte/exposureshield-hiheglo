// api/admin/send-test-alert.js
export default async function handler(req, res) {
  try {
    const expected = process.env.CRON_SECRET || "";
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const querySecret = req.query.secret || "";
    const secret = bearer || querySecret;
    
    if (!expected || secret !== expected) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const email = (req.query.email || "").toString().trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Missing or invalid email" });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.ALERT_FROM_EMAIL || "alerts@exposureshield.com";
    
    if (!RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: "RESEND_API_KEY not configured" });
    }

    const emailData = {
      from: `ExposureShield Alerts <${FROM_EMAIL}>`,
      to: email,
      subject: "✅ ExposureShield Test Alert - Essential Monitoring",
      html: `<h2>Test Alert Successful</h2><p>Your Essential monitoring system is working!</p>`
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailData)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: "Resend failed", details: data });
    }

    return res.status(200).json({
      ok: true,
      message: "Test alert sent successfully",
      email,
      resendId: data.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({ ok: false, error: "Server error", message: error.message });
  }
}
