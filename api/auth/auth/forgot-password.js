// New endpoint for password reset requests
import { sendPasswordResetEmail } from '../../_lib/email-service';
import { createPasswordResetToken, storeResetToken } from '../../_lib/auth/password-reset';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // 1. Check if user exists (use your existing user lookup)
    // 2. Generate reset token
    const resetToken = createPasswordResetToken(email);
    
    // 3. Store token in KV with expiration (1 hour)
    await storeResetToken(email, resetToken);
    
    // 4. Send email (you'll need to implement this)
    await sendPasswordResetEmail(email, resetToken);
    
    // Always return success even if email doesn't exist (security best practice)
    return res.status(200).json({ 
      success: true, 
      message: 'If an account exists, a reset email has been sent.' 
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}