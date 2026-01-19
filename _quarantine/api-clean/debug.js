const { applyCors } = require("./_lib/cors.js");

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "GET,OPTIONS")) return;
  
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const email = (url.searchParams.get("email") || "").toString().trim();
    
    if (!email) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Missing email" }));
      return;
    }
    
    // Call your actual check-email endpoint
    const apiUrl = `https://www.exposureshield.com/api/check-email?email=${encodeURIComponent(email)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    // Add debug info
    const debugInfo = {
      ...data,
      _debug: {
        timestamp: new Date().toISOString(),
        apiEndpoint: apiUrl,
        requestHeaders: req.headers,
        rawBreachCount: data.breaches?.length || 0,
        breachNames: data.breaches?.map(b => b.Name || b.name) || []
      }
    };
    
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(debugInfo));
    
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ 
      error: "Debug endpoint failed", 
      details: err.message 
    }));
  }
};
