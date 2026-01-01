// api/auth/register.js
const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail, createUser } = require("../_lib/store.js");
const { hashPassword } = require("../_lib/password.js");
const { randomUUID } = require("crypto");
const { signJwt } = require("../_lib/jwt.js");

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "POST,OPTIONS")) return;
  
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (!email || !password) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Email and password are required" }));
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      res.statusCode = 409;
      return res.end(JSON.stringify({ ok: false, error: "Email already registered" }));
    }

    const user = {
      id: randomUUID(),
      email,
      name: name || "User",
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await createUser(user);

    const jwtSecret = String(process.env.JWT_SECRET || "").trim();
    if (!jwtSecret) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "JWT_SECRET not configured" }));
    }

    const token = signJwt({ sub: user.id, email: user.email }, jwtSecret);

    const safeUser = { ...user };
    delete safeUser.passwordHash;

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
  } catch (error) {
    console.error("Registration error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Internal server error" }));
  }
};
