// api/contact.js - FIXED VERSION
export default async function handler(req, res) {
  // --- CORS headers (consistent with other endpoints) ---
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Requested-With, Accept'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- Body parsing hardening ---
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { name, email, message } = body || {};

    // --- Validation ---
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ error: 'Message too short' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message too long' });
    }

    if (name && typeof name === 'string' && name.length > 200) {
      return res.status(400).json({ error: 'Name too long' });
    }

    // --- Metadata ---
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.socket?.remoteAddress ||
      'unknown';

    const submission = {
      name: name || 'Not provided',
      email,
      message,
      ip,
      time: new Date().toISOString()
    };

    console.log('📧 Contact Form Submission:', submission);

    // --- Simulate email sending ---
    await simulateEmailSend({
      to: 'contact@exposureshield.com',
      from: 'noreply@exposureshield.com',
      subject: `New Contact Form Message`,
      text: `
Name: ${submission.name}
Email: ${submission.email}
IP: ${submission.ip}
Time: ${submission.time}

Message:
${submission.message}
      `.trim()
    });

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully!'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({
      error: 'Failed to send message'
    });
  }
}

// --- Simulated email sender (safe placeholder) ---
async function simulateEmailSend(emailData) {
  console.log('📨 Email would be sent:', emailData);
  return { id: 'simulated-' + Date.now() };
}
