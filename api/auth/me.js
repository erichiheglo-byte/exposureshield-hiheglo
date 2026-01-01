const { applyCors } = require("../_lib/cors.js");
const { requireAuth } = require("../_lib/auth.js");
const { getUserById } = require("../_lib/store.js");

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function safeUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "GET,OPTIONS")) return;

  if (req.method !== "GET") {
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  const claims = requireAuth(req, res);
  if (!claims) return;

  try {
    const userId = claims.sub || claims.userId || "";
    if (!userId) return send(res, 401, { ok: false, error: "Invalid token payload" });

    const user = await getUserById(userId);
    if (!user) return send(res, 404, { ok: false, error: "User not found" });

    return send(res, 200, { ok: true, user: safeUser(user) });
  } catch (err) {
    console.error("me error:", err);
    return send(res, 500, { ok: false, error: "Unable to load profile." });
  }
};
