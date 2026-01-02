const { applyCors } = require("../_lib/cors.js");
const { getRefreshToken, deleteRefreshToken, storeRefreshToken } = require("../_lib/auth/refresh-store.js");
const { verifyJwt, signJwt } = require("../_lib/jwt.js");

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
    const { refreshToken } = body;

    if (!refreshToken) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Refresh token required" }));
    }

    // Verify the refresh token exists and is valid
    const tokenData = await getRefreshToken(refreshToken);
    if (!tokenData) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: "Invalid refresh token" }));
    }

    // Delete used refresh token (one-time use)
    await deleteRefreshToken(refreshToken);

    const jwtSecret = String(process.env.JWT_SECRET || "").trim();
    if (!jwtSecret) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "JWT_SECRET not configured" }));
    }

    // Issue new access token (1 hour)
    const newAccessToken = signJwt(
      { sub: tokenData.userId, email: tokenData.email },
      jwtSecret,
      { expiresInSeconds: 60 * 60 }
    );

    // Issue new refresh token (7 days)
    const newRefreshToken = require("crypto").randomBytes(64).toString("hex");
    await storeRefreshToken(newRefreshToken, {
      userId: tokenData.userId,
      email: tokenData.email,
      createdAt: new Date().toISOString()
    });

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600 // 1 hour in seconds
    }));

  } catch (error) {
    console.error("Refresh error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Internal server error" }));
  }
};