// api/login.js
const crypto = require('crypto');

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    });
  }

  try {
    // Get JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'JWT_SECRET environment variable is missing'
      });
    }

    // Parse request body
    let body;
    try {
      body = req.body;
      if (typeof body === 'string' && body.trim()) {
        body = JSON.parse(body);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({ 
        error: 'Invalid JSON',
        message: 'The request body contains invalid JSON'
      });
    }

    // Validate required fields
    const email = (body?.email || '').toString().trim().toLowerCase();
    const password = (body?.password || '').toString();

    // Validation checks
    const errors = [];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Valid email address is required');
    }
    if (!password) {
      errors.push('Password is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed',
        messages: errors
      });
    }

    // In a real app, you'd verify against a database
    // For now, accept any login with valid email format
    const userId = `user_${email.replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
    const now = Math.floor(Date.now() / 1000);
    
    // Create JWT payload
    const payload = {
      sub: userId,
      email: email,
      name: email.split('@')[0],
      role: 'user',
      iat: now,
      exp: now + (60 * 60 * 24 * 30) // 30 days
    };

    // Generate JWT token
    const token = signJwt(payload, jwtSecret);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: userId,
        name: email.split('@')[0],
        email: email,
        role: 'user'
      },
      expiresIn: 30 * 24 * 60 * 60 // 30 days in seconds
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Login failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred'
    });
  }
};