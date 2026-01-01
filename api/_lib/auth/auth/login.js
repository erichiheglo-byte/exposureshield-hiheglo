// api/auth/login.js
const crypto = require('crypto');
const { applyCors } = require('../_lib/cors.js');
const { getUserByEmail } = require('../_lib/store.js');
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

        const { email, password } = body;

        // Validation
        if (!email || !password) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ 
                ok: false, 
                error: 'Email and password are required' 
            }));
        }

        // Find user
        const user = await getUserByEmail(email.toLowerCase().trim());
        if (!user) {
            res.statusCode = 401;
            return res.end(JSON.stringify({ 
                ok: false, 
                error: 'Invalid email or password' 
            }));
        }

        // Verify password
        const [salt, storedHash] = user.passwordHash.split(':');
        const computedHash = crypto
            .createHmac('sha256', salt)
            .update(password)
            .digest('hex');

        if (computedHash !== storedHash) {
            res.statusCode = 401;
            return res.end(JSON.stringify({ 
                ok: false, 
                error: 'Invalid email or password' 
            }));
        }

        // Generate new JWT token
        const jwtSecret = String(process.env.JWT_SECRET || 'fallback-secret-key').trim();
        const token = signJwt(
            { sub: user.id, email: user.email },
            jwtSecret,
            { expiresInSeconds: 7 * 24 * 60 * 60 } // 7 days
        );

        // Return response (exclude password hash)
        const safeUser = { ...user };
        delete safeUser.passwordHash;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
            ok: true,
            token,
            user: safeUser
        }));

    } catch (error) {
        console.error('Login error:', error);
        res.statusCode = 500;
        return res.end(JSON.stringify({ 
            ok: false, 
            error: 'Internal server error' 
        }));
    }
};