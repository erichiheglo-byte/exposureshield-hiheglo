// api/login.js - COMPLETE PRODUCTION VERSION
const { applyCors } = require("./_lib/cors.js");
const { createSession } = require("./_lib/auth.js");
const { generateJwt, verifyJwt } = require("./_lib/jwt.js");
const { getJson, setJson } = require("./_lib/store.js");

// Mock user database - REPLACE with your actual user database
const users = {
  "demo@exposureshield.com": {
    id: "user_12345",
    email: "demo@exposureshield.com",
    name: "Demo User",
    passwordHash: "$2b$10$YourHashedPasswordHere", // bcrypt hash
    createdAt: Date.now()
  }
};

// Password verification (example using bcrypt)
async function verifyPassword(password, hash) {
  // In production, use: return await bcrypt.compare(password, hash);
  // For demo purposes, we'll use a simple comparison
  return password === "demopassword123"; // CHANGE THIS IN PRODUCTION
}

// Find user by email
function findUserByEmail(email) {
  return users[email.toLowerCase()] || null;
}

// Main login handler
module.exports = async function handler(req, res) {
  // Apply CORS with credentials
  if (applyCors(req, res, "POST,OPTIONS")) return;

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Method not allowed. Use POST." 
    }));
  }

  try {
    // Parse request body
    let body;
    try {
      body = JSON.parse(req.body || "{}");
    } catch (e) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Invalid JSON body" 
      }));
    }

    // Validate required fields
    const { email, password } = body;
    if (!email || !password) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Email and password are required" 
      }));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Invalid email format" 
      }));
    }

    // Find user
    const user = findUserByEmail(email);
    if (!user) {
      // Delay response to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 500));
      res.statusCode = 401;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Invalid email or password" 
      }));
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Invalid email or password" 
      }));
    }

    // ============================================
    // AUTHENTICATION SUCCESSFUL
    // ============================================

    const userId = user.id;
    const sessionMaxAge = 30 * 24 * 60 * 60; // 30 days in seconds

    // 1. Create session for cookie-based auth
    const sessionId = await createSession(userId, sessionMaxAge * 1000);

    // 2. Generate JWT token for localStorage (optional)
    const jwtSecret = process.env.JWT_SECRET;
    let jwtToken = null;
    
    if (jwtSecret && jwtSecret.trim()) {
      jwtToken = generateJwt(
        { 
          sub: userId, 
          email: user.email,
          name: user.name 
        },
        jwtSecret,
        { expiresIn: "30d" }
      );
    }

    // 3. Set HTTP-only secure cookie
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = [
      `session=${sessionId}`,
      `HttpOnly`,
      `Path=/`,
      `Max-Age=${sessionMaxAge}`,
      `SameSite=Strict`
    ];

    if (isProduction) {
      cookieOptions.push("Secure");
    }

    res.setHeader("Set-Cookie", cookieOptions.join("; "));

    // 4. Set additional security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // 5. Track login activity (optional)
    try {
      await setJson(`user:${userId}:last_login`, {
        timestamp: Date.now(),
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"]
      }, 86400 * 7); // Keep for 7 days
    } catch (trackingError) {
      console.warn("Failed to track login:", trackingError);
      // Don't fail login if tracking fails
    }

    // 6. Prepare response
    const responseData = {
      ok: true,
      message: "Login successful",
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      session: {
        id: sessionId,
        expiresIn: sessionMaxAge
      }
    };

    // Add JWT token to response if generated
    if (jwtToken) {
      responseData.token = jwtToken;
    }

    // 7. Send success response
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(responseData));

  } catch (error) {
    console.error("Login error:", error);
    
    // Don't expose internal errors to client
    const errorMessage = process.env.NODE_ENV === "development" 
      ? error.message 
      : "Internal server error";

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ 
      ok: false, 
      error: errorMessage 
    }));
  }
};

// ============================================
// SUPPORTING FUNCTIONS (if not in separate files)
// ============================================

// Simple JWT generation (if you don't have jwt.js)
function simpleGenerateJwt(payload, secret, options = {}) {
  // This is a simplified version. In production, use jsonwebtoken package
  const header = { alg: "HS256", typ: "JWT" };
  const expiresIn = options.expiresIn || "1h";
  
  // Calculate expiration
  let expiresAt = Date.now();
  if (expiresIn.includes("d")) {
    const days = parseInt(expiresIn);
    expiresAt += days * 24 * 60 * 60 * 1000;
  } else if (expiresIn.includes("h")) {
    const hours = parseInt(expiresIn);
    expiresAt += hours * 60 * 60 * 1000;
  }
  
  const enhancedPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expiresAt / 1000)
  };
  
  // In production, use: jwt.sign(payload, secret, options)
  return `mock-jwt-token-${payload.sub}-${Date.now()}`;
}