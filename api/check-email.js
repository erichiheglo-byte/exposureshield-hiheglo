import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { email } = req.query;
    
    if (!email) {
        return res.status(200).json([]); // Return empty array for no email
    }
    
    try {
        // If no API key, return demo response
        if (!process.env.HIBP_API_KEY) {
            return res.status(200).json([]); // Empty array for demo
        }
        
        // Real API call
        const response = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`,
            {
                headers: {
                    'hibp-api-key': process.env.HIBP_API_KEY,
                    'User-Agent': 'ExposureShield/2.0'
                }
            }
        );
        
        if (response.status === 404) {
            return res.status(200).json([]); // No breaches found
        }
        
        if (!response.ok) {
            console.error('HIBP API error:', response.status);
            return res.status(200).json([]); // Graceful fallback
        }
        
        const data = await response.json();
        return res.status(200).json(data.slice(0, 10)); // Limit to 10 breaches
        
    } catch (error) {
        console.error('API Error:', error.message);
        return res.status(200).json([]); // Always return array, never error
    }
}