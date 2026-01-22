/**
 * Vercel catch-all API route:
 * Routes /api/* requests into the Express app in api/index.js
 */
const app = require('./index');

module.exports = (req, res) => {
  return app(req, res);
};