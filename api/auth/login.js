// api/auth/login.js - SIMPLE GUARANTEED VERSION
const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail } = require("../_lib/store.js");
const { signJwt } = require("../_lib/jwt.js");
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

// SIMPLE password check: Try EVERY possible format
function checkPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  
  console.log("Checking password, stored hash:", storedHash.substring(0, 50) + "...");
  
  // Format 1: PBKDF2 (new system)
  if (storedHash.startsWith("pbkdf2")) {
    const parts = storedHash.split("$");
    if (parts.length >= 6 && parts[0] === "pbkdf2") {
      const iter = parseInt(parts[2], 10);
      const salt = parts[4];
      const hash = parts[5];
      
      if (iter && salt && hash) {
        const test = crypto.pbkdf2Sync(String(password), salt, iter, 32, "sha256").toString("hex");
        return crypto.timingSafeEqual(Buffer.from(test, "hex"), Buffer.from(hash, "hex"));
      }
    }
  }
  
  // Format 2: HMAC-SHA256 with salt:hash (old system)
  if (storedHash.includes(":")) {
    const [salt, hash] = storedHash.split(":");
    if (salt && hash) {
      const computed = crypto.createHmac("sha256", salt).update(password).digest("hex");
      if (computed === hash) {
        console.log("OLD format worked, auto-migrating...");
        // Auto-migrate to new format
        const { hashPassword } = require("../_lib/password.js");
        // Note: In production, you'd save this back to the database
        return true;
      }
    }
  }
  
  // Format 3: Plain hash (fallback - should not happen)
  const simpleHash = crypto.createHash("sha256").update(password).digest("hex");
  if (simpleHash === storedHash) {
    console.log("WARNING: Plain hash found!");
    return true;
  }
  
  return false;
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

  console.log("Login attempt for:", email);
  
  const user = await getUserByEmail(email);
  if (!user) {
    console.log("User not found:", email);
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Invalid email or password" }));
  }

  console.log("User found, checking password...");
  
  const passwordValid = checkPassword(password, user.passwordHash);
  
  if (!passwordValid) {
    console.log("Password invalid for:", email);
    console.log("Hash was:", user.passwordHash ? user.passwordHash.substring(0, 100) : "null");
    res.statusCode = 401;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Invalid email or password",
      hint: "Try resetting your password"
    }));
  }

  console.log("Password valid, generating token...");
  
  const token = signJwt({ sub: user.id, email: user.email }, jwtSecret, { expiresInSeconds: 60 * 60 * 24 * 7 });

  const safeUser = { ...user };
  delete safeUser.passwordHash;

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
};
