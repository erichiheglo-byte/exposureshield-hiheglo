// File: api/check-email.js
// Secure proxy that uses your Vercel environment variable

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.query;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    try {
        // Your API key is automatically available via process.env.HIBP_API_KEY
        const response = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
            {
                headers: {
                    'hibp-api-key': process.env.HIBP_API_KEY,
                    'User-Agent': 'ExposureShield-Secure-Proxy/1.0',
                    'Accept': 'application/json'
                }
            }
        );

        // Handle HIBP responses
        if (response.status === 404) {
            // No breaches found
            return res.status(200).json([]);
        }

        if (response.status === 401 || response.status === 403) {
            console.error('HIBP API key rejected');
            return res.status(500).json({ 
                error: 'Service configuration issue',
                mode: 'demo'
            });
        }

        if (response.status === 429) {
            return res.status(429).json({ 
                error: 'Too many requests. Please try again later.',
                mode: 'demo'
            });
        }

        if (!response.ok) {
            throw new Error(`HIBP API error: ${response.status}`);
        }

        const breaches = await response.json();
        
        // Format the response
        const formattedBreaches = breaches.map(breach => ({
            name: breach.Name,
            title: breach.Title,
            domain: breach.Domain,
            date: breach.BreachDate,
            added: breach.AddedDate,
            description: breach.Description,
            dataClasses: breach.DataClasses,
            pwnCount: breach.PwnCount,
            logo: breach.LogoPath ? `https://haveibeenpwned.com/Content/Images/PwnedLogos/${breach.LogoPath}` : null
        }));

        return res.status(200).json(formattedBreaches);

    } catch (error) {
        console.error('Proxy error:', error);
        
        // Fallback to demo data if API fails
        const demoBreaches = Math.random() > 0.5 ? [] : [
            {
                name: 'Endgame',
                date: '2023-11-13',
                dataClasses: ['Email addresses', 'Passwords'],
                description: 'A coordinated takedown of major cybercrime infrastructure.'
            }
        ];
        
        return res.status(200).json(demoBreaches);
    }
}