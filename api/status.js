// Save as api/status.js
module.exports = (req, res) => {
  res.json({
    status: 'online',
    app: 'ExposureShield',
    timestamp: new Date().toISOString(),
    env: {
      vars_configured: 4,
      hibp: process.env.HIBP_API_KEY ? '✓' : '✗',
      paypal: (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) ? '✓' : '✗'
    }
  });
};
