const express = require('express'); 
const app = express(); 
const port = 3001; 
 
// Enable CORS for all routes 
app.use(function(req, res, next) { 
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS'); 
    res.header('Access-Control-Allow-Headers', 'Content-Type'); 
    next(); 
}); 
 
// Serve static files 
app.use(express.static(__dirname)); 
 
// API endpoint 
app.get('/api/check-email', function(req, res) { 
    console.log('[API] /api/check-email called'); 
    const email = req.query.email; 
    if (!email) { 
        return res.status(400).json({ error: 'Email parameter is required' }); 
    } 
    if (email.indexOf('@') === -1) { 
        return res.status(400).json({ error: 'Invalid email format' }); 
    } 
    console.log('Success: Returning demo data for ' + email); 
    return res.status(200).json([ 
        { 
            'Name': 'ExampleBreach', 
            'Title': 'Example Data Breach', 
            'Description': 'Demo for ' + email, 
            'Count': Math.floor(Math.random() * 1000000) + 100000 
        } 
    ]); 
}); 
 
// Handle OPTIONS for CORS preflight 
app.options('*', function(req, res) { 
    res.sendStatus(200); 
}); 
 
app.listen(port, function() { 
    console.log('Server running at http://localhost:' + port); 
    console.log('CORS enabled - serving HTML and API'); 
}); 
