// api/check-email.js - FIXED VERSION (with .trim())
export default async function handler(req, res) {
    // Basic CORS for dev/file:// testing (safe for public GET endpoint)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Cache-Control', 'no-store');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // Only allow GET
    if (req.method && req.method.toUpperCase() !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const email = (req.query?.email || '').toString().trim();

    if (!email) {
        return res.status(400).json({
            success: false,
            error: "Missing email parameter",
        });
    }

    // CRITICAL FIX: Add .trim() to remove whitespace
    const HIBP_API_KEY = process.env.HIBP_API_KEY?.trim();

    // Enhanced debugging (DO NOT log raw API key)
    console.log('=== HIBP KEY DEBUG ===');
    console.log('Env present:', !!process.env.HIBP_API_KEY);
    console.log('After .trim() present:', !!HIBP_API_KEY);
    console.log('Raw length:', process.env.HIBP_API_KEY?.length || 0);
    console.log('Trimmed length:', HIBP_API_KEY?.length || 0);
    console.log('Preview:', HIBP_API_KEY ? (HIBP_API_KEY.substring(0, 4) + '...' + HIBP_API_KEY.substring(HIBP_API_KEY.length - 4)) : 'none');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('=====================');

    if (!HIBP_API_KEY) {
        return res.status(500).json({
            success: false,
            error: "HIBP_API_KEY not found or empty after trimming",
            env: process.env.NODE_ENV
        });
    }

    // Validate key format (32 hex chars)
    if (HIBP_API_KEY.length !== 32 || !/^[a-fA-F0-9]{32}$/.test(HIBP_API_KEY)) {
        return res.status(500).json({
            success: false,
            error: "Invalid HIBP API Key format",
            message: "Key must be exactly 32 hexadecimal characters",
            actualLength: HIBP_API_KEY.length,
            preview: HIBP_API_KEY.substring(0, 8) + '...',
            isHex: /^[a-fA-F0-9]+$/.test(HIBP_API_KEY)
        });
    }

    try {
        const response = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
            {
                method: 'GET',
                headers: {
                    'hibp-api-key': HIBP_API_KEY,
                    'User-Agent': 'ExposureShield-App',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('HIBP Response Status:', response.status);

        if (response.status === 404) {
            return res.json({
                success: true,
                email: email,
                breaches: [],
                exposed: false,
                message: "No breaches found",
                checkedAt: new Date().toISOString()
            });
        }

        if (response.ok) {
            const breaches = await response.json();
            return res.json({
                success: true,
                email: email,
                breaches: breaches,
                exposed: true,
                count: Array.isArray(breaches) ? breaches.length : 0,
                checkedAt: new Date().toISOString()
            });
        }

        // Better error handling for common HIBP failures
        if (response.status === 401 || response.status === 403) {
            const errorText = await response.text().catch(() => '');
            return res.status(502).json({
                success: false,
                error: `HIBP authorization failed (${response.status}). Check API key and plan access.`,
                details: errorText ? errorText.slice(0, 300) : undefined,
                email: email
            });
        }

        if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            const errorText = await response.text().catch(() => '');
            return res.status(429).json({
                success: false,
                error: "HIBP rate limit exceeded. Please try again later.",
                retryAfter: retryAfter || undefined,
                details: errorText ? errorText.slice(0, 300) : undefined,
                email: email
            });
        }

        const errorText = await response.text().catch(() => '');
        throw new Error(`HIBP API error ${response.status}: ${errorText}`);

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            success: false,
            error: error?.message || "Unknown error",
            email: email
        });
    }
}
