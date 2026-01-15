// api/cron/monitor.js - UPDATED: Allow manual testing with secret
export default async function handler(req, res) {
  try {
    // Get environment
    const isProd = process.env.VERCEL_ENV === "production";
    const isVercelCron = req.headers["x-vercel-cron"] === "1";
    
    // Check CRON_SECRET for manual testing (ALWAYS required)
    const expected = process.env.CRON_SECRET || "";
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const querySecret = req.query.secret || "";
    const secret = bearer || querySecret;
    
    // ALLOW if: Vercel Cron OR correct secret
    const isAuthorized = isVercelCron || (expected && secret === expected);
    
    if (!isAuthorized) {
      const errorMsg = isProd 
        ? "Forbidden: Use ?secret=YOUR_SECRET or Vercel Cron" 
        : "Unauthorized: Add ?secret=YOUR_SECRET to URL";
      
      return res.status(isProd ? 403 : 401).json({ 
        ok: false, 
        error: errorMsg,
        hint: `Add ?secret=YOUR_SECRET to URL or use Vercel Cron headers`
      });
    }
    
    console.log("🚀 Essential monitoring triggered by:", isVercelCron ? "Vercel Cron" : "Manual");
    
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    const HIBP_API_KEY = process.env.HIBP_API_KEY;
    
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return res.status(500).json({ 
        ok: false, 
        error: "Upstash Redis not configured" 
      });
    }
    
    // Get active subscribers
    const membersRes = await fetch(`${UPSTASH_URL}/smembers/monitor:active`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` }
    });
    
    const membersData = await membersRes.json();
    const emails = Array.isArray(membersData?.result) ? membersData.result : [];
    
    const startTime = Date.now();
    let processed = 0;
    let alerted = 0;
    let errors = 0;
    
    // Process subscribers
    for (const email of emails.slice(0, 10)) { // Limit to 10 for testing
      try {
        processed++;
        
        if (HIBP_API_KEY) {
          const hibpRes = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`,
            {
              headers: {
                "hibp-api-key": HIBP_API_KEY,
                "User-Agent": "ExposureShield-Essential/1.0"
              }
            }
          );
          
          if (hibpRes.status === 200) {
            alerted++;
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1600));
        
      } catch (error) {
        errors++;
        console.error(`Error checking ${email}:`, error.message);
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const result = {
      ok: true,
      status: "completed",
      summary: {
        totalSubscribers: emails.length,
        processed,
        alerted,
        errors,
        durationSeconds: duration
      },
      timestamp: new Date().toISOString(),
      triggeredBy: isVercelCron ? "vercel-cron" : "manual",
      environment: process.env.VERCEL_ENV || "development"
    };
    
    // Store in Redis
    await fetch(`${UPSTASH_URL}/set/monitor:last/${encodeURIComponent(JSON.stringify(result))}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` }
    });
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error("❌ Cron job error:", error);
    return res.status(500).json({
      ok: false,
      error: "Monitoring failed",
      message: error.message
    });
  }
}