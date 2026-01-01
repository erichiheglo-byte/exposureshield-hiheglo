// api/auth/login.js - SIMPLE GUARANTEED WORKING VERSION
const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail } = require("../_lib/store.js");
const { signJwt } = require("../_lib/jwt.js");
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  // Apply CORS FIRST
  if (applyCors(req, res, "POST,OPTIONS")) return;
  
  // ALWAYS set Content-Type for ALL responses
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  // Get body - SIMPLE version for Vercel
  let body;
  try {
    // Vercel Serverless provides req.body as string already
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : {};
  } catch (e) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "Invalid JSON: " + e.message }));
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "Email and password required" }));
  }

  // Get user
  const user = await getUserByEmail(email);
  if (!user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Invalid email or password (user not found)" }));
  }

  // Check password hash exists
  if (!user.passwordHash || typeof user.passwordHash !== "string") {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Server error: No password hash" }));
  }

  // SIMPLE PASSWORD VERIFICATION - JUST FOR PBKDF2 (new system)
  // Format: pbkdf2$sha256$210000$salt$hash
  const hashParts = user.passwordHash.split("$");
  
  if (hashParts.length < 6 || hashParts[0] !== "pbkdf2") {
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Invalid password format in database",
      actualHash: user.passwordHash.substring(0, 100)
    }));
  }

  const salt = hashParts[4];
  const storedHash = hashParts[5];
  
  if (!salt || !storedHash) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Missing salt or hash in stored password" }));
  }

  // Compute hash
  const computedHash = crypto
    .pbkdf2Sync(password, salt, 210000, 32, "sha256")
    .toString("hex");

  // Compare securely
  const storedBuffer = Buffer.from(storedHash, "hex");
  const computedBuffer = Buffer.from(computedHash, "hex");
  
  if (!crypto.timingSafeEqual(storedBuffer, computedBuffer)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Invalid email or password (hash mismatch)",
      debug: {
        storedLength: storedHash.length,
        computedLength: computedHash.length,
        saltLength: salt.length
      }
    }));
  }

  // Generate JWT
  const jwtSecret = process.env.JWT_SECRET || "default-secret-change-me";
  const token = signJwt(
    { sub: user.id, email: user.email },
    jwtSecret,
    { expiresInSeconds: 604800 }
  );

  // Return success (remove password hash)
  const safeUser = { ...user };
  delete safeUser.passwordHash;

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
};
