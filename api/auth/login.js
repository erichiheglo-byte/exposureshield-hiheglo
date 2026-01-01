const { applyCors } = require("../_lib/cors.js");
const { verifyPassword } = require("../_lib/password.js");
const { getUserByEmail } = require("../_lib/store.js");
const jwt = require("../_lib/jwt.js");

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

function safeUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

function signToken(payload, secret) {
  if (typeof jwt.signJwt === "function") {
    try { return jwt.signJwt(payload, secret); } catch {}
    try { return jwt.signJwt(secret, payload); } catch {}
  }
  throw new Error("signJwt not available in api/_lib/jwt.js");
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "POST,OPTIONS")) return;

  if (req.method !== "POST") {
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const data = await readJson(req);

    const email = String(data.email || "").trim().toLowerCase();
    const password = String(data.password || "").trim();

    if (!email || !password) return send(res, 400, { ok: false, error: "Email and password are required" });

    const jwtSecret = (process.env.JWT_SECRET || "").toString().trim();
    if (!jwtSecret) return send(res, 500, { ok: false, error: "JWT_SECRET not configured" });

    const user = await getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return send(res, 401, { ok: false, error: "Invalid email or password" });
    }

    const ok = verifyPassword(password, user.passwordHash);
    if (!ok) return send(res, 401, { ok: false, error: "Invalid email or password" });

    const token = signToken(
      { sub: user.id, email: user.email, plan: user.plan || "free" },
      jwtSecret
    );

    return send(res, 200, { ok: true, token, user: safeUser(user) });
  } catch (err) {
    console.error("login error:", err);
    return send(res, 500, { ok: false, error: "Unable to login. Please try again." });
  }
};
