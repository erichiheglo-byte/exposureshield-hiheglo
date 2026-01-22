/**
 * Route alias: /api/clients -> /api/admin/list-subscribers
 * Now that list-subscribers exports module.exports = handler, this is clean.
 */
module.exports = async function handler(req, res) {
  try {
    const list = require("./admin/list-subscribers.js");
    return await list(req, res);
  } catch (err) {
    console.error("[/api/clients] alias failed:", err && (err.stack || err));
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "clients_alias_failed" }));
  }
};
