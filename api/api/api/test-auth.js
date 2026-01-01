// api/test-auth.js
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    console.log('Test endpoint hit. Method:', req.method);
    
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        message: 'GET request successful',
        timestamp: new Date().toISOString(),
        method: 'GET'
      });
    }
    
    if (req.method === 'POST') {
      let body;
      try {
        body = req.body;
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
      } catch (e) {
        body = {};
      }
      
      return res.status(200).json({
        success: true,
        message: 'POST request successful',
        timestamp: new Date().toISOString(),
        method: 'POST',
        receivedBody: body
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}