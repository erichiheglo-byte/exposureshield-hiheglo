// Add rate limiting section before sending email
const rateLimitKey = `ratelimit:testalert:${email}`;
const rateLimitRes = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(rateLimitKey)}`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` }
});

const rateLimitData = await rateLimitRes.json();
const lastSent = rateLimitData?.result ? parseInt(rateLimitData.result) : 0;
const now = Date.now();
const cooldown = 10 * 60 * 1000; // 10 minutes

if (lastSent && (now - lastSent) < cooldown) {
  const minutesLeft = Math.ceil((cooldown - (now - lastSent)) / 60000);
  return res.status(429).json({
    ok: false,
    error: "Rate limited",
    message: `Please wait ${minutesLeft} minutes before sending another test alert to ${email}`,
    nextAvailable: new Date(lastSent + cooldown).toISOString()
  });
}

// Store rate limit timestamp
await fetch(`${UPSTASH_URL}/setex/${encodeURIComponent(rateLimitKey)}/600/${now}`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` }
});