// api/check-email.js - HIBP Email Security Check Endpoint
function applyCors(req, res, methods = "GET,OPTIONS") {
  const origin = req.headers.origin || "*";
  
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Requested-With, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function getQueryParam(req, param) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return url.searchParams.get(param) || "";
  } catch (err) {
    console.error("URL parsing error:", err);
    return "";
  }
}

export default async function handler(req, res) {
  // Apply CORS
  if (applyCors(req, res)) return;
  
  // Only allow GET requests
  if (req.method !== "GET") {
    return sendJson(res, 405, { 
      ok: false, 
      error: "Method not allowed. Only GET requests are accepted.",
      allowed: ["GET"]
    });
  }
  
  try {
    // Extract email from query parameter
    const rawEmail = getQueryParam(req, "email").trim();
    const email = rawEmail.toLowerCase();
    
    // Validate email
    if (!email) {
      return sendJson(res, 400, { 
        ok: false, 
        error: "Missing email parameter",
        usage: "/api/check-email?email=user@example.com"
      });
    }
    
    if (!email.includes("@") || !email.includes(".")) {
      return sendJson(res, 400, { 
        ok: false, 
        error: "Invalid email format",
        email: email
      });
    }
    
    // Get HIBP API key
    const hibpApiKey = (process.env.HIBP_API_KEY || "").toString().trim();
    if (!hibpApiKey) {
      console.error("HIBP_API_KEY is not configured");
      return sendJson(res, 500, { 
        ok: false, 
        error: "Security service configuration error",
        message: "Please contact support"
      });
    }
    
    // HIBP API endpoint
    const hibpUrl = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;
    
    console.log(`Checking HIBP for: ${email}`);
    
    // Call HIBP API
    const response = await fetch(hibpUrl, {
      method: "GET",
      headers: {
        "hibp-api-key": hibpApiKey,
        "user-agent": "ExposureShield/1.0 (https://www.exposureshield.com; support@exposureshield.com)",
        "Accept": "application/json"
      },
      timeout: 10000 // 10 second timeout
    });
    
    // Handle HIBP response
    if (response.status === 404) {
      // Email not found in breaches - GOOD!
      return sendJson(res, 200, {
        ok: true,
        email: email,
        breaches: [],
        message: "No known breaches found for this email",
        securityScore: 100,
        status: "secure"
      });
    }
    
    if (response.status === 429) {
      // Rate limited by HIBP
      return sendJson(res, 429, {
        ok: false,
        error: "Rate limited by security service",
        message: "Please try again in a few moments",
        email: email,
        status: "rate_limited"
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`HIBP API error ${response.status}: ${errorText}`);
      
      return sendJson(res, response.status, {
        ok: false,
        error: "Security check service error",
        statusCode: response.status,
        email: email,
        status: "service_error"
      });
    }
    
    // Parse breach data
    const breaches = await response.json();
    
    // Process breach data
    const processedBreaches = Array.isArray(breaches) ? breaches.map(breach => ({
      name: breach.Name || "Unknown",
      domain: breach.Domain || "",
      breachDate: breach.BreachDate || "",
      addedDate: breach.AddedDate || "",
      description: breach.Description || "",
      dataClasses: breach.DataClasses || [],
      isVerified: breach.IsVerified || false,
      isFabricated: breach.IsFabricated || false,
      isSensitive: breach.IsSensitive || false,
      isRetired: breach.IsRetired || false,
      isSpamList: breach.IsSpamList || false,
      logoPath: breach.LogoPath || ""
    })) : [];
    
    // Calculate security score (lower score = more breaches)
    const breachCount = processedBreaches.length;
    let securityScore = 100;
    
    if (breachCount > 0) {
      securityScore = Math.max(10, 100 - (breachCount * 15));
    }
    
    // Determine status
    let status = "secure";
    if (breachCount > 5) status = "critical";
    else if (breachCount > 2) status = "warning";
    else if (breachCount > 0) status = "compromised";
    
    return sendJson(res, 200, {
      ok: true,
      email: email,
      breaches: processedBreaches,
      breachCount: breachCount,
      securityScore: securityScore,
      status: status,
      message: breachCount === 1 ? 
        "1 data breach found" : 
        `${breachCount} data breaches found`,
      recommendations: breachCount > 0 ? [
        "Change your password for this email",
        "Enable two-factor authentication",
        "Use unique passwords for different services",
        "Consider using a password manager"
      ] : [
        "Continue using strong, unique passwords",
        "Enable two-factor authentication where available"
      ]
    });
    
  } catch (error) {
    console.error("Email check error:", error);
    
    // Return safe error message
    return sendJson(res, 500, {
      ok: false,
      error: "Unable to perform security check",
      message: "Please try again or contact support",
      debug: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}