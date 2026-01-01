// api/_lib/store.js
// Persistent store using Vercel KV when configured; falls back to in-memory Map for local use.

let kv = null;
try {
  kv = require("@vercel/kv").kv;
} catch {
  kv = null;
}

const mem = new Map();

function emailKey(email) {
  return `user:${String(email).toLowerCase()}`;
}
function idKey(id) {
  return `user_id:${String(id)}`;
}
function kvReady() {
  return Boolean(kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getUserByEmail(email) {
  const key = emailKey(email);
  if (kvReady()) return (await kv.get(key)) || null;
  return mem.get(key) || null;
}

async function getUserById(id) {
  const ikey = idKey(id);

  if (kvReady()) {
    const email = await kv.get(ikey);
    if (!email) return null;
    return (await kv.get(emailKey(email))) || null;
  }

  const email = mem.get(ikey);
  if (!email) return null;
  return mem.get(emailKey(email)) || null;
}

async function createUser(user) {
  const email = String(user.email || "").toLowerCase();
  const ekey = emailKey(email);
  const ikey = idKey(user.id);

  if (kvReady()) {
    await kv.set(ekey, user);
    await kv.set(ikey, email);
    return true;
  }

  mem.set(ekey, user);
  mem.set(ikey, email);
  return true;
}

module.exports = { getUserByEmail, getUserById, createUser };
