// api/_lib/password.js
const crypto = require("crypto");

// Standard format (NO empty segments):
// pbkdf2$sha256$210000$salt$hash
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const hash = crypto
    .pbkdf2Sync(String(password), salt, iterations, 32, "sha256")
    .toString("hex");
  return `pbkdf2$sha256$${iterations}$${salt}$${hash}`.replace(/\$\$/g, "$");
  // The replace makes sure we never end up with double $$ from any copy/paste mistakes.
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;

  // Accept both formats:
  // 1) pbkdf2$sha256$210000$salt$hash
  // 2) pbkdf2$sha256$210000$${salt}$${hash}  (legacy accidental)
  const parts = stored.split("$").filter((p) => p !== "");

  if (parts.length !== 5) return false;
  const [scheme, algo, iterStr, salt, hash] = parts;

  if (scheme !== "pbkdf2") return false;
  if (algo !== "sha256") return false;

  const iterations = parseInt(iterStr, 10);
  if (!iterations || iterations < 10000) return false;
  if (!salt || !hash) return false;

  const computed = crypto
    .pbkdf2Sync(String(password), salt, iterations, 32, "sha256")
    .toString("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(hash, "hex")
    );
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
