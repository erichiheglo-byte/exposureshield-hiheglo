// api/auth/login.js
// Fully hardened for Vercel: no top-level requires that can crash deployment.
// Always returns JSON, even when dependencies are missing.

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
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error("Invalid JSON body")); }
    });

    req.on("error", reject);
  });
}

async function resolveMaybePromise(v) {
  return v && typeof v.then === "function" ? await v : v;
}

function json(res, statusCode, payload) {
  try {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(payload));
  } catch {
    try { return res.end(); } catch {}
  }
}

module.exports = async function handler(req, res) {
  // Ensure JSON header early
  try { res.setHeader("Content-Type", "application/json"); } catch {}

  // Load dependencies INSIDE handler so missing files do not crash invocation
  let applyCors, getUserByEmail, signJwt, verifyPassword, storeRefreshToken, crypto;

  try {
    ({ applyCors } = require("../_lib/cors.js"));
  } catch (e) {
    console.error("LOGIN_DEP_MISSING cors:", e);
    return json(res, 500, { ok: false, error: "Server misconfiguration (cors)" });
  }

  try {
    if (applyCors(req, res, "POST,OPTIONS")) return;
  } catch (e) {
    console.error("LOGIN_CORS_FAIL:", e);
    return json(res, 500, { ok: false, error: "Server misconfiguration (cors runtime)" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 405, { ok: false, error: "Method not allowed. Use POST." });
  }

  try {
    ({ getUserByEmail } = require("../_lib/store.js"));
  } catch (e) {
    console.error("LOGIN_DEP_MISSING store:", e);
    return json(res, 500, { ok: false, error: "Server misconfiguration (store)" });
  }

  try {
    ({ signJwt } = require("../_lib/jwt.js"));
  } catch (e) {
    console.error("LOGIN_DEP_MISSING jwt:", e);
    return json(res, 500, { ok: false, error: "Server misconfiguration (jwt)" });
  }

  try {
    ({ verifyPassword } = require("../_lib/password.js"));
  } catch (e) {
    console.error("LOGIN_DEP_MISSING password:", e);
    return json(res, 500, { ok: false, error: "Server misconfiguration (password)" });
  }

  // refresh-store is optional; login should still work without refresh tokens
  try {
    ({ storeRefreshToken } = require("../_lib/auth/refresh-store.js"));
  } catch (e) {
    storeRefreshToken = null;
    console.warn("LOGIN_DEP_WARNING refresh-store missing (refresh tokens disabled):", e?.message || e);
  }

  try {
    crypto = require("crypto");
  } catch (e) {
    console.error("LOGIN_DEP_MISSING crypto:", e);
    return json(res, 500, { ok: false, error: "Server misconfiguration (crypto)" });
  }

  if (typeof verifyPassword !== "function") {
    console.error("LOGIN_VERIFY_MISSING: verifyPassword not a function");
    return json(res, 500, { ok: false, error: "Server misconfiguration (verifyPassword)" });
  }

  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  if (!jwtSecret) {
    console.error("LOGIN_CONFIG: JWT_SECRET missing");
    return json(res, 500, { ok: false, error: "Server configuration error" });
  }

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return json(res, 400, { ok: false, error: e.message || "Invalid request body" });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return json(res, 400, { ok: false, error: "Missing email or password" });
  }

  let user;
  try {
    user = await getUserByEmail(email);
  } catch (e) {
    console.error("LOGIN_DB_ERROR:", e);
    return json(res, 500, { ok: false, error: "Database error" });
  }

  // Do not reveal which part failed
  if (!user || !user.passwordHash || typeof user.passwordHash !== "string") {
    return json(res, 401, { ok: false, error: "Invalid email or password" });
  }

  let ok = false;
  try {
    ok = await resolveMaybePromise(verifyPassword(password, user.passwordHash));
  } catch (e) {
    console.error("LOGIN_VERIFY_ERROR:", e);
    return json(res, 401, { ok: false, error: "Invalid email or password" });
  }

  if (!ok) {
    return json(res, 401, { ok: false, error: "Invalid email or password" });
  }

  let token;
  try {
    token = signJwt(
      { sub: user.id, email: user.email, role: user.role || "user", verified: !!user.verified },
      jwtSecret,
      { expiresInSeconds: 60 * 60 } // 1 hour
    );
  } catch (e) {
    console.error("LOGIN_JWT_ERROR:", e);
    return json(res, 500, { ok: false, error: "Authentication failed" });
  }

  // Refresh token (optional)
  let refreshToken = null;
  if (typeof storeRefreshToken === "function") {
    try {
      refreshToken = crypto.randomBytes(64).toString("hex");
      await storeRefreshToken(refreshToken, {
        userId: user.id,
        email: user.email,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("LOGIN_REFRESH_STORE_ERROR:", e);
      // Do not fail login if refresh storage fails
      refreshToken = null;
    }
  }

  const safeUser = { ...user };
  delete safeUser.passwordHash;

  return json(res, 200, {
    ok: true,
    message: "Login successful",
    token,
    refreshToken, // may be null
    user: safeUser,
    expiresIn: 3600
  });
};
