// api/legacy/get.js
const { applyCors } = require("../_lib/cors.js");
const { verifyJwt } = require("../_lib/jwt.js");
const { getJson, setJson } = require("../_lib/store.js");

function bearerToken(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

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

  const token = bearerToken(req);
  if (!token) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Missing Authorization: Bearer <token>" }));
  }

  try {
    const payload = verifyJwt(token, jwtSecret);
    const userId = payload.sub;

    const key = `legacy:plan:${userId}`;
    const plan = await getJson(key);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, plan: plan || null }));
  } catch (e) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: e.message || "Invalid or expired token" }));
  }
};
