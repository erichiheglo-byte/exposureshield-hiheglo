const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail } = require("../_lib/store.js");
const { signJwt } = require("../_lib/jwt.js");
const { verifyPassword } = require("../_lib/password.js");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const crypto = require("crypto");
const { storeRefreshToken } = require("../_lib/auth/refresh-store.js");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// Helper for Express middleware
const applyMiddleware = (middleware) => (request, response) =>
  new Promise((resolve, reject) => {
    middleware(request, response, (result) =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });

// Create rate limiting middleware
const getRateLimitMiddlewares = () => {
  const middlewares = [];
  
  // 1. Slow down after 3 attempts
  const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 3, // Allow 3 requests at normal speed
    delayMs: (hits) => hits * 1000, // Add 1 second per extra request
    maxDelayMs: 10000, // Maximum 10 second delay
    keyGenerator: (req) => {
      // Use email if available, otherwise IP
      const body = req.body || {};
      return body.email || req.headers["x-forwarded-for"] || req.ip || "unknown";
    },
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  });
  middlewares.push(speedLimiter);
  
  // 2. Hard block after 5 attempts
  const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
      error: "Too many login attempts. Please try again in 15 minutes.",
      code: "RATE_LIMITED"
    },
    keyGenerator: (req) => {
      const body = req.body || {};
      return body.email || req.headers["x-forwarded-for"] || req.ip || "unknown";
    },
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
  });
  middlewares.push(rateLimiter);
  
  return middlewares;
};

const rateLimitMiddlewares = getRateLimitMiddlewares();

// Handles both sync and async implementations
async function resolveMaybePromise(v) {
  return v && typeof v.then === "function" ? await v : v;
}

module.exports = async function handler(req, res) {
  try {
    // Apply CORS
    if (applyCors(req, res, "POST,OPTIONS")) return;

    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    }

    // Apply rate limiting middlewares
    try {
      for (const middleware of rateLimitMiddlewares) {
        await applyMiddleware(middleware)(req, res);
      }
    } catch (error) {
      if (error.statusCode === 429) {
        res.statusCode = 429;
        return res.end(JSON.stringify({ 
          ok: false, 
          error: "Too many login attempts. Please try again in 15 minutes.",
          code: "RATE_LIMITED"
        }));
      }
      throw error;
    }

    const jwtSecret = String(process.env.JWT_SECRET || "").trim();
    if (!jwtSecret) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "JWT_SECRET not configured" }));
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Invalid JSON body" }));
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Email and password required" }));
    }

    const user = await getUserByEmail(email);
    if (!user) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: "Invalid email or password" }));
    }

    // Prevent crashes if stored record is missing/invalid
    const hash = user.passwordHash;
    if (!hash || typeof hash !== "string") {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: "Invalid email or password" }));
    }

    let ok = false;
    try {
      ok = await resolveMaybePromise(verifyPassword(password, hash));
    } catch (e) {
      // Treat any verify error as invalid credentials (never crash)
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: "Invalid email or password" }));
    }

    if (!ok) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: "Invalid email or password" }));
    }

    const now = new Date().toISOString();
    
    // Access token: 1 hour
    const token = signJwt(
      { sub: user.id, email: user.email },
      jwtSecret,
      { expiresInSeconds: 60 * 60 }
    );

    // Refresh token: 7 days (stored securely)
    const refreshToken = crypto.randomBytes(64).toString("hex");
    await storeRefreshToken(refreshToken, {
      userId: user.id,
      email: user.email,
      createdAt: now
    });

    const safeUser = { ...user };
    delete safeUser.passwordHash;

    res.statusCode = 200;
    return res.end(JSON.stringify({ 
      ok: true, 
      token, 
      refreshToken, 
      user: safeUser,
      expiresIn: 3600 // 1 hour in seconds
    }));
  } catch (e) {
    // Fatal catch-all: ensures you never get an empty-body 500 again
    try {
      console.error("LOGIN_FATAL:", e);
      if (!res.headersSent) res.setHeader("Content-Type", "application/json");
      res.statusCode = 500;
      return res.end(JSON.stringify({
        ok: false,
        error: "Login internal error",
        detail: String((e && e.message) || e || "unknown"),
      }));
    } catch {
      // If even responding fails, just end.
      try { res.end(); } catch {}
    }
  }
};
