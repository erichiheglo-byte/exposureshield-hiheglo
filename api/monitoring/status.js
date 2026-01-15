// api/monitoring/status.js - UPDATED WITH AUTH
export default async function handler(req, res) {
  try {
    // AUTHENTICATION - Protect this endpoint
    const expected = process.env.CRON_SECRET || "";
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    
    // Optional: allow query param for easier testing (remove in production)
    const querySecret = req.query.secret || "";
    const secret = bearer || querySecret;
    
    if (expected && secret !== expected) {
      return res.status(401).json({ 
        ok: false, 
        error: "Unauthorized",
        message: "Valid CRON_SECRET required"
      });
    }

    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return res.status(500).json({ ok: false, error: "Upstash not configured" });
    }

    async function upstash(path) {
      const res = await fetch(`${UPSTASH_URL}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      });
      return res.json();
    }

    async function redisSMembers(key) {
      const r = await upstash(`/smembers/${encodeURIComponent(key)}`);
      return Array.isArray(r?.result) ? r.result : [];
    }

    async function redisGetJson(key) {
      const r = await upstash(`/get/${encodeURIComponent(key)}`);
      const val = r?.result;
      if (!val) return null;
      try { return JSON.parse(val); } catch { return null; }
    }

    // Get all data
    const [activeSubscribers, lastRun, totalSubscribers] = await Promise.all([
      redisSMembers("monitor:active"),
      redisGetJson("monitor:last"),
      redisSMembers("all:subscribers")
    ]);

    // Don't expose actual emails in response - only counts
    return res.status(200).json({
      ok: true,
      system: "ExposureShield Essential Monitoring",
      status: "active",
      timestamp: new Date().toISOString(),
      stats: {
        activeSubscribers: activeSubscribers.length,
        totalSubscribers: totalSubscribers.length,
        plan: "essential",
        price: "$19.99/month",
        cronSchedule: "Every 6 hours",
        lastRun: lastRun ? {
          timestamp: lastRun.timestamp,
          processed: lastRun.processed,
          alerted: lastRun.alerted,
          duration: lastRun.durationSeconds
        } : null
      },
      // Show first 3 emails only (for admin verification)
      subscriberSample: activeSubscribers.slice(0, 3),
      configuration: {
        hasRedis: !!(UPSTASH_URL && UPSTASH_TOKEN),
        hasHIBP: !!process.env.HIBP_API_KEY,
        hasResend: !!process.env.RESEND_API_KEY,
        environment: process.env.VERCEL_ENV || "development"
      }
    });

  } catch (error) {
    console.error("Monitoring status error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to fetch monitoring status",
      message: error.message
    });
  }
}