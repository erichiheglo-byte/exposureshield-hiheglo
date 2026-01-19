// api/admin/cleanup-test.js - Remove test subscribers
export default async function handler(req, res) {
  try {
    // AUTHENTICATION
    const expected = process.env.CRON_SECRET || "";
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const secret = bearer || req.query.secret || "";
    
    if (!expected || secret !== expected) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return res.status(500).json({ ok: false, error: "Upstash not configured" });
    }

    // Get all active subscribers
    const membersRes = await fetch(`${UPSTASH_URL}/smembers/monitor:active`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` }
    });
    
    const membersData = await membersRes.json();
    const emails = Array.isArray(membersData?.result) ? membersData.result : [];
    
    // Filter test emails
    const testEmails = emails.filter(email => 
      email.includes('test-') || 
      email.includes('@example.com') ||
      email.includes('final-test-')
    );
    
    let removed = 0;
    let errors = 0;
    
    // Remove each test email
    for (const email of testEmails) {
      try {
        // Remove from active set
        await fetch(`${UPSTASH_URL}/srem/monitor:active/${encodeURIComponent(email)}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` }
        });
        
        // Delete user data
        await fetch(`${UPSTASH_URL}/del/user:essential:${encodeURIComponent(email)}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` }
        });
        
        removed++;
        console.log(`Removed test subscriber: ${email}`);
      } catch (error) {
        errors++;
        console.error(`Failed to remove ${email}:`, error);
      }
    }
    
    return res.status(200).json({
      ok: true,
      message: `Cleaned up ${removed} test subscribers`,
      removed,
      errors,
      testEmails,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Cleanup error:", error);
    return res.status(500).json({ ok: false, error: "Cleanup failed", message: error.message });
  }
}