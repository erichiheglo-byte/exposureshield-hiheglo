// api/_lib/auth.js - REQUIRED for login.js
const { getJson, setJson, deleteKey } = require("./store.js");
const crypto = require("crypto");

// Generate a secure random session ID
function generateSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

// Create a new session
async function createSession(userId, maxAge = 30 * 24 * 60 * 60 * 1000) {
  const sessionId = generateSessionId();
  
  const sessionData = {
    userId,
    created: Date.now(),
    expires: Date.now() + maxAge,
    lastActive: Date.now(),
    userAgent: "", // Can be set by login.js
    ip: "" // Can be set by login.js
  };
  
  // Store in Redis/Upstash with TTL
  const ttlInSeconds = Math.floor(maxAge / 1000);
  await setJson(`session:${sessionId}`, sessionData, ttlInSeconds);
  
  return sessionId;
}

// Verify session and return userId
async function verifySession(sessionId) {
  if (!sessionId || typeof sessionId !== "string") {
    return null;
  }
  
  try {
    const session = await getJson(`session:${sessionId}`);
    
    // Check if session exists and is valid
    if (!session || !session.userId || !session.expires) {
      return null;
    }
    
    // Check if session expired
    const now = Date.now();
    if (now > session.expires) {
      // Clean up expired session
      await deleteKey(`session:${sessionId}`);
      return null;
    }
    
    // Update last active time (optional, extend session)
    // await setJson(`session:${sessionId}`, {
    //   ...session,
    //   lastActive: now
    // }, Math.floor((session.expires - now) / 1000));
    
    return session.userId;
  } catch (error) {
    console.error("Session verification error:", error);
    return null;
  }
}

// Delete session (logout)
async function deleteSession(sessionId) {
  try {
    await deleteKey(`session:${sessionId}`);
    return true;
  } catch (error) {
    console.error("Session deletion error:", error);
    return false;
  }
}

// Get session data
async function getSession(sessionId) {
  try {
    return await getJson(`session:${sessionId}`);
  } catch (error) {
    console.error("Get session error:", error);
    return null;
  }
}

// Clean up expired sessions (cron job)
async function cleanupExpiredSessions() {
  // This would be run periodically via cron
  // In production, Redis/Upstash TTL handles this automatically
  console.log("Session cleanup would run here");
}

module.exports = {
  generateSessionId,
  createSession,
  verifySession,
  deleteSession,
  getSession,
  cleanupExpiredSessions
};