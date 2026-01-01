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

module.exports = async function handler(req, res) {
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
    return res.end(JSON.stringify({ ok: false, error: "Missing email or password" }));
  }

  const user = await getUserByEmail(email);
  if (!user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Invalid email or password" }));
  }

  const ok = verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Invalid email or password" }));
  }

  const token = signJwt({ sub: user.id, email: user.email }, jwtSecret, { expiresInSeconds: 60 * 60 * 24 * 7 });

  const safeUser = { ...user };
  delete safeUser.passwordHash;

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
};
