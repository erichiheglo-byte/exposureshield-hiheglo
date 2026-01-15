// api/health/public.js - Public health check (no sensitive data)
export default async function handler(req, res) {
  try {
    return res.status(200).json({
      ok: true,
      service: "ExposureShield",
      status: "operational",
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      features: {
        essentialMonitoring: true,
        plan: "essential",
        price: "$19.99/month"
      },
      monitoring: {
        active: true,
        interval: "6 hours",
        alerts: "Real-time email notifications"
      },
      _links: {
        pricing: "/essential-pricing",
        terms: "/terms",
        privacy: "/privacy"
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Service unavailable",
      timestamp: new Date().toISOString()
    });
  }
}