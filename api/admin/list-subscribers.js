// api/admin/list-subscribers.js
// List all Essential subscribers

export default async function handler(req, res) {
  try {
    // AUTHENTICATION
    const expected = process.env.CRON_SECRET || "";
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const querySecret = req.query.secret || "";
    const secret = bearer || querySecret;
    
    if (!expected || secret !== expected) {
      return res.status(401).json({ 
        ok: false, 
        error: "Unauthorized",
        message: "Valid CRON_SECRET required" 
      });
    }

    // UPSTASH CONFIG
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "Upstash not configured"
      });
    }

    // GET ALL ACTIVE SUBSCRIBERS
    const membersResponse = await fetch(`${UPSTASH_URL}/smembers/monitor:active`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    const membersData = await membersResponse.json();
    
    if (!membersResponse.ok) {
      return res.status(membersResponse.status).json({
        ok: false,
        error: "Failed to fetch subscribers",
        details: membersData
      });
    }

    const emails = Array.isArray(membersData?.result) ? membersData.result : [];
    
    // GET DETAILS FOR EACH SUBSCRIBER
    const subscribers = [];
    
    for (const email of emails.slice(0, 50)) { // Limit to 50 for performance
      const userResponse = await fetch(`${UPSTASH_URL}/get/user:essential:${encodeURIComponent(email)}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${UPSTASH_TOKEN}`,
          "Content-Type": "application/json"
        }
      });
      
      const userData = await userResponse.json();
      
      if (userResponse.ok && userData?.result) {
        try {
          const user = JSON.parse(userData.result);
          subscribers.push({
            email: user.email,
            plan: user.plan || "essential",
            status: user.status || "unknown",
            enabled: user.enabled || false,
            createdAt: user.createdAt,
            lastCheckedAt: user.lastCheckedAt,
            breachCount: user.breachCount || 0,
            alertsSent: user.alertsSent || 0,
            subscriptionId: user.subscriptionId,
            isTest: user.test || false
          });
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return res.status(200).json({
      ok: true,
      count: subscribers.length,
      totalActive: emails.length,
      subscribers,
      summary: {
        active: emails.length,
        withDetails: subscribers.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("❌ List subscribers error:", error);
    return res.status(500).json({ 
      ok: false, 
      error: "Server error",
      message: error.message 
    });
  }
}