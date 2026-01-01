// api/_lib/password.js
const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(password), salt, 210000, 32, "sha256").toString("hex");
  return `pbkdf2$sha256$210000$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;

  const parts = stored.split("$");
  // pbkdf2$sha256$210000$$salt$$hash
  if (parts.length < 6 || parts[0] !== "pbkdf2") return false;

  const iter = parseInt(parts[2], 10);
  const salt = parts[4];
  const hash = parts[5];

  if (!iter || !salt || !hash) return false;

  const test = crypto.pbkdf2Sync(String(password), salt, iter, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(test, "hex"), Buffer.from(hash, "hex"));
}

module.exports = { hashPassword, verifyPassword };
