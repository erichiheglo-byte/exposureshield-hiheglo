// api/admin/trigger-monitoring.js
// Manually trigger monitoring for all Essential subscribers

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
        error: "Unauthorized" 
      });
    }

    // This endpoint triggers the actual monitoring
    // You can call your existing monitoring endpoint
    const monitoringUrl = `https://${req.headers.host || process.env.VERCEL_URL}/api/essential/monitor`;
    
    const monitoringResponse = await fetch(monitoringUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${expected}`,
        "Content-Type": "application/json"
      }
    });

    const monitoringResult = await monitoringResponse.json();
    
    return res.status(monitoringResponse.status).json({
      ok: monitoringResponse.ok,
      triggered: true,
      monitoringResult,
      _meta: {
        timestamp: new Date().toISOString(),
        endpoint: monitoringUrl
      }
    });

  } catch (error) {
    console.error("❌ Trigger monitoring error:", error);
    return res.status(500).json({ 
      ok: false, 
      error: "Server error",
      message: error.message 
    });
  }
}