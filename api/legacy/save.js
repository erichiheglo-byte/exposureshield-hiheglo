// api/legacy/save.js
const { applyCors } = require("../_lib/cors.js");
const { verifyJwt } = require("../_lib/jwt.js");
const { setJson } = require("../_lib/store.js");

function bearerToken(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error("Invalid JSON body")); }
    });
  });
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "POST,OPTIONS")) return;

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  if (!jwtSecret) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "JWT_SECRET not configured" }));
  }

  const token = bearerToken(req);
  if (!token) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Missing Authorization: Bearer <token>" }));
  }

  try {
    const payload = verifyJwt(token, jwtSecret);
    const userId = payload.sub;

    const body = await readJsonBody(req);
    const plan = body.plan || null;

    if (!plan || typeof plan !== "object") {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Missing plan object in body: { plan: {...} }" }));
    }

    // Basic normalization
    const cleaned = {
      fullName: String(plan.fullName || "").trim(),
      emergencyContact: String(plan.emergencyContact || "").trim(),
      notes: String(plan.notes || "").trim(),
      beneficiaries: Array.isArray(plan.beneficiaries) ? plan.beneficiaries : [],
      trustees: Array.isArray(plan.trustees) ? plan.trustees : [],
      assets: Array.isArray(plan.assets) ? plan.assets : [],
      updatedAt: new Date().toISOString()
    };

    const key = `legacy:plan:${userId}`;
    await setJson(key, cleaned);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, plan: cleaned }));
  } catch (e) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: e.message || "Invalid or expired token" }));
  }
};
