// api/create-checkout.js - FIXED VERSION
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Plan configurations
    const plans = {
      'security': {
        name: 'Security Protection',
        price: 499, // $4.99
        description: 'Real-time breach monitoring only'
      },
      'legacy': {
        name: 'Legacy Planning',
        price: 799, // $7.99
        description: 'Digital inheritance planning only'
      },
      'complete': {
        name: 'Complete Suite',
        price: 999, // $9.99
        description: 'Both security & legacy planning'
      },
      'complete-annual': {
        name: 'Complete Suite (Annual)',
        price: 9590, // $95.90
        description: 'Annual billing - Save 20%'
      }
    };

    const selectedPlan = plans[plan] || plans.complete;
    
    console.log('💳 Creating checkout for:', { plan, email, price: selectedPlan.price });
    
    // SIMULATION MODE - Replace with real Stripe when ready
    const usingRealStripe = process.env.STRIPE_SECRET_KEY && false; // Set to true when ready
    
    if (usingRealStripe) {
      // REAL STRIPE CODE (commented out for now)
      /*
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `ExposureShield - ${selectedPlan.name}`,
              description: selectedPlan.description,
            },
            unit_amount: selectedPlan.price,
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: 'https://www.exposureshield.com/payment-success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://www.exposureshield.com/pricing',
        customer_email: email,
        metadata: {
          plan: plan,
          email: email
        }
      });
      
      return res.status(200).json({
        id: session.id,
        url: session.url,
        amount: selectedPlan.price,
        currency: 'usd',
        plan: plan,
        planName: selectedPlan.name
      });
      */
    }
    
    // SIMULATION MODE - Returns a demo page
    const checkoutSession = {
      id: 'cs_live_' + Date.now(),
      url: 'https://www.exposureshield.com/payment-demo',
      amount: selectedPlan.price,
      currency: 'usd',
      plan: plan,
      planName: selectedPlan.name,
      success_url: 'https://www.exposureshield.com/payment-success',
      cancel_url: 'https://www.exposureshield.com/pricing',
      simulated: true,
      message: 'Payment system in demo mode. Enable Stripe for real payments.'
    };

    return res.status(200).json(checkoutSession);

  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ 
      error: 'Payment service temporarily unavailable',
      details: error.message 
    });
  }
}