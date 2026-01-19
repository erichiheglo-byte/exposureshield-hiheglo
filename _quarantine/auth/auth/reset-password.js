// Endpoint to actually reset the password
import { verifyPasswordResetToken } from '../../_lib/auth/password-reset';
import authFunctions from '../../_lib/auth/authFunctions';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { token, newPassword, confirmPassword } = req.body;
    
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Verify token and get email
    const email = await verifyPasswordResetToken(token);
    
    if (!email) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Update password using your existing authFunctions
    const result = await authFunctions.updatePassword(email, newPassword);
    
    if (result.success) {
      return res.status(200).json({ 
        success: true, 
        message: 'Password reset successful. You can now login with your new password.' 
      });
    } else {
      return res.status(400).json({ error: result.error });
    }
    
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}