const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail, createUser } = require("../_lib/store.js");
const { signJwt } = require("../_lib/jwt.js");
const { hashPassword } = require("../_lib/password.js");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { storeRefreshToken } = require("../_lib/auth/refresh-store.js");
const { sendVerificationEmail } = require("../_lib/email-service.js");

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

// Helper for Express middleware in Next.js
const applyMiddleware = (middleware) => (request, response) =>
  new Promise((resolve, reject) => {
    middleware(request, response, (result) =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });

// Rate limiting for registration
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 accounts per hour from same IP
  message: {
    error: "Too many registration attempts. Please try again later.",
    code: "REGISTRATION_LIMITED"
  },
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"] || req.ip || "unknown";
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Handles both sync and async implementations
async function resolveMaybePromise(v) {
  return v && typeof v.then === "function" ? await v : v;
}

module.exports = async function handler(req, res) {
  // Apply CORS first
  if (applyCors(req, res, "POST,OPTIONS")) return;

  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  try {
    // Apply rate limiting
    await applyMiddleware(registerRateLimiter)(req, res);
  } catch (error) {
    if (error.statusCode === 429) {
      res.statusCode = 429;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Too many registration attempts. Please try again in an hour.",
        code: "REGISTRATION_LIMITED"
      }));
    }
    throw error;
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
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  
  const user = {
    id: crypto.randomUUID(),
    email,
    name: username || email.split("@")[0],
    passwordHash,
    emailVerified: false,
    verificationToken,
    verificationTokenExpires,
    createdAt: now,
    updatedAt: now,
  };

  await createUser(user);

  // Send verification email (non-blocking)
  sendVerificationEmail(email, verificationToken).catch(err => {
    console.error("Failed to send verification email:", err);
    // Don't fail registration if email fails
  });

  // Access token: 1 hour
  const token = signJwt(
    { sub: user.id, email: user.email },
    jwtSecret,
    { expiresInSeconds: 60 * 60 }
  );

  // Refresh token: 7 days (stored securely)
  const refreshToken = crypto.randomBytes(64).toString("hex");
  await storeRefreshToken(refreshToken, {
    userId: user.id,
    email: user.email,
    createdAt: now
  });

  const safeUser = { ...user };
  delete safeUser.passwordHash;
  delete safeUser.verificationToken;
  delete safeUser.verificationTokenExpires;

  res.statusCode = 201;
  return res.end(JSON.stringify({ 
    ok: true, 
    token, 
    refreshToken, 
    user: safeUser,
    expiresIn: 3600, // 1 hour in seconds
    emailVerificationRequired: true,
    message: "Account created! Please check your email to verify your account."
  }));
};