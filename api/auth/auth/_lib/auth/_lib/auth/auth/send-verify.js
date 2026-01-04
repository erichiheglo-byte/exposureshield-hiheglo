const { applyCors } = require("../_lib/cors.js");
const { createVerifyToken } = require("../_lib/auth/verify-store.js");
const { getUserByEmail } = require("../_lib/store.js");

module.exports = async function handler(req, res) {
  if (applyCors(req, res, "POST,OPTIONS")) return;
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok:false }));
  }

  const { email } = JSON.parse(req.body || "{}");
  if (!email) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok:false, error:"Email required" }));
  }

  const user = await getUserByEmail(email.toLowerCase());
  if (!user || user.verified) {
    return res.end(JSON.stringify({ ok:true }));
  }

  const token = await createVerifyToken(user.id);
  const link = `https://www.exposureshield.com/verify.html?token=${token}`;

  await fetch("https://api.zoho.com/mail/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${process.env.ZOHO_MAIL_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fromAddress: "contact@exposureshield.com",
      toAddress: email,
      subject: "Verify your ExposureShield account",
      content: `
        <p>Welcome to ExposureShield,</p>
        <p>Please verify your account by clicking the link below:</p>
        <p><a href="${link}">${link}</a></p>
        <p>This link expires in 24 hours.</p>
      `
    })
  });

  res.end(JSON.stringify({ ok:true }));
};
