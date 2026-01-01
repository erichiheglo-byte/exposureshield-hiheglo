// api/legacy-index.js
import { applyCors } from "./_lib/cors.js";
import { signJwt } from "./_lib/jwt.js";
import { hashPassword, verifyPassword } from "./_lib/password.js";
import { getUserByEmail, createUser } from "./_lib/store.js";
import { requireAuth } from "./_lib/auth.js";

function send(res, status, obj) {
  res.status(status).json(obj);
}

function getUrl(req) {
  return new URL(req.url, `http://${req.headers.host}`);
}

function getPath(req) {
  try {
    return getUrl(req).pathname || "/";
  } catch {
    return req.url || "/";
  }
}

function getQuery(req, name) {
  try {
    return (getUrl(req).searchParams.get(name) || "").toString();
  } catch {
    return "";
  }
}

async function readJsonBody(req) {
  let body = req.body;

  if (body && typeof body === "object") return body;

  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return {}; }
  }

  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res, "GET,POST,OPTIONS")) return;

  const path = getPath(req);

  // -----------------------
  // GET /api/health
  // -----------------------
  if (req.method === "GET" && (path === "/api/health" || path === "/api")) {
    return send(res, 200, {
      status: "ok",
      service: "ExposureShield API",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      functions: 1,
      endpoints: [
        "GET  /api/health",
        "GET  /api/check-email?email=",
        "POST /api/register",
        "POST /api/login",
        "GET  /api/me",
        "POST /api/save-legacy-plan (coming next)"
      ]
    });
  }

  // -----------------------
  // GET /api/check-email?email=...
  // -----------------------
  if (req.method === "GET" && path === "/api/check-email") {
    try {
      const email = getQuery(req, "email").trim();
      if (!email) return send(res, 400, { ok: false, error: "Missing email parameter." });

      const apiKey = (process.env.HIBP_API_KEY || "").toString().trim();
      if (!apiKey) return send(res, 500, { ok: false, error: "HIBP_API_KEY not configured" });

      const hibpUrl =
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;

      const r = await fetch(hibpUrl, {
        method: "GET",
        headers: {
          "hibp-api-key": apiKey,
          "user-agent": "ExposureShield (support@exposureshield.com)",
          "accept": "application/json"
        }
      });

      // HIBP uses 404 to mean "not found" = no breaches
      if (r.status === 404) {
        return send(res, 200, { ok: true, email, breaches: [] });
      }

      if (!r.ok) {
        const text = await r.text().catch(() => "");
        return send(res, r.status, {
          ok: false,
          error: "HIBP request failed",
          details: text.slice(0, 200)
        });
      }

      const breaches = await r.json();
      return send(res, 200, { ok: true, email, breaches });
    } catch (err) {
      console.error("check-email error:", err);
      return send(res, 500, { ok: false, error: "Unable to check email security. Please try again." });
    }
  }

  // -----------------------
  // POST /api/register
  // -----------------------
  if (req.method === "POST" && path === "/api/register") {
    try {
      const jwtSecret = (process.env.JWT_SECRET || "").toString().trim();
      if (!jwtSecret) return send(res, 500, { error: "JWT_SECRET not configured" });

      const body = await readJsonBody(req);

      const name = (body?.name || "").toString().trim();
      const email = (body?.email || "").toString().trim().toLowerCase();
      const password = (body?.password || "").toString();

      if (!name || name.length < 2) return send(res, 400, { error: "Name is required" });
      if (!email || !email.includes("@")) return send(res, 400, { error: "Valid email required" });
      if (!password || password.length < 6) return send(res, 400, { error: "Password must be at least 6 characters" });

      const existing = await getUserByEmail(email);
      if (existing) return send(res, 409, { error: "Account already exists" });

      const user = {
        id: `u_${Date.now()}`,
        name,
        email,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        role: "user"
      };

      await createUser(user);

      const token = signJwt(
        { sub: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresInSeconds: 60 * 60 * 24 * 30 }
      );

      return send(res, 200, {
        success: true,
        token,
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (err) {
      console.error("register error:", err);
      return send(res, 500, { error: "Registration failed" });
    }
  }

  // -----------------------
  // POST /api/login
  // -----------------------
  if (req.method === "POST" && path === "/api/login") {
    try {
      const jwtSecret = (process.env.JWT_SECRET || "").toString().trim();
      if (!jwtSecret) return send(res, 500, { error: "JWT_SECRET not configured" });

      const body = await readJsonBody(req);

      const email = (body?.email || "").toString().trim().toLowerCase();
      const password = (body?.password || "").toString();

      if (!email || !email.includes("@")) return send(res, 400, { error: "Valid email required" });
      if (!password) return send(res, 400, { error: "Password required" });

      const user = await getUserByEmail(email);
      if (!user) return send(res, 401, { error: "Invalid email or password" });

      const ok = verifyPassword(password, user.passwordHash);
      if (!ok) return send(res, 401, { error: "Invalid email or password" });

      const token = signJwt(
        { sub: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresInSeconds: 60 * 60 * 24 * 30 }
      );

      return send(res, 200, {
        success: true,
        token,
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (err) {
      console.error("login error:", err);
      return send(res, 500, { error: "Login failed" });
    }
  }

  // -----------------------
  // GET /api/me
  // -----------------------
  if (req.method === "GET" && path === "/api/me") {
    const auth = requireAuth(req, res);
    if (!auth) return;

    try {
      const email = (auth.email || "").toString().toLowerCase();
      const user = await getUserByEmail(email);
      if (!user) return send(res, 404, { error: "User not found" });

      return send(res, 200, {
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        tokenPayload: auth
      });
    } catch (err) {
      console.error("me error:", err);
      return send(res, 500, { error: "Failed to load user" });
    }
  }

  return send(res, 404, { error: "Not found", method: req.method, path });
}
