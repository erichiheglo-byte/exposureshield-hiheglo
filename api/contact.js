// api/contact.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, message } = req.body;

    // Validate input
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (!message || message.trim().length < 10) {
      return res.status(400).json({ error: 'Message too short' });
    }

    // In production, use Resend, SendGrid, or Postmark
    // For now, we'll simulate sending email
    console.log('📧 Contact Form Submission:', { name, email, message });
    
    // Simulate email sending
    await simulateEmailSend({
      to: 'contact@exposureshield.com',
      from: 'noreply@exposureshield.com',
      subject: `New Contact from ${name || 'Anonymous'}`,
      text: `
Name: ${name || 'Not provided'}
Email: ${email}
Message: ${message}
        
Time: ${new Date().toISOString()}
IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}
      `
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Message sent successfully!' 
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}

// Simulate email sending (replace with real service)
async function simulateEmailSend(emailData) {
  // For now, just log it
  console.log('📨 Email would be sent:', emailData);
  
  // To use Resend (recommended - free tier available):
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send(emailData);
  
  return { id: 'simulated-' + Date.now() };
}