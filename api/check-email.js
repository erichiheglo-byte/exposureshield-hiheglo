const { applyCors } = require("./_lib/cors.js");

// Simple in-memory rate limiter (use Redis in production)
const requestCounts = new Map();
const RATE_LIMIT = 10; // requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute

function rateLimit(ip) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip);
  // Remove old requests
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

    // Don't allow disposable/temp emails (basic check)
    const disposableDomains = [
      "tempmail.com", "mailinator.com", "10minutemail.com", 
      "guerrillamail.com", "yopmail.com", "trashmail.com"
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (disposableDomains.some(d => domain.includes(d))) {
      return send(res, 400, { 
        ok: false, 
        error: "Disposable email addresses are not supported for security checks." 
      });
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
      timeout: 10000 // 10 second timeout
    });

    if (r.status === 404) {
      return send(res, 200, { 
        ok: true, 
        email, 
        breaches: [],
        breachCount: 0,
        securityScore: 100,
        status: "excellent",
        message: "No breaches found. Your email appears secure!",
        recommendations: ["Continue using strong, unique passwords", "Enable two-factor authentication"],
        timestamp: new Date().toISOString()
      });
    }

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return send(res, r.status, { ok: false, error: "HIBP request failed", details: text.slice(0, 200) });
    }

    const breaches = await r.json();
    const breachCount = breaches.length;
    const securityScore = 100 - Math.min(breachCount * 2, 90); // Simple scoring
    const status = securityScore >= 80 ? "excellent" : 
                   securityScore >= 60 ? "good" : 
                   securityScore >= 40 ? "fair" : 
                   securityScore >= 20 ? "poor" : "critical";
    
    // Sort breaches by date (newest first)
    breaches.sort((a, b) => new Date(b.BreachDate || b.breachDate) - new Date(a.BreachDate || a.breachDate));
    
    return send(res, 200, { 
      ok: true, 
      email, 
      breaches: breaches.slice(0, 50), // Limit to 50 breaches
      breachCount,
      securityScore,
      status,
      message: `${breachCount} data breach${breachCount === 1 ? '' : 'es'} found`,
      recommendations: [
        breachCount > 0 ? "Change passwords for breached services immediately" : "Continue good security practices",
        "Enable two-factor authentication on all important accounts",
        "Use a password manager to generate and store unique passwords",
        "Consider using email aliases for different services"
      ],
      timestamp: new Date().toISOString(),
      rateLimit: {
        remaining: RATE_LIMIT - requestCounts.get(clientIP).length,
        reset: Math.ceil((WINDOW_MS - (Date.now() - requestCounts.get(clientIP)[0])) / 1000)
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
