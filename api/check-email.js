const { applyCors } = require("./_lib/cors.js");

// Rate limiting setup...
const requestCounts = new Map();
const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 1000;

function rateLimit(ip) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip);
  while (requests.length && requests[0] < windowStart) {
    requests.shift();
  }
  
  if (requests.length >= RATE_LIMIT) {
    return false;
  }
  
  requests.push(now);
  return true;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         'unknown';
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function calculateSecurityScore(breachCount) {
  if (breachCount === 0) return 100;
  if (breachCount <= 5) return 80;
  if (breachCount <= 20) return 60;
  if (breachCount <= 50) return 40;
  if (breachCount <= 100) return 20;
  return 10;
}

function getStatus(score) {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  if (score >= 20) return "poor";
  return "critical";
}

function getRecommendations(breachCount) {
  const recommendations = [
    "Use a password manager to generate and store unique passwords",
    "Enable two-factor authentication on all important accounts",
    "Use an alias email for non-essential services"
  ];
  
  if (breachCount > 0) {
    recommendations.unshift("Change passwords for breached services immediately");
  }
  
  if (breachCount > 10) {
    recommendations.push("Consider a credit monitoring service");
  }
  
  return recommendations;
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "GET,OPTIONS")) return;

  if (req.method !== "GET") {
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  if (!rateLimit(clientIP)) {
    return send(res, 429, { 
      ok: false, 
      error: "Too many requests. Please try again in a minute.",
      retryAfter: 60
    });
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const email = (url.searchParams.get("email") || "").toString().trim();

    if (!email) return send(res, 400, { ok: false, error: "Missing email parameter." });

    const apiKey = (process.env.HIBP_API_KEY || "").toString().trim();
    if (!apiKey) {
      return send(res, 500, { ok: false, error: "HIBP_API_KEY not configured" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return send(res, 400, { ok: false, error: "Invalid email format." });
    }

    const hibpUrl =
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;

    const r = await fetch(hibpUrl, {
      method: "GET",
      headers: {
        "hibp-api-key": apiKey,
        "user-agent": "ExposureShield (support@exposureshield.com)",
        "accept": "application/json"
      },
      timeout: 10000
    });

    if (r.status === 404) {
      return send(res, 200, { 
        ok: true, 
        email, 
        breaches: [],
        breachCount: 0, // EXPLICIT: breaches.length (which is 0)
        securityScore: 100,
        status: "excellent",
        message: "No breaches found. Your email appears secure!",
        recommendations: getRecommendations(0),
        timestamp: new Date().toISOString()
      });
    }

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return send(res, r.status, { ok: false, error: "HIBP request failed", details: text.slice(0, 200) });
    }

    const breaches = await r.json();
    
    // GUARANTEED CONSISTENCY: breachCount ALWAYS equals breaches.length
    const breachCount = breaches.length; // EXPLICIT AND GUARANTEED
    
    // Sort breaches by date (newest first)
    breaches.sort((a, b) => new Date(b.BreachDate || b.breachDate) - new Date(a.BreachDate || a.breachDate));
    
    const securityScore = calculateSecurityScore(breachCount);
    const status = getStatus(securityScore);
    
    return send(res, 200, { 
      ok: true, 
      email, 
      breaches: breaches.slice(0, 50), // Limit for performance
      breachCount, // GUARANTEED: equals breaches.length
      securityScore,
      status,
      message: `${breachCount} data breach${breachCount === 1 ? '' : 'es'} found`,
      recommendations: getRecommendations(breachCount),
      timestamp: new Date().toISOString(), // ISO 8601, always
      rateLimit: {
        remaining: RATE_LIMIT - (requestCounts.get(clientIP)?.length || 0),
        reset: Math.ceil((WINDOW_MS - (Date.now() - (requestCounts.get(clientIP)?.[0] || Date.now()))) / 1000)
      }
    });
  } catch (err) {
    console.error("check-email error:", err);
    return send(res, 500, { 
      ok: false, 
      error: "Unable to check email security. Please try again.",
      code: err.name
    });
  }
};
