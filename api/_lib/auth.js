const { verifyJwt } = require("./jwt.js");

function getBearerToken(req) {
  const h = (req.headers.authorization || req.headers.Authorization || "").toString().trim();
  if (!h) return "";
  const parts = h.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1].trim();
  return "";
}

function requireAuth(req, res) {
  const jwtSecret = (process.env.JWT_SECRET || "").toString().trim();
  if (!jwtSecret) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "JWT_SECRET not configured" }));
    return null;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing Authorization: Bearer <token>" }));
    return null;
  }

  try {
    return verifyJwt(token, jwtSecret);
  } catch {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid or expired token" }));
    return null;
  }
}

module.exports = { requireAuth };
