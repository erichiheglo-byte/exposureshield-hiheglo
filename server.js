const express = require('express');
const app = express();
const port = 3001;

// Middleware
app.use(express.json());

// Mock API endpoints
app.get('/api/check-email', function(req, res) {
    console.log('[API] /api/check-email called for:', req.query.email);
    
    // Mock response - no external API needed
    const mockResponse = {
        success: true,
        email: req.query.email,
        breaches: Math.floor(Math.random() * 3), // 0-2 breaches
        exposed: Math.random() > 0.8, // 20% chance
        recommendation: "Email appears secure. Use strong password.",
        lastChecked: new Date().toISOString(),
        score: Math.floor(Math.random() * 30) + 70 // Score 70-100
    };
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    
    res.json(mockResponse);
});

// Other API endpoints
app.post('/api/login', function(req, res) {
    console.log('[API] Login attempt for:', req.body.email);
    
    res.json({
        success: true,
        token: 'mock_token_' + Date.now(),
        user: {
            email: req.body.email,
            name: req.body.email.split('@')[0],
            id: Date.now()
        }
    });
});

// Health check
app.get('/api/health', function(req, res) {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
    console.log(`Mock API server running at http://localhost:${port}`);
});
