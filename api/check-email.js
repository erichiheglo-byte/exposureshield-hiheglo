const { applyCors } = require("./_lib/cors.js");

// --- Configuration & Constants ---
const RATE_LIMIT = 10; // requests per minute per IP (aligns with Pwned 1 tier)
const WINDOW_MS = 60 * 1000; // 1 minute window
const HIBP_TIMEOUT_MS = 15000; // 15 second timeout for HIBP API
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours (Optional: Simple in-memory cache)

// In-memory stores (For production, consider Upstash/Redis)
const requestCounts = new Map();
const responseCache = new Map(); // Simple cache: email_hash -> {data, timestamp}

// --- Helper Functions ---

function rateLimit(ip) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  if (!requestCounts.has(ip)) requestCounts.set(ip, []);
  const requests = requestCounts.get(ip);
  // Clean old requests outside the window
  while (requests.length && requests[0] < windowStart) requests.shift();
  if (requests.length >= RATE_LIMIT) return false;
  requests.push(now);
  return true;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.[0] || // Use first IP from XFF
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         'unknown';
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

// SINGLE SOURCE OF TRUTH: Risk Level Mapping
function getStatus(breachCount) {
  if (breachCount === 0) return "low";
  if (breachCount <= 2) return "medium";
  if (breachCount <= 6) return "high";
  return "critical"; // breachCount >= 7
}

function getRecommendations(breachCount, status) {
  const recommendations = [
    "Use a password manager to generate and store unique passwords",
    "Enable two-factor authentication on all important accounts"
  ];
  if (status === "critical" || status === "high") {
    recommendations.unshift("Change passwords for ALL online accounts immediately");
  } else if (status === "medium") {
    recommendations.unshift("Change passwords for affected services");
  }
  if (status === "critical") {
    recommendations.push("Consider a credit monitoring service");
  }
  return recommendations;
}

function getCacheKey(email) {
  // Simple hash for caching. Consider a one-way hash for privacy if needed.
  return `check:${email.toLowerCase().trim()}`;
}

// --- Core HIBP Fetch with Robust Error Handling ---
async function fetchFromHibp(email, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);

  try {
    const hibpUrl = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;
    const response = await fetch(hibpUrl, {
      method: "GET",
      headers: {
        "hibp-api-key": apiKey,
        "user-agent": "ExposureShield (support@exposureshield.com)",
        "accept": "application/json"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // --- PRIORITY 1: Explicit handling of HIBP API responses ---
    if (response.status === 404) {
      return { success: true, breaches: [] }; // No breaches is a successful, valid result
    }
    if (response.status === 401 || response.status === 403) {
      const text = await response.text().catch(() => '');
      console.error(`HIBP Auth Error ${response.status} for email: ${email.substring(0, 5)}...`);
      return {
        success: false,
        error: "HIBP_API_KEY configuration error or invalid.",
        status: response.status,
        details: "Check your HIBP subscription and API key in Vercel environment variables."
      };
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || '60';
      console.warn(`HIBP Rate Limit hit for IP. Retry-After: ${retryAfter}`);
      return {
        success: false,
        error: "HIBP API rate limit exceeded. Please try again later.",
        status: 429,
        details: `Retry after ${retryAfter} seconds. Your current plan allows ${RATE_LIMIT} requests per minute.`
      };
    }
    if (!response.ok) {
      const text = await response.text().catch(() => 'Failed to read error body');
      console.error(`HIBP API Error ${response.status}: ${text.slice(0, 100)}`);
      return {
        success: false,
        error: "HIBP service returned an error.",
        status: response.status,
        details: text.slice(0, 200)
      };
    }

    // Success path
    const breaches = await response.json();
    return { success: true, breaches };

  } catch (fetchError) {
    clearTimeout(timeoutId);
    // --- Handle network failures and timeouts ---
    if (fetchError.name === 'AbortError') {
      console.error(`HIBP request timed out after ${HIBP_TIMEOUT_MS}ms for email: ${email.substring(0, 5)}...`);
      return {
        success: false,
        error: "The breach check service is taking too long to respond.",
        details: "Please try again in a moment.",
        code: "TIMEOUT"
      };
    }
    // Handle other network errors (DNS, connection refused, etc.)
    console.error(`Network error fetching from HIBP: ${fetchError.message}`);
    return {
      success: false,
      error: "Network error connecting to breach database.",
      details: "Please check your connection and try again.",
      code: fetchError.name || "NETWORK_ERROR"
    };
  }
}

// --- Main Handler Function ---
module.exports = async function handler(req, res) {
  // Apply CORS early
  if (applyCors(req, res, "GET,OPTIONS")) return;
  if (req.method !== "GET") {
    return send(res, 405, { ok: false, error: "Method not allowed. Only GET requests are supported." });
  }

  // 1. Rate Limiting (Our own service)
  const clientIP = getClientIP(req);
  if (!rateLimit(clientIP)) {
    return send(res, 429, {
      ok: false,
      error: `Too many requests. Limit is ${RATE_LIMIT} per minute.`,
      retryAfter: 60
    });
  }

  try {
    // Parse request
    const url = new URL(req.url, `http://${req.headers.host}`);
    const email = (url.searchParams.get("email") || "").toString().trim();
    const bypassCache = url.searchParams.get("nocache") === "true";

    // Input validation
    if (!email) return send(res, 400, { ok: false, error: "Missing required 'email' query parameter." });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return send(res, 400, { ok: false, error: "Invalid email address format." });

    const apiKey = (process.env.HIBP_API_KEY || "").toString().trim();
    // --- PRIORITY 2: Fail fast if key is missing ---
    if (!apiKey) {
      console.error("FATAL: HIBP_API_KEY environment variable is not set.");
      return send(res, 500, {
        ok: false,
        error: "Service misconfigured.",
        details: "Administrator: Please configure the HIBP_API_KEY in Vercel."
      });
    }

    // --- PRIORITY 5: Optional Caching Layer ---
    const cacheKey = getCacheKey(email);
    if (!bypassCache && responseCache.has(cacheKey)) {
      const cached = responseCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        console.log(`Cache HIT for: ${email.substring(0, 5)}...`);
        // Return cached data with fresh timestamp
        const response = { ...cached.data, timestamp: new Date().toISOString(), cached: true };
        return send(res, 200, response);
      } else {
        responseCache.delete(cacheKey); // Expired
      }
    }

    // --- Fetch data from HIBP with robust error handling ---
    const hibpResult = await fetchFromHibp(email, apiKey);

    if (!hibpResult.success) {
      // Propagate the structured error from fetchFromHibp
      return send(res, hibpResult.status || 502, {
        ok: false,
        error: hibpResult.error,
        details: hibpResult.details,
        code: hibpResult.code
      });
    }

    // --- Process successful HIBP data ---
    const breaches = hibpResult.breaches;
    const breachCount = breaches.length;

    // --- PRIORITY 4: Schema Guardrail (Force consistency) ---
    // This is a defensive check. `breachCount` is already set from `breaches.length`.
    if (breachCount !== breaches.length) {
      console.warn(`INCONSISTENCY DETECTED for ${email}: Count ${breachCount} vs Array ${breaches.length}. Forcing match.`);
      // The mismatch shouldn't happen, but we guarantee the contract.
    }

    // Sort by date (newest first)
    breaches.sort((a, b) => new Date(b.BreachDate || "1970-01-01") - new Date(a.BreachDate || "1970-01-01"));

    const status = getStatus(breachCount);
    const message = breachCount === 0
      ? "No data breaches found. Your email appears secure."
      : `Found in ${breachCount} data breach${breachCount === 1 ? '' : 'es'}.`;

    // --- Construct final response ---
    const finalResponse = {
      ok: true,
      email,
      breaches, // Full array
      breachCount, // Guaranteed to equal breaches.length
      status, // From single source of truth
      message,
      recommendations: getRecommendations(breachCount, status),
      timestamp: new Date().toISOString(),
      // Informative notes about quota (PRIORITY 2 - Documentation)
      note: `Checked via HIBP API. Your plan permits ~${RATE_LIMIT} requests per minute.`
    };

    // --- Cache the successful result ---
    responseCache.set(cacheKey, {
      data: { ...finalResponse, cached: undefined }, // Store without the 'cached' flag
      timestamp: Date.now()
    });

    return send(res, 200, finalResponse);

  } catch (internalError) {
    // Catch any unexpected errors in our own logic
    console.error("Unexpected error in check-email handler:", internalError);
    return send(res, 500, {
      ok: false,
      error: "An internal error occurred.",
      details: "Please try again. If the problem persists, contact support.",
      timestamp: new Date().toISOString()
    });
  }
};
