const { applyCors } = require("../_lib/cors.js");
const { consumeVerifyToken } = require("../_lib/auth/verify-store.js");
const { updateUserVerified } = require("../_lib/store.js");

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "GET,OPTIONS")) return;
  res.setHeader("Content-Type", "application/json");

  const token = req.query.token;
  if (!token) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok:false }));
  }

  const userId = await consumeVerifyToken(token);
  if (!userId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok:false, error:"Invalid or expired token" }));
  }

  await updateUserVerified(userId);
  res.end(JSON.stringify({ ok:true }));
};
