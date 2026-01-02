const { applyCors } = require("../_lib/cors.js");
const { getUserByEmail, updateUser } = require("../_lib/store.js");

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "GET,OPTIONS")) return;

  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  const { token, email } = req.query;

  if (!token || !email) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "Token and email required" }));
  }

  try {
    const user = await getUserByEmail(email);
    
    if (!user) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: "User not found" }));
    }

    if (user.emailVerified) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, message: "Email already verified" }));
    }

    // Check token match and expiration
    if (user.verificationToken !== token) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Invalid verification token" }));
    }

    const tokenExpiry = new Date(user.verificationTokenExpires);
    if (tokenExpiry < new Date()) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Verification token expired" }));
    }

    // Mark email as verified
    await updateUser(user.id, {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      updatedAt: new Date().toISOString()
    });

    res.statusCode = 200;
    return res.end(JSON.stringify({ 
      ok: true, 
      message: "Email successfully verified! You can now log in." 
    }));

  } catch (error) {
    console.error("Email verification error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Internal server error" }));
  }
};