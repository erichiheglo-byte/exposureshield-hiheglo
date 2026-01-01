// api/_lib/store.js
const mem = new Map();
function emailKey(email) {
  return `user:${String(email).toLowerCase()}`;
}
function idKey(id) {
  return `user_id:${String(id)}`;
}
async function getUserByEmail(email) {
  return mem.get(emailKey(email)) || null;
}
async function getUserById(id) {
  const email = mem.get(idKey(id));
  if (!email) return null;
  return mem.get(emailKey(email)) || null;
}
async function createUser(user) {
  const email = String(user.email || '').toLowerCase();
  mem.set(emailKey(email), user);
  mem.set(idKey(user.id), email);
  return true;
}
module.exports = { getUserByEmail, getUserById, createUser };
