const mem = new Map();

function env(name) {
  return (process.env[name] || "").toString().trim();
}

function hasUpstash() {
  return Boolean(env("UPSTASH_REDIS_REST_URL") && env("UPSTASH_REDIS_REST_TOKEN"));
}

async function upstashGet(key) {
  const url = env("UPSTASH_REDIS_REST_URL");
  const token = env("UPSTASH_REDIS_REST_TOKEN");

  const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!r.ok) throw new Error(`Upstash GET failed: ${r.status}`);
  const data = await r.json();
  return data && Object.prototype.hasOwnProperty.call(data, "result") ? data.result : null;
}

async function upstashSet(key, value) {
  const url = env("UPSTASH_REDIS_REST_URL");
  const token = env("UPSTASH_REDIS_REST_TOKEN");

  const r = await fetch(
    `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!r.ok) throw new Error(`Upstash SET failed: ${r.status}`);
  const data = await r.json();
  return data && Object.prototype.hasOwnProperty.call(data, "result") ? data.result : null;
}

async function getUserByEmail(email) {
  const key = `user:${String(email).toLowerCase()}`;

  if (hasUpstash()) {
    const raw = await upstashGet(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  return mem.get(key) || null;
}

async function createUser(user) {
  const email = String(user && user.email ? user.email : "").toLowerCase();
  const key = `user:${email}`;
  const value = JSON.stringify(user);

  if (hasUpstash()) {
    await upstashSet(key, value);
    return true;
  }

  mem.set(key, user);
  return true;
}

module.exports = { getUserByEmail, createUser };
