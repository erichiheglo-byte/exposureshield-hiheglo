const { applyCors } = require("./_lib/cors.js");

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
    "Use an alias email for non-essential services",
    "Regularly check haveibeenpwned.com for new breaches",
    "Consider using a privacy-focused email service"
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

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const email = (url.searchParams.get("email") || "").toString().trim();

    if (!email) return send(res, 400, { ok: false, error: "Missing email parameter." });

    const apiKey = (process.env.HIBP_API_KEY || "").toString().trim();
    if (!apiKey) {
      return send(res, 500, { ok: false, error: "HIBP_API_KEY not configured" });
    }

    const hibpUrl =
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;

    const r = await fetch(hibpUrl, {
      method: "GET",
      headers: {
        "hibp-api-key": apiKey,
        "user-agent": "ExposureShield (support@exposureshield.com)",
        "accept": "application/json"
      }
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
    const securityScore = calculateSecurityScore(breachCount);
    const status = getStatus(securityScore);
    
    return send(res, 200, { 
      ok: true, 
      email, 
      breaches,
      breachCount,
      securityScore,
      status,
      message: `${breachCount} data breach${breachCount === 1 ? '' : 'es'} found`,
      recommendations: getRecommendations(breachCount),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("check-email error:", err);
    return send(res, 500, { ok: false, error: "Unable to check email security. Please try again." });
  }
};
