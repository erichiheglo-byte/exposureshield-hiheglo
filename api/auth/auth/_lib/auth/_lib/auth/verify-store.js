const crypto = require("crypto");

const PREFIX = "verify:";
const TTL_SECONDS = 60 * 60 * 24; // 24 hours

function sha256(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}

async function redisRequest(path) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) throw new Error("Upstash env missing");

  const r = await fetch(url + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  const text = await r.text();
  const data = JSON.parse(text);
  if (!r.ok || data.error) throw new Error(text);
  return data;
}

async function createVerifyToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = sha256(token);
  await redisRequest(`/set/${PREFIX}${hash}/${userId}?EX=${TTL_SECONDS}`);
  return token;
}

async function consumeVerifyToken(token) {
  const hash = sha256(token);
  const key = PREFIX + hash;

  const r = await redisRequest(`/get/${key}`);
  const userId = r.result;
  if (!userId) return null;

  await redisRequest(`/del/${key}`);
  return userId;
}

module.exports = { createVerifyToken, consumeVerifyToken };
