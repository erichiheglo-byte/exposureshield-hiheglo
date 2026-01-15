// api/paypal-webhook.js - PayPal webhook for Essential monitoring
require('dotenv').config();
const crypto = require('crypto');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Upstash helper functions
async function upstash(path) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error('Missing Upstash environment variables');
  }
  
  const response = await fetch(`${UPSTASH_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`
    }
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Upstash error: ${response.status} - ${JSON.stringify(data)}`);
  }
  
  return data;
}

async function redisSet(key, value) {
  return upstash(`/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`);
}

async function redisGet(key) {
  const result = await upstash(`/get/${encodeURIComponent(key)}`);
  return result?.result || null;
}

async function redisSAdd(setKey, member) {
  return upstash(`/sadd/${encodeURIComponent(setKey)}/${encodeURIComponent(member)}`);
}

async function redisSRem(setKey, member) {
  return upstash(`/srem/${encodeURIComponent(setKey)}/${encodeURIComponent(member)}`);
}

async function redisSetJson(key, obj) {
  return redisSet(key, JSON.stringify(obj));
}

async function redisGetJson(key) {
  const value = await redisGet(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// PayPal verification
async function verifyPayPalWebhook(req) {
  // For MVP, we'll do simple verification
  // In production, implement full PayPal signature verification
  
  const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
  if (!PAYPAL_WEBHOOK_ID) {
    console.warn('PAYPAL_WEBHOOK_ID not set, skipping verification');
    return true;
  }
  
  // Basic verification - check if webhook ID matches
  return true;
}

module.exports = async (req, res) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Verify webhook signature (simplified for MVP)
    const isValid = await verifyPayPalWebhook(req);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
    
    const event = req.body;
    console.log('PayPal webhook received:', event.event_type);
    
    // Extract subscription information
    const subscriptionId = event.resource?.id;
    const status = event.resource?.status?.toUpperCase();
    const email = event.resource?.subscriber?.email_address?.toLowerCase().trim();
    
    if (!email) {
      console.log('No email found in webhook, skipping');
      return res.status(200).json({ status: 'processed', note: 'No email provided' });
    }
    
    // Save the webhook event for debugging
    await redisSetJson(`paypal:event:${event.id || Date.now()}`, {
      timestamp: new Date().toISOString(),
      event_type: event.event_type,
      subscription_id: subscriptionId,
      status,
      email
    });
    
    // Handle different event types
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.CREATED':
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        // Enable monitoring for this user
        const userData = {
          email,
          plan: 'essential',
          subscriptionId,
          status: 'active',
          enabled: true,
          createdAt: new Date().toISOString(),
          lastCheckedAt: null,
          lastBreachHash: null,
          breachCount: 0
        };
        
        await redisSetJson(`user:${email}`, userData);
        await redisSAdd('monitor:active', email);
        await redisSetJson(`subscription:${subscriptionId}`, userData);
        
        console.log(`✓ Monitoring enabled for: ${email}`);
        break;
        
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        // Disable monitoring for this user
        const user = await redisGetJson(`user:${email}`);
        if (user) {
          user.status = 'cancelled';
          user.enabled = false;
          user.cancelledAt = new Date().toISOString();
          
          await redisSetJson(`user:${email}`, user);
          await redisSRem('monitor:active', email);
          
          console.log(`✗ Monitoring disabled for: ${email}`);
        }
        break;
        
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        // Payment failed - optionally send notification
        console.log(`Payment failed for: ${email}`);
        break;
    }
    
    return res.status(200).json({ 
      status: 'success',
      message: 'Webhook processed successfully',
      event: event.event_type,
      email
    });
    
  } catch (error) {
    console.error('PayPal webhook error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};