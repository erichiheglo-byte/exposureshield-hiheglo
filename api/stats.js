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
    stats: {
      totalBreachesInSystem: 13000, // Approximate number in HIBP
      monitoredEmails: "10M+",
      lastUpdated: new Date().toISOString(),
      apiVersion: "v3",
      responseTime: "~200ms"
    },
    timestamp: new Date().toISOString()
  }));
};
