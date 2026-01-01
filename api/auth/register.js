// api/auth/register.js
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
// NOTE: This is the LIVE Vercel route for /api/auth/register.
// All registration requests go through here. Do not edit _lib/auth/* files.

import rateLimit from 'express-rate-limit';
import authFunctions from '../../_lib/auth/authFunctions';

// Helper for Express middleware in Next.js
const applyMiddleware = (middleware) => (request, response) =>
  new Promise((resolve, reject) => {
    middleware(request, response, (result) =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });

// Rate limiting for registration (stricter than login)
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 accounts per hour from same IP
  message: {
    error: 'Too many registration attempts. Please try again later.',
    code: 'REGISTRATION_LIMITED'
  },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Apply rate limiting
    await applyMiddleware(registerRateLimiter)(req, res);
    
    // ✅ YOUR EXISTING REGISTRATION LOGIC STARTS HERE - UNTOUCHED
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const result = await authFunctions.register(email, password);
    
    if (result.success) {
      return res.status(201).json({
        success: true,
        token: result.token,
        user: result.user
      });
    } else {
      return res.status(400).json({ error: result.error });
    }
    // ✅ YOUR EXISTING LOGIC ENDS HERE
    
  } catch (error) {
    if (error.statusCode === 429) {
      return res.status(429).json({ 
        error: 'Too many registration attempts. Please try again in an hour.',
        code: 'REGISTRATION_LIMITED'
      });
    }
    
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}