// api/monitoring/status.js - Protected with email masking
export default async function handler(req, res) {
  try {
    // AUTHENTICATION REQUIRED
    const expected = process.env.CRON_SECRET || "";
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const secret = bearer || req.query.secret || "";
    
    if (!expected || secret !== expected) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return res.status(500).json({ ok: false, error: "Upstash not configured" });
    }

    // Get active subscribers
    const membersRes = await fetch(`${UPSTASH_URL}/smembers/monitor:active`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` }
    });
    
    const membersData = await membersRes.json();
    const emails = Array.isArray(membersData?.result) ? membersData.result : [];
    
    // Mask emails for privacy unless full=true
    const showFull = req.query.full === "true" || req.query.full === "1";
    const subscriberDisplay = showFull 
      ? emails 
      : emails.map(email => {
          const [user, domain] = email.split('@');
          return `${user.substring(0, 3)}***@${domain}`;
        });
    
    return res.status(200).json({
      ok: true,
      system: "ExposureShield Essential Monitoring",
      status: "active",
      timestamp: new Date().toISOString(),
      stats: {
        activeSubscribers: emails.length,
        plan: "essential",
        price: "$19.99/month",
        cronSchedule: "Every 6 hours",
        environment: process.env.VERCEL_ENV || "production"
      },
      subscribers: subscriberDisplay,
      subscriberCount: emails.length,
      _meta: {
        privacy: "Emails masked by default. Add ?full=1 to see full addresses.",
        requiresAuth: true
      }
    });
    
  } catch (error) {
    console.error("Monitoring status error:", error);
    return res.status(500).json({ ok: false, error: "Server error", message: error.message });
  }
}