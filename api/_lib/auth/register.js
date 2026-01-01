// api/auth/register.js
const { applyCors } = require('../_lib/cors.js');
const { getUserByEmail, createUser } = require('../_lib/store.js');
const { hashPassword } = require('../_lib/password.js');
const { randomUUID } = require('crypto');

module.exports = async function handler(req, res) {
  if (applyCors(req, res, 'POST,OPTIONS')) return;
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || '').trim();
  if (!email || !password) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'Email and password are required' }));
  }
  if (await getUserByEmail(email)) {
    res.statusCode = 409;
    return res.end(JSON.stringify({ ok: false, error: 'Email already registered' }));
  }
  const user = {
    id: randomUUID(),
    email,
    name: name || 'User',
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await createUser(user);
  delete user.passwordHash;
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, user }));
};
