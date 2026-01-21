/**
 * Vercel catch-all function for /api/*
 * Routes every /api/* request into the Express app in api/index.js
 */
const app = require("./index");

module.exports = (req, res) => {
  // Catch-all provides req.url like "/user/profile" for /api/user/profile
  // Your Express routes are defined as "/api/user/profile", so we prepend "/api"
  if (!req.url.startsWith("/api/")) {
    req.url = "/api" + req.url;
  }
  return app(req, res);
};
