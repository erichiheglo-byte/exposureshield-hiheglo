// api/legacy-index.js - SINGLE API ROUTER FOR VERCEl HOBBY PLAN
import crypto from 'crypto';

// ==================== UTILITY FUNCTIONS ====================
function sendResponse(res, status, data) {
  res.status(status).json(data);
}

function getPath(req) {
  try {
    // Vercel provides full URL in req.url
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return url.pathname;
  } catch {
    return req.url || '/';
  }
}

async function parseBody(req) {
  // Vercel already parses JSON for common content types
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  
  return {};
}

// ==================== CORS HANDLER ====================
function handleCors(req, res) {
  const origin = req.headers.origin || '*';
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// ==================== JWT FUNCTIONS ====================
function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlJson(obj) {
  return base64url(JSON.stringify(obj));
}

function signHmacSha256(data, secret) {
  return base64url(crypto.createHmac('sha256', secret).update(data).digest());
}

function signJwt(payload, secret, expiresInSeconds = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  
  const fullPayload = { ...payload, iat: now, exp };
  const encodedHeader = base64urlJson(header);
  const encodedPayload = base64urlJson(fullPayload);
  const data = `${encodedHeader}.${encodedPayload}`;
  const sig = signHmacSha256(data, secret);
  
  return `${data}.${sig}`;
}

function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing token');
  }
  
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expectedSig = signHmacSha256(data, secret);
  
  // Timing-safe compare
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(s);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid signature');
  }
  
  const payloadJson = Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const payload = JSON.parse(payloadJson);
  
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    throw new Error('Token expired');
  }
  
  return payload;
}

// ==================== PASSWORD FUNCTIONS ====================
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [saltHex, keyHex] = String(stored || '').split(':');
  if (!saltHex || !keyHex) return false;
  
  const salt = Buffer.from(saltHex, 'hex');
  const key = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  
  return key.length === derived.length && crypto.timingSafeEqual(key, derived);
}

// ==================== IN-MEMORY USER STORE ====================
// Replace with Upstash/DB for production
const users = new Map();
const userPlans = new Map();

async function getUserByEmail(email) {
  return users.get(email.toLowerCase()) || null;
}

async function getUserById(userId) {
  for (const user of users.values()) {
    if (user.id === userId) return user;
  }
  return null;
}

async function createUser(user) {
  users.set(user.email.toLowerCase(), user);
  userPlans.set(user.id, []);
  return user;
}

async function savePlanForUser(userId, planData) {
  const plans = userPlans.get(userId) || [];
  const plan = {
    id: `plan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    ...planData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  plans.push(plan);
  userPlans.set(userId, plans);
  return plan;
}

async function getUserPlans(userId) {
  return userPlans.get(userId) || [];
}

// ==================== AUTH MIDDLEWARE ====================
function requireAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header' };
  }
  
  const token = authHeader.substring(7);
  const jwtSecret = (process.env.JWT_SECRET || '').toString().trim();
  
  if (!jwtSecret) {
    return { error: 'JWT_SECRET not configured' };
  }
  
  try {
    const payload = verifyJwt(token, jwtSecret);
    return { user: payload };
  } catch (err) {
    if (err.message.includes('expired')) {
      return { error: 'Token expired' };
    }
    if (err.message.includes('signature') || err.message.includes('Invalid')) {
      return { error: 'Invalid token' };
    }
    return { error: 'Authentication failed' };
  }
}

// ==================== MAIN ROUTER HANDLER ====================
export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;
  
  const path = getPath(req);
  const method = req.method;
  
  console.log(`[API] ${method} ${path}`);
  
  // ==================== HEALTH CHECK ====================
  if (method === 'GET' && (path === '/api' || path === '/api/health')) {
    return sendResponse(res, 200, {
      status: 'ok',
      service: 'ExposureShield API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      functions: 1,
      endpoints: [
        'POST /api/register',
        'POST /api/login',
        'GET  /api/me',
        'POST /api/save-legacy-plan',
        'GET  /api/health'
      ]
    });
  }
  
  // ==================== REGISTER ENDPOINT ====================
  if (method === 'POST' && path === '/api/register') {
    try {
      const jwtSecret = (process.env.JWT_SECRET || '').toString().trim();
      if (!jwtSecret) {
        return sendResponse(res, 500, { error: 'JWT_SECRET not configured' });
      }
      
      const body = await parseBody(req);
      const name = (body?.name || '').toString().trim();
      const email = (body?.email || '').toString().trim().toLowerCase();
      const password = (body?.password || '').toString();
      
      // Validation
      if (!name || name.length < 2) {
        return sendResponse(res, 400, { error: 'Name must be at least 2 characters' });
      }
      if (!email || !email.includes('@')) {
        return sendResponse(res, 400, { error: 'Valid email required' });
      }
      if (!password || password.length < 6) {
        return sendResponse(res, 400, { error: 'Password must be at least 6 characters' });
      }
      
      // Check if user exists
      const existing = await getUserByEmail(email);
      if (existing) {
        return sendResponse(res, 409, { error: 'Account already exists' });
      }
      
      // Create user
      const userId = `u_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const user = {
        id: userId,
        name,
        email,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: 'user'
      };
      
      await createUser(user);
      
      // Generate JWT
      const token = signJwt(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        jwtSecret,
        60 * 60 * 24 * 30 // 30 days
      );
      
      return sendResponse(res, 201, {
        success: true,
        message: 'Registration successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      return sendResponse(res, 500, {
        error: 'Registration failed',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  // ==================== LOGIN ENDPOINT ====================
  if (method === 'POST' && path === '/api/login') {
    try {
      const jwtSecret = (process.env.JWT_SECRET || '').toString().trim();
      if (!jwtSecret) {
        return sendResponse(res, 500, { error: 'JWT_SECRET not configured' });
      }
      
      const body = await parseBody(req);
      const email = (body?.email || '').toString().trim().toLowerCase();
      const password = (body?.password || '').toString();
      
      // Validation
      if (!email || !email.includes('@')) {
        return sendResponse(res, 400, { error: 'Valid email required' });
      }
      if (!password) {
        return sendResponse(res, 400, { error: 'Password required' });
      }
      
      // Get user
      const user = await getUserByEmail(email);
      if (!user) {
        return sendResponse(res, 401, { error: 'Invalid email or password' });
      }
      
      // Verify password
      const passwordValid = verifyPassword(password, user.passwordHash);
      if (!passwordValid) {
        return sendResponse(res, 401, { error: 'Invalid email or password' });
      }
      
      // Generate JWT
      const token = signJwt(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        jwtSecret,
        60 * 60 * 24 * 30 // 30 days
      );
      
      return sendResponse(res, 200, {
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      });
      
    } catch (error) {
      console.error('Login error:', error);
      return sendResponse(res, 500, {
        error: 'Login failed',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  // ==================== GET CURRENT USER ====================
  if (method === 'GET' && path === '/api/me') {
    try {
      const auth = requireAuth(req);
      if (auth.error) {
        return sendResponse(res, 401, { error: auth.error });
      }
      
      const user = await getUserById(auth.user.sub);
      if (!user) {
        return sendResponse(res, 404, { error: 'User not found' });
      }
      
      return sendResponse(res, 200, {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      });
      
    } catch (error) {
      console.error('Get user error:', error);
      return sendResponse(res, 500, { error: 'Failed to get user' });
    }
  }
  
  // ==================== SAVE LEGACY PLAN ====================
  if (method === 'POST' && path === '/api/save-legacy-plan') {
    try {
      // Verify authentication
      const auth = requireAuth(req);
      if (auth.error) {
        return sendResponse(res, 401, { error: auth.error });
      }
      
      const body = await parseBody(req);
      const planData = body?.planData;
      
      if (!planData || typeof planData !== 'object') {
        return sendResponse(res, 400, { error: 'Invalid plan data' });
      }
      
      // Save plan for user
      const savedPlan = await savePlanForUser(auth.user.sub, planData);
      
      return sendResponse(res, 201, {
        success: true,
        message: 'Plan saved successfully',
        plan: savedPlan,
        user: {
          id: auth.user.sub,
          email: auth.user.email
        }
      });
      
    } catch (error) {
      console.error('Save plan error:', error);
      return sendResponse(res, 500, { error: 'Failed to save plan' });
    }
  }
  
  // ==================== GET USER PLANS ====================
  if (method === 'GET' && path === '/api/plans') {
    try {
      const auth = requireAuth(req);
      if (auth.error) {
        return sendResponse(res, 401, { error: auth.error });
      }
      
      const plans = await getUserPlans(auth.user.sub);
      
      return sendResponse(res, 200, {
        success: true,
        plans: plans,
        count: plans.length
      });
      
    } catch (error) {
      console.error('Get plans error:', error);
      return sendResponse(res, 500, { error: 'Failed to get plans' });
    }
  }
  
  // ==================== BACKWARD COMPATIBILITY ENDPOINTS ====================
  if (method === 'POST' && path === '/api/check-email') {
    // For backward compatibility
    return sendResponse(res, 200, {
      available: true,
      message: 'Email checking available'
    });
  }
  
  if (method === 'POST' && path === '/api/contact') {
    // For backward compatibility
    return sendResponse(res, 200, {
      success: true,
      message: 'Message received'
    });
  }
  
  if (method === 'POST' && path === '/api/create-checkout') {
    return sendResponse(res, 200, {
      success: true,
      message: 'Checkout endpoint will be implemented for PayPal',
      endpoint: '/api/paypal/create-order'
    });
  }
  
  if (method === 'POST' && path === '/api/record-payment') {
    return sendResponse(res, 200, {
      success: true,
      message: 'Payment recording endpoint will be implemented',
      endpoint: '/api/paypal/capture'
    });
  }
  
  // ==================== NOT FOUND ====================
  return sendResponse(res, 404, {
    error: 'Endpoint not found',
    path: path,
    method: method,
    availableEndpoints: [
      'POST /api/register',
      'POST /api/login',
      'GET  /api/me',
      'POST /api/save-legacy-plan',
      'GET  /api/plans',
      'POST /api/check-email',
      'POST /api/contact',
      'POST /api/create-checkout',
      'POST /api/record-payment',
      'GET  /api/health'
    ]
  });
}