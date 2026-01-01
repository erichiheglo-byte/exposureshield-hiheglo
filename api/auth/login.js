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
