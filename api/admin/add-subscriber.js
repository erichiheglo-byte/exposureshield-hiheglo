// api/admin/add-subscriber.js
// Secure endpoint to add test subscribers to Essential monitoring

export default async function handler(req, res) {
  try {
    // 1. AUTHENTICATION - Use your existing CRON_SECRET
    const expected = process.env.CRON_SECRET || "";
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    
    // For testing, also accept query param (but prioritize header)
    const querySecret = req.query.secret || "";
    const secret = bearer || querySecret;
    
    if (!expected || secret !== expected) {
      return res.status(401).json({ 
        ok: false, 
        error: "Unauthorized",
        message: "Valid CRON_SECRET required in Authorization header" 
      });
    }

    // 2. VALIDATE EMAIL
    const email = (req.query.email || req.body?.email || "").toString().trim().toLowerCase();
    
    if (!email) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing email parameter",
        usage: "GET /api/admin/add-subscriber?email=user@example.com&secret=YOUR_SECRET"
      });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid email format" 
      });
    }

    // 3. CHECK UPSTASH ENV VARS
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "Server configuration error",
        message: "Upstash Redis is not configured",
        missing: [
          !UPSTASH_URL ? "UPSTASH_REDIS_REST_URL" : null,
          !UPSTASH_TOKEN ? "UPSTASH_REDIS_REST_TOKEN" : null,
        ].filter(Boolean),
      });
    }

    // 4. CREATE USER DATA FOR ESSENTIAL MONITORING
    const subscriptionId = `test-sub-${Date.now()}`;
    const userData = {
      email,
      plan: "essential",
      subscriptionId,
      status: "active",
      enabled: true,
      createdAt: new Date().toISOString(),
      lastCheckedAt: null,
      lastBreachHash: null,
      breaches: [],
      breachCount: 0,
      lastAlertAt: null,
      alertsSent: 0,
      source: "admin-test",
      test: true
    };

    // 5. EXECUTE MULTIPLE REDIS COMMANDS
    // We'll send multiple commands in a pipeline
    const commands = [
      // Add to subscribers set
      ["SADD", "monitor:active", email],
      // Set user data
      ["SET", `user:essential:${email}`, JSON.stringify(userData)],
      // Set subscription mapping
      ["SET", `subscription:${subscriptionId}`, email],
      // Add to all subscribers list
      ["SADD", "all:subscribers", email]
    ];

    const pipelineResponse = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(commands)
    });

    const pipelineResult = await pipelineResponse.json();
    
    if (!pipelineResponse.ok) {
      return res.status(pipelineResponse.status).json({
        ok: false,
        error: "Upstash pipeline failed",
        status: pipelineResponse.status,
        details: pipelineResult
      });
    }

    // 6. SUCCESS RESPONSE
    return res.status(200).json({
      ok: true,
      message: "✅ Test subscriber added to Essential monitoring",
      data: {
        email,
        plan: "essential",
        subscriptionId,
        monitoringActive: true,
        nextCheck: "Within 6 hours (cron schedule)",
        userKey: `user:essential:${email}`,
        setKey: "monitor:active"
      },
      redis: {
        commandsExecuted: commands.length,
        results: pipelineResult
      },
      _meta: {
        timestamp: new Date().toISOString(),
        price: "$19.99/month (test mode)",
        features: [
          "24/7 Dark Web Monitoring",
          "Real-time Breach Alerts",
          "Basic Identity Protection",
          "Password Security Audit"
        ]
      }
    });

  } catch (error) {
    console.error("❌ Admin endpoint error:", error);
    
    return res.status(500).json({ 
      ok: false, 
      error: "Server error",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
}