import crypto from 'crypto';
import { kv } from '@vercel/kv';

// Generate secure reset token
export function createPasswordResetToken(email) {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();
  const data = `${email}:${timestamp}:${randomBytes}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  
  return `${hash}.${timestamp}`;
}

// Store reset token in KV with 1 hour expiration
export async function storeResetToken(email, token) {
  const key = `reset:${email}`;
  await kv.setex(key, 3600, token); // 1 hour expiry
  return true;
}

// Verify reset token
export async function verifyPasswordResetToken(token) {
  const [hash, timestamp] = token.split('.');
  const tokenAge = Date.now() - parseInt(timestamp);
  
  // Token valid for 1 hour only
  if (tokenAge > 3600000) {
    return null;
  }
  
  // Look up token in KV
  const keys = await kv.keys('reset:*');
  
  for (const key of keys) {
    const storedToken = await kv.get(key);
    if (storedToken === token) {
      // Extract email from key (key format: "reset:email@example.com")
      const email = key.replace('reset:', '');
      
      // Delete used token
      await kv.del(key);
      
      return email;
    }
  }
  
  return null;
}