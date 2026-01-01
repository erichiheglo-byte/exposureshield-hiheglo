// api/auth/register.js
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { applyCors } = require('../_lib/cors.js');
const { createUser, getUserByEmail } = require('../_lib/store.js');
const { signJwt } = require('../_lib/jwt.js');

module.exports = async function handler(req, res) {
    if (applyCors(req, res, 'POST,OPTIONS')) return;

    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    }

    try {
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            res.statusCode = 400;
            return res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
        }

        const { email, password, username } = body;

        // Validation
        if (!email || !password) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ 
                ok: false, 
                error: 'Email and password are required' 
            }));
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ 
                ok: false, 
                error: 'Invalid email format' 
            }));
        }

        if (password.length < 6) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ 
                ok: false, 
                error: 'Password must be at least 6 characters' 
            }));
        }

        // Check if user already exists
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            res.statusCode = 409;
            return res.end(JSON.stringify({ 
                ok: false, 
                error: 'User with this email already exists' 
            }));
        }

        // Hash password
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto
            .createHmac('sha256', salt)
            .update(password)
            .digest('hex');
        const passwordHash = `${salt}:${hash}`;

        // Create user object
        const userId = uuidv4();
        const now = new Date().toISOString();
        
        const user = {
            id: userId,
            email: email.toLowerCase().trim(),
            name: username || `User_${userId.substring(0, 8)}`,
            passwordHash,
            createdAt: now,
            updatedAt: now
        };

        // Save user to storage
        await createUser(user);

        // Generate JWT token
        const jwtSecret = String(process.env.JWT_SECRET || 'fallback-secret-key').trim();
        const token = signJwt(
            { sub: userId, email: user.email },
            jwtSecret,
            { expiresInSeconds: 7 * 24 * 60 * 60 } // 7 days
        );

        // Return response (exclude password hash)
        const safeUser = { ...user };
        delete safeUser.passwordHash;

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
            ok: true,
            token,
            user: safeUser
        }));

    } catch (error) {
        console.error('Registration error:', error);
        res.statusCode = 500;
        return res.end(JSON.stringify({ 
            ok: false, 
            error: 'Internal server error' 
        }));
    }
};