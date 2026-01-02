// api/auth/login.js
// Vercel-safe login handler (NO express middleware). Always returns JSON.

const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail } = require("../_lib/store.js");
const { signJwt } = require("../_lib/jwt.js");
const { verifyPassword } = require("../_lib/password.js");
const crypto = require("crypto");
const { storeRefreshToken } = require("../_lib/auth/refresh-store.js");

// -----------------------------
// JSON body reader with size limit
// -----------------------------
function readJsonBody(req, maxSize = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        try { req.destroy(); } catch {}
        reject(new Error("Request body too large"));
        return;
      }
      raw += chunk;
    });

    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

async function resolveMaybePromise(v) {
  return v && typeof v.then === "function" ? await v : v;
}

// -----------------------------
// Simple in-memory rate limit (MVP)
// Note: serverless may reset counters between cold starts.
// For stronger protection, implement Redis/Upstash rate limit later.
// -----------------------------
const RL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RL_MAX_ATTEMPTS = 5;
const rlMap = new Map();

function getClientKey(req, email) {
  const xfwd = (req.headers["x-forwarded-for"] || "").toString();
  const ip = xfwd.split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "unknown";
  // Prefer email if present; fallback to IP.
  return (email || ip || "unknown").toLowerCase();
}

function rateLimitCheck(key) {
  const now = Date.now();
  const entry = rlMap.get(key);

  if (!entry) {
    rlMap.set(key, { count: 1, start: now });
    return { limited: false };
  }

  // Reset if window expired
  if (now - entry.start > RL_WINDOW_MS) {
    rlMap.set(key, { count: 1, start: now });
    return { limited: false };
  }

  entry.count += 1;

  if (entry.count > RL_MAX_ATTEMPTS) {
    const retryAfterMs = RL_WINDOW_MS - (now - entry.start);
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  return { limited: false };
}

module.exports = async function handler(req, res) {
  try {
    // CORS (handles OPTIONS)
    if (applyCors(req, res, "POST,OPTIONS")) return;

    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST, OPTIONS");
      return res.end(JSON.stringify({ ok: false, error: "Method not allowed. Use POST." }));
    }

    // Basic config checks
    const jwtSecret = String(process.env.JWT_SECRET || "").trim();
    if (!jwtSecret) {
      console.error("LOGIN: JWT_SECRET not configured");
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "Server configuration error" }));
    }

    if (typeof verifyPassword !== "function") {
      console.error("LOGIN: verifyPassword not available in ../_lib/password.js");
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "Server configuration error" }));
    }

    // Parse JSON body
    let body = {};
    try {
      body = await readJsonBody(req);
    } catch (e) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: e.message || "Invalid request body" }));
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Missing email or password" }));
    }

    // Rate limit per email/IP
    const key = getClientKey(req, email);
    const rl = rateLimitCheck(key);
    if (rl.limited) {
      res.statusCode = 429;
      res.setHeader("Retry-After", String(rl.retryAfterSeconds));
      return res.end(JSON.stringify({
        ok: false,
        error: "Too many login attempts. Please try again later.",
        code: "RATE_LIMITED",
        retryAfterSeconds: rl.retryAfterSeconds
      }));
    }

    // Lookup user
    let user;
    try {
      user = await getUserByEmail(email);
    } catch (e) {
      console.error("LOGIN: getUserByEmail error:", e);
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "Database error" }));
    }

    // Avoid user enumeration
    if (!user || !user.passwordHash || typeof user.passwordHash !== "string") {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: "Invalid email or password" }));
    }

    // Verify password (never crash)
    let ok = false;
    try {
      ok = await resolveMaybePromise(verifyPassword(password, user.passwordHash));
    } catch (e) {
      console.error("LOGIN: verifyPassword error:", e);
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
      {
        sub: user.id,
        email: user.email,
        role: user.role || "user",
        verified: !!user.verified
      },
      jwtSecret,
      { expiresInSeconds: 60 * 60 }
    );

    // Refresh token: 7 days (stored)
    const refreshToken = crypto.randomBytes(64).toString("hex");
    try {
      await storeRefreshToken(refreshToken, {
        userId: user.id,
        email: user.email,
        createdAt: now
      });
    } catch (e) {
      console.error("LOGIN: storeRefreshToken error:", e);
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "Login internal error" }));
    }

    // Safe user object
    const safeUser = { ...user };
    delete safeUser.passwordHash;

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      message: "Login successful",
      token,
      refreshToken,
      user: safeUser,
      expiresIn: 3600
    }));
  } catch (e) {
    // Catch-all to prevent empty-body failures
    console.error("LOGIN_FATAL:", e);
    try {
      res.setHeader("Content-Type", "application/json");
    } catch {}
    res.statusCode = 500;
    return res.end(JSON.stringify({
      ok: false,
      error: "Login internal error",
      detail: String((e && e.message) || e || "unknown")
    }));
  }
};
