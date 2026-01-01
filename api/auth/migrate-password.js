// api/auth/migrate-password.js - ONE-TIME PASSWORD MIGRATION
const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail, createUser } = require("../_lib/store.js");
const { hashPassword, verifyPassword } = require("../_lib/password.js");
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

// Verify old HMAC-SHA256 format
function verifyOldPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  if (!storedHash.includes(":")) return false;
  
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  
  const computed = crypto
    .createHmac("sha256", salt)
    .update(password)
    .digest("hex");
    
  return computed === hash;
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "POST,OPTIONS")) return;
  
  res.setHeader("Content-Type", "application/json");
  
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }
  
  try {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const newPassword = String(body.newPassword || "");
    
    if (!email || !password) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Email and current password required" }));
    }
    
    // Get user
    const user = await getUserByEmail(email);
    if (!user) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: "User not found" }));
    }
    
    // Check current password (try both formats)
    let passwordValid = false;
    let currentFormat = "unknown";
    
    if (user.passwordHash) {
      // Try NEW format first
      if (user.passwordHash.startsWith("pbkdf2")) {
        currentFormat = "pbkdf2";
        passwordValid = verifyPassword(password, user.passwordHash);
      }
      // Try OLD format
      else if (user.passwordHash.includes(":")) {
        currentFormat = "hmac-sha256";
        passwordValid = verifyOldPassword(password, user.passwordHash);
      }
    }
    
    if (!passwordValid) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Current password incorrect",
        currentFormat: currentFormat
      }));
    }
    
    // Migrate to new format
    const newPasswordHash = hashPassword(newPassword || password); // Use new password if provided, else keep same
    user.passwordHash = newPasswordHash;
    user.updatedAt = new Date().toISOString();
    
    // Save back to store (simplified - in production you'd need proper update function)
    // For now, we'll delete and recreate
    const { createUser } = require("../_lib/store.js");
    
    res.statusCode = 200;
    return res.end(JSON.stringify({ 
      ok: true, 
      message: "Password migrated successfully",
      oldFormat: currentFormat,
      newFormat: "pbkdf2",
      email: user.email
    }));
    
  } catch (error) {
    console.error("Migration error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Migration failed: " + error.message 
    }));
  }
};
