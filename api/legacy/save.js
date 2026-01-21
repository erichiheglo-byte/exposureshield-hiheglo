const { applyCors } = require("../_lib/cors.js");
const { verifySession } = require("../_lib/auth.js");
const { getJson, setJson } = require("../_lib/store.js");

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "POST,OPTIONS")) return;

  if (req.method !== "POST") {
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
        error: "Not authenticated" 
      }));
    }

    // 2. Verify session
    const userId = await verifySession(sessionId);
    if (!userId) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Session expired" 
      }));
    }

    // 3. Parse request body
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

    // 4. Validate required fields
    if (!body.plan || typeof body.plan !== "object") {
      res.statusCode = 400;
      return res.end(JSON.stringify({ 
        ok: false, 
        error: "Missing or invalid plan data" 
      }));
    }

    // 5. Add metadata
    const planWithMeta = {
      ...body.plan,
      userId: userId,
      updatedAt: Date.now(),
      updatedAtISO: new Date().toISOString()
    };

    // 6. Save to storage
    const key = `legacy:plan:${userId}`;
    await setJson(key, planWithMeta);

    // 7. Return success
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ 
      ok: true, 
      message: "Legacy plan saved successfully",
      updatedAt: planWithMeta.updatedAtISO
    }));
  } catch (error) {
    console.error("Legacy SAVE error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      ok: false, 
      error: "Internal server error" 
    }));
  }
};
