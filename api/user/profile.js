/**
 * Route alias: /api/user/profile -> /api/auth/me
 * Keeps frontend stable while reusing existing auth/me logic.
 */
module.exports = async function handler(req, res) {
  try {
    const me = require("../auth/me.js");
    return await me(req, res);
  } catch (err) {
    console.error("user/profile alias failed:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "profile_alias_failed" }));
  }
};
