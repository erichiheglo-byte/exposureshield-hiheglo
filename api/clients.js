/**
 * Route alias: /api/clients -> /api/admin/list-subscribers
 * NOTE: If list-subscribers is protected (admin-only), you may get 401/403 — that is OK.
 */
module.exports = async function handler(req, res) {
  try {
    const list = require("./admin/list-subscribers.js");
    return await list(req, res);
  } catch (err) {
    console.error("clients alias failed:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "clients_alias_failed" }));
  }
};
