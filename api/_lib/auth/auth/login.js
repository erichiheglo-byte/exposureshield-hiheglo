// api/auth/login.js
const { applyCors } = require('../_lib/cors.js');
const { getUserByEmail } = require('../_lib/store.js');
const { verifyPassword } = require('../_lib/password.js');
const { signJwt } = require('../_lib/jwt.js');

module.exports = async function handler(req, res) {
  if (applyCors(req, res, 'POST,OPTIONS')) return;
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'Email and password are required' }));
  }
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'Invalid email or password' }));
  }
  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  if (!jwtSecret) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'JWT_SECRET not configured' }));
  }
  const token = signJwt({ sub: user.id, email: user.email }, jwtSecret);
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
};
