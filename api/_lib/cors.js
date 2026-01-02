// api/_lib/cors.js - CORS middleware for Vercel Serverless Functions
export function applyCors(req, res) {
  // Allowed origins (add your frontend domains)
  const allowedOrigins = [
    'https://www.exposureshield.com',
    'https://exposureshield.com',
    'http://localhost:3000',
    'http://localhost:5173' // Vite dev server
  ]
  
  const origin = req.headers.origin
  
  // Set CORS headers
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    // For development, you might want to allow all origins
    // In production, be more restrictive
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true // Return true to indicate preflight handled
  }
  
  return false // Return false to continue with normal request
}

// Alternative: Middleware style
export const corsMiddleware = (handler) => async (req, res) => {
  const isPreflight = applyCors(req, res)
  if (!isPreflight) {
    return handler(req, res)
  }
}

// For CommonJS (if you're using require instead of import)
module.exports = { applyCors, corsMiddleware }