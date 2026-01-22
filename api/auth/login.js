// api/auth/login.js - PRODUCTION SAFE BODY PARSING
const { applyCors } = require("../_lib/cors.js");
const { createSession } = require("../_lib/auth.js");
const { generateJwt } = require("../_lib/jwt.js");

// Mock user database - REPLACE with your actual user database
const users = {
  "demo@exposureshield.com": {
    id: "user_12345",
    email: "demo@exposureshield.com",
    name: "Demo User",
    passwordHash: "$2b$10$YourHashedPasswordHere", // bcrypt hash (placeholder)
    createdAt: Date.now(),
  },
};

// Demo password verification (replace with bcrypt.compare in production)
async function verifyPassword(password, hash) {
  // In production: return await bcrypt.compare(password, hash);
  return password === "demopassword123";
}

function findUserByEmail(email) {
  return users[String(email || "").toLowerCase()] || null;
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

/**
 * Robust body parser for Vercel Node serverless:
 * - Supports req.body as object/string/buffer
 * - Falls back to reading the raw stream if needed
 */
async function parseJsonBody(req, maxBytes = 1_000_000) {
  // 1) If Vercel/wrapper already provided req.body
  if (req.body !== undefined && req.body !== null) {
    // Already parsed object
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    // Buffer
    if (Buffer.isBuffer(req.body)) {
      const s = req.body.toString("utf8").trim();
      return s ? JSON.parse(s) : {};
    }
    // String
    if (typeof req.body === "string") {
      const s = req.body.trim();
      return s ? JSON.parse(s) : {};
    }
    // Anything else -> stringify then parse (rare)
    const s = String(req.body).trim();
    return s ? JSON.parse(s) : {};
  }

  // 2) Otherwise, read the raw request stream
  const chunks = [];
  let total = 0;

  await new Promise((resolve, reject) => {
    req.on("data", (c) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error("Body too large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", resolve);
    req.on("error", reject);
  });

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  // Apply CORS with credentials
  if (applyCors(req, res, "POST,OPTIONS")) return;

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed. Use POST." });
  }

  try {
    // Parse request body safely
    let body;
    try {
      body = await parseJsonBody(req);
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    // Validate required fields
    const email = body?.email;
    const password = body?.password;

    if (!email || !password) {
      return sendJson(res, 400, { ok: false, error: "Email and password are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendJson(res, 400, { ok: false, error: "Invalid email format" });
    }

    // Find user
    const user = findUserByEmail(email);
    if (!user) {
      // Small delay to reduce user-enumeration signal
      await new Promise((r) => setTimeout(r, 250));
      return sendJson(res, 401, { ok: false, error: "Invalid email or password" });
    }

    // Verify password
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 250));
      return sendJson(res, 401, { ok: false, error: "Invalid email or password" });
    }

    // AUTH SUCCESS
    const userId = user.id;
    const sessionMaxAge = 30 * 24 * 60 * 60; // 30 days

    // 1) Create session for cookie-based auth
    const sessionId = await createSession(userId, sessionMaxAge * 1000);

    // 2) Generate JWT token for Authorization header usage
    const jwtSecret = process.env.JWT_SECRET;
    let jwtToken = null;

    if (jwtSecret && String(jwtSecret).trim()) {
      jwtToken = generateJwt(
        { sub: userId, email: user.email, name: user.name },
        jwtSecret,
        { expiresIn: sessionMaxAge }
      );
    }

    // Set cookie (if your createSession expects cookie elsewhere, keep your existing pattern)
    res.setHeader(
      "Set-Cookie",
      `sid=${encodeURIComponent(sessionId)}; Max-Age=${sessionMaxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`
    );

    return sendJson(res, 200, {
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
      token: jwtToken, // may be null if JWT_SECRET not set
    });
  } catch (err) {
    console.error("login failed:", err && (err.stack || err));
    return sendJson(res, 500, { ok: false, error: "Login failed" });
  }
};
