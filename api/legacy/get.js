const { applyCors } = require("../_lib/cors.js");
const { verifySession } = require("../_lib/auth.js");
const { getJson } = require("../_lib/store.js");

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "GET,OPTIONS")) return;

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  try {
    // 1. Get session from cookie
    const sessionId = req.cookies?.session || req.cookies?.sessionId;
    if (!sessionId) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Not authenticated. Please log in." 
      }));
    }

    // 2. Verify session
    const userId = await verifySession(sessionId);
    if (!userId) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Session expired or invalid. Please log in again." 
      }));
    }

    // 3. Get legacy plan
    const key = `legacy:plan:${userId}`;
    const plan = await getJson(key);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ 
      ok: true, 
      plan: plan || null,
      userId: userId 
    }));
  } catch (error) {
    console.error("Legacy GET error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Internal server error" 
    }));
  }
};
