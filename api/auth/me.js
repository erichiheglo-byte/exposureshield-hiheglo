// api/auth/me.js
const { applyCors } = require("../_lib/cors.js");
const { getUserById } = require("../_lib/store.js");
const { verifyJwt } = require("../_lib/jwt.js");

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "GET,OPTIONS")) return;
  
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  if (!jwtSecret) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "JWT_SECRET not configured" }));
  }

  const authHeader = (req.headers.authorization || "").trim();
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  
  if (!token) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Missing Authorization: Bearer <token>" }));
  }

  try {
    const payload = verifyJwt(token, jwtSecret);
    const user = await getUserById(payload.sub);
    
    if (!user) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: "User not found" }));
    }

    const safeUser = { ...user };
    delete safeUser.passwordHash;

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, user: safeUser }));
  } catch (e) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: e.message || "Invalid or expired token" }));
  }
};


