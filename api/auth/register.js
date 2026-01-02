const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail, createUser } = require("../_lib/store.js");
const { signJwt } = require("../_lib/jwt.js");
const { hashPassword } = require("../_lib/password.js");
const crypto = require("crypto");

// Enhanced JSON body parser with size limit
function readJsonBody(req, maxSize = 1024 * 1024) { // 1MB limit
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      raw += chunk;
    });
    
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch (e) {
        reject(new Error("Invalid JSON format"));
      }
    });
    
    req.on("error", reject);
  });
}

// Handles both sync and async implementations
async function resolveMaybePromise(v) {
  return v && typeof v.then === "function" ? await v : v;
}

// Email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Password strength validation
function validatePassword(password) {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  
  if (password.length > 100) {
    return "Password is too long";
  }
  
  // Optional: Add more strength checks
  // const hasUpperCase = /[A-Z]/.test(password);
  // const hasLowerCase = /[a-z]/.test(password);
  // const hasNumbers = /\d/.test(password);
  // const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  // if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
  //   return "Password must contain uppercase, lowercase, numbers, and special characters";
  // }
  
  return null;
}

// Validate username
function validateUsername(username) {
  if (username.length > 50) {
    return "Username must be 50 characters or less";
  }
  
  const validRegex = /^[a-zA-Z0-9_.-]+$/;
  if (username && !validRegex.test(username)) {
    return "Username can only contain letters, numbers, dots, hyphens, and underscores";
  }
  
  return null;
}

module.exports = async function handler(req, res) {
  // Apply CORS - returns true if preflight handled
  if (applyCors(req, res, "POST,OPTIONS")) return;

  // Set response headers
  res.setHeader("Content-Type", "application/json");
  
  // Only allow POST method
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST, OPTIONS");
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Method not allowed. Use POST" 
    }));
  }

  // Check JWT secret configuration
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  if (!jwtSecret) {
    console.error("JWT_SECRET not configured");
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Server configuration error" 
    }));
  }

  // Parse request body
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: error.message || "Invalid request body" 
    }));
  }

  // Extract and validate input
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const username = String(body.username || body.name || "").trim();

  // Validate required fields
  if (!email || !password) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Email and password are required" 
    }));
  }

  // Validate email format
  if (!isValidEmail(email)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Please provide a valid email address" 
    }));
  }

  // Validate password strength
  const passwordError = validatePassword(password);
  if (passwordError) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: passwordError 
    }));
  }

  // Validate username if provided
  const usernameError = validateUsername(username);
  if (usernameError) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: usernameError 
    }));
  }

  // Check if user already exists
  let existingUser;
  try {
    existingUser = await getUserByEmail(email);
  } catch (error) {
    console.error("Database error checking existing user:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Database error" 
    }));
  }

  if (existingUser) {
    res.statusCode = 409; // Conflict
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "An account with this email already exists" 
    }));
  }

  // Hash the password
  let passwordHash;
  try {
    passwordHash = await resolveMaybePromise(hashPassword(password));
  } catch (error) {
    console.error("Password hashing error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Password processing failed" 
    }));
  }

  if (!passwordHash || typeof passwordHash !== "string") {
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Password processing failed" 
    }));
  }

  // Create user object
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  
  const user = {
    id: userId,
    email,
    name: username || email.split("@")[0],
    passwordHash,
    createdAt: now,
    updatedAt: now,
    verified: false, // Email verification status
    role: "user", // Default role
    preferences: {} // Initialize empty preferences
  };

  // Save user to database
  try {
    await createUser(user);
  } catch (error) {
    console.error("Database error creating user:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Failed to create user account" 
    }));
  }

  // Generate JWT token
  let token;
  try {
    token = signJwt(
      { 
        sub: user.id, 
        email: user.email,
        role: user.role,
        verified: user.verified
      },
      jwtSecret,
      { expiresInSeconds: 60 * 60 * 24 * 7 } // 7 days
    );
  } catch (error) {
    console.error("JWT signing error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Authentication failed" 
    }));
  }

  // Prepare safe user object (without sensitive data)
  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    verified: user.verified,
    role: user.role
  };

  // Send success response
  res.statusCode = 201; // 201 Created is more appropriate for successful creation
  return res.end(JSON.stringify({ 
    ok: true, 
    message: "Registration successful",
    token,
    user: safeUser,
    expiresIn: 60 * 60 * 24 * 7 // Token expiration in seconds
  }));
};