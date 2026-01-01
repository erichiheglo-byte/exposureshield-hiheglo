// api/register.js
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
    const name = (body?.name || '').toString().trim();
    const email = (body?.email || '').toString().trim().toLowerCase();
    const password = (body?.password || '').toString();

    // Validation checks
    const errors = [];
    if (!name || name.length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Valid email address is required');
    }
    if (!password || password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed',
        messages: errors
      });
    }

    // Create user data
    const userId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    
    // Create JWT payload
    const payload = {
      sub: userId,
      email: email,
      name: name,
      role: 'user',
      iat: now,
      exp: now + (60 * 60 * 24 * 30) // 30 days
    };

    // Generate JWT token
    const token = signJwt(payload, jwtSecret);

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token: token,
      user: {
        id: userId,
        name: name,
        email: email,
        role: 'user'
      },
      expiresIn: 30 * 24 * 60 * 60 // 30 days in seconds
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      error: 'Registration failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred'
    });
  }
};