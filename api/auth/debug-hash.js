// api/auth/debug-hash.js - TEMPORARY DEBUG ENDPOINT
const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail } = require("../_lib/store.js");

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
    
    if (!email) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Email required" }));
    }
    
    const user = await getUserByEmail(email);
    
    if (!user) {
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "User not found",
        email: email 
      }));
    }
    
    // Return password hash info (sanitized)
    const hashInfo = {
      ok: true,
      email: user.email,
      hasPasswordHash: !!user.passwordHash,
      hashLength: user.passwordHash ? user.passwordHash.length : 0,
      hashStartsWith: user.passwordHash ? user.passwordHash.substring(0, 20) + "..." : null,
      containsColon: user.passwordHash ? user.passwordHash.includes(":") : false,
      startsWithPbkdf2: user.passwordHash ? user.passwordHash.startsWith("pbkdf2") : false,
      // For debugging old format
      parts: user.passwordHash ? user.passwordHash.split(":") : [],
      fullHashPreview: user.passwordHash ? user.passwordHash.substring(0, 100) : null
    };
    
    return res.end(JSON.stringify(hashInfo));
    
  } catch (error) {
    console.error("Debug error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Debug error: " + error.message 
    }));
  }
};
