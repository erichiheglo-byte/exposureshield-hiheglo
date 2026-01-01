const { applyCors } = require("./_lib/cors.js");

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "GET,OPTIONS")) return;
  
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ 
    ok: true, 
    service: "ExposureShield API",
    version: "1.0.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
    endpoints: [
      "/api/check-email",
      "/api/health",
      "/api/stats"
    ]
  }));
};
