const { kv } = require("@vercel/kv");

// Store refresh token with 7-day expiration
async function storeRefreshToken(token, data) {
  const key = `refresh:${token}`;
  await kv.setex(key, 60 * 60 * 24 * 7, JSON.stringify(data)); // 7 days
  return true;
}

// Get and validate refresh token
async function getRefreshToken(token) {
  const key = `refresh:${token}`;
  const data = await kv.get(key);
  if (!data) return null;
  return JSON.parse(data);
}

// Delete refresh token (used after one-time use)
async function deleteRefreshToken(token) {
  const key = `refresh:${token}`;
  await kv.del(key);
  return true;
}

// Clean up old refresh tokens (optional: run as cron job)
async function cleanupExpiredTokens() {
  // This is optional - Upstash auto-expires keys
  return true;
}

module.exports = {
  storeRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  cleanupExpiredTokens
};