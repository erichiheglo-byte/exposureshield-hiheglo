// api/auth/login.js
const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail } = require("../_lib/store.js");
const { signJwt } = require("../_lib/jwt.js");
const { verifyPassword } = require("../_lib/password.js");

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

// Handles both sync and async implementations
async function resolveMaybePromise(v) {
  return v && typeof v.then === "function" ? await v : v;
}

module.exports = async function handler(req, res) {
  try {
    if (applyCors(req, res, "POST,OPTIONS")) return;

    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
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

    const token = signJwt(
      { sub: user.id, email: user.email },
      jwtSecret,
      { expiresInSeconds: 60 * 60 * 24 * 7 }
    );

    const safeUser = { ...user };
    delete safeUser.passwordHash;

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
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
// NOTE: This is the LIVE Vercel route for /api/auth/login.
// All auth requests go through here. Do not edit _lib/auth/* files.

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import authFunctions from '../../_lib/auth/authFunctions';

// Apply middleware only to login endpoint
const applyMiddleware = middleware => (request, response) => {
  return new Promise((resolve, reject) => {
    middleware(request, response, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

// Rate limiting: max 5 attempts per 15 minutes
const getRateLimitMiddlewares = () => {
  const limiters = [];
  
  // Slow down after 3 attempts
  limiters.push(
    slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 3, // Allow 3 attempts at normal speed
      delayMs: (hits) => hits * 1000, // Add 1 second delay per extra hit
      maxDelayMs: 5000, // Maximum 5 second delay
      keyGenerator: (req) => req.body?.email || req.ip, // Limit by email or IP
      skipSuccessfulRequests: true, // Don't count successful logins
    })
  );
  
  // Hard limit: 5 attempts per 15 minutes
  limiters.push(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Maximum 5 attempts
      message: { error: 'Too many login attempts. Please try again later.' },
      keyGenerator: (req) => req.body?.email || req.ip,
      skipSuccessfulRequests: true,
    })
  );
  
  return limiters;
};

const middlewares = getRateLimitMiddlewares();

export default async function handler(req, res) {
  try {
    // Apply rate limiting middlewares
    for (const middleware of middlewares) {
      await applyMiddleware(middleware)(req, res);
    }
    
    // Your existing login logic
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const result = await authFunctions.login(email, password);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        token: result.token,
        user: result.user
      });
    } else {
      return res.status(401).json({ error: result.error });
    }
    
  } catch (error) {
    if (error.statusCode === 429) {
      // Rate limit error
      return res.status(429).json({ 
        error: 'Too many login attempts. Please try again in 15 minutes.' 
      });
    }
    
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
