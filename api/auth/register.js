const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail, createUser } = require("../_lib/store.js");
const { signJwt } = require("../_lib/jwt.js");
const { hashPassword } = require("../_lib/password.js");
const crypto = require("crypto");

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
  const username = String(body.username || body.name || "").trim();

  if (!email || !password) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "Missing email or password" }));
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    res.statusCode = 409;
    return res.end(JSON.stringify({ ok: false, error: "User already exists" }));
  }

  let passwordHash;
  try {
    passwordHash = await resolveMaybePromise(hashPassword(password));
  } catch {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Password hashing failed" }));
  }

  if (!passwordHash || typeof passwordHash !== "string") {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Password hashing failed" }));
  }

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    email,
    name: username || email.split("@")[0],
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  await createUser(user);

  const token = signJwt(
    { sub: user.id, email: user.email },
    jwtSecret,
    { expiresInSeconds: 60 * 60 * 24 * 7 }
  );

  const safeUser = { ...user };
  delete safeUser.passwordHash;

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
};
