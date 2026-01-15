// api/cron-monitor.js - Scheduled monitoring for Essential subscribers
require('dotenv').config();
const crypto = require('crypto');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HIBP_API_KEY = process.env.HIBP_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Helper functions
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

async function redisSMembers(setKey) {
  const result = await upstash(`/smembers/${encodeURIComponent(setKey)}`);
  return result?.result || [];
}

async function redisGet(key) {
  const result = await upstash(`/get/${encodeURIComponent(key)}`);
  return result?.result || null;
}

async function redisSet(key, value) {
  return upstash(`/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`);
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

// Check HIBP for breaches
async function checkHIBP(email) {
  if (!HIBP_API_KEY) {
    throw new Error('HIBP_API_KEY not configured');
  }
  
  try {
    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': HIBP_API_KEY,
          'User-Agent': 'ExposureShield-Monitoring/1.0'
        }
      }
    );
    
    if (response.status === 404) {
      return []; // No breaches found
    }
    
    if (response.status === 200) {
      return await response.json();
    }
    
    throw new Error(`HIBP API error: ${response.status}`);
  } catch (error) {
    console.error(`HIBP check failed for ${email}:`, error);
    throw error;
  }
}

// Generate hash for breaches array
function generateBreachHash(breaches) {
  const breachData = breaches
    .map(b => `${b.Name}-${b.BreachDate}-${b.AddedDate}`)
    .sort()
    .join('|');
  
  return crypto
    .createHash('sha256')
    .update(breachData)
    .digest('hex');
}

// Send alert email via Resend
async function sendAlertEmail(email, newBreaches, totalBreaches) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }
  
  const breachList = newBreaches
    .map(b => {
      const dataTypes = b.DataClasses?.slice(0, 3).join(', ') || 'Various data';
      return `
        <div style="margin-bottom: 15px; padding: 10px; background: #f8fafc; border-radius: 5px;">
          <strong style="color: #dc2626;">${b.Name}</strong><br/>
          <small>Date: ${b.BreachDate || 'Unknown'} • Exposed: ${dataTypes}</small>
        </div>
      `;
    })
    .join('');
  
  const emailData = {
    from: 'ExposureShield Alerts <alerts@exposureshield.com>',
    to: email,
    subject: `🚨 Security Alert: ${newBreaches.length} New Breach${newBreaches.length > 1 ? 'es' : ''} Detected`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
          <h1 style="margin: 0; font-size: 24px;">🔒 ExposureShield Security Alert</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p>Hello,</p>
          
          <p>We detected <strong style="color: #dc2626;">${newBreaches.length} new data breach${newBreaches.length > 1 ? 'es' : ''}</strong> affecting your email:</p>
          
          <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong style="font-size: 16px;">${email}</strong>
          </div>
          
          <h2 style="color: #1e40af; margin-top: 30px;">📋 New Breaches Detected</h2>
          ${breachList || '<p>No breach details available.</p>'}
          
          <h2 style="color: #1e40af; margin-top: 30px;">🚨 Immediate Action Required</h2>
          <div style="background: #fef2f2; padding: 20px; border-radius: 5px; border-left: 4px solid #dc2626;">
            <ol style="margin: 0; padding-left: 20px;">
              <li><strong>Change passwords</strong> for affected accounts immediately</li>
              <li><strong>Enable two-factor authentication</strong> (2FA) where available</li>
              <li><strong>Monitor financial accounts</strong> for suspicious activity</li>
              <li><strong>Use unique passwords</strong> for every service</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://exposureshield.com/dashboard" style="
              background: #3b82f6;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
              display: inline-block;
            ">View Your Security Dashboard</a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 12px;">
            You're receiving this because you subscribed to <strong>ExposureShield Essential monitoring ($19.99/month)</strong>.<br>
            To manage your alerts or subscription, visit your account dashboard.
          </p>
        </div>
      </body>
      </html>
    `
  };
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${response.status} - ${error}`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send alert email:', error);
    throw error;
  }
}

// Main monitoring function
async function runMonitoring() {
  console.log('🚀 Starting ExposureShield monitoring run...');
  const startTime = Date.now();
  
  // Get all active subscribers
  const activeEmails = await redisSMembers('monitor:active');
  console.log(`📊 Found ${activeEmails.length} active subscribers to monitor`);
  
  let processed = 0;
  let alertsSent = 0;
  let errors = 0;
  
  // Process each subscriber
  for (const email of activeEmails) {
    try {
      processed++;
      
      // Get user data
      const userKey = `user:${email}`;
      const user = await redisGetJson(userKey);
      
      if (!user || !user.enabled) {
        console.log(`Skipping ${email} - not enabled`);
        continue;
      }
      
      console.log(`Checking ${email}...`);
      
      // Check HIBP for breaches
      const breaches = await checkHIBP(email);
      const currentHash = generateBreachHash(breaches);
      
      // Check if breaches have changed
      if (user.lastBreachHash !== currentHash) {
        // Determine new breaches
        const previousBreachNames = user.breaches || [];
        const currentBreachNames = breaches.map(b => b.Name);
        const newBreaches = breaches.filter(b => !previousBreachNames.includes(b.Name));
        
        if (newBreaches.length > 0) {
          console.log(`⚠️  New breaches for ${email}: ${newBreaches.length} found`);
          
          // Send alert email
          try {
            await sendAlertEmail(email, newBreaches, breaches.length);
            alertsSent++;
            console.log(`✓ Alert sent to ${email}`);
          } catch (emailError) {
            console.error(`Failed to send alert to ${email}:`, emailError);
            errors++;
          }
        }
        
        // Update user record
        user.lastBreachHash = currentHash;
        user.lastCheckedAt = new Date().toISOString();
        user.breaches = currentBreachNames;
        user.breachCount = breaches.length;
        user.lastAlertAt = newBreaches.length > 0 ? new Date().toISOString() : user.lastAlertAt;
        
        await redisSetJson(userKey, user);
      } else {
        // No changes, just update timestamp
        user.lastCheckedAt = new Date().toISOString();
        await redisSetJson(userKey, user);
      }
      
      // Rate limiting: HIBP allows 1 request every 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1600));
      
    } catch (error) {
      console.error(`Error processing ${email}:`, error);
      errors++;
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  return {
    status: 'completed',
    summary: {
      totalSubscribers: activeEmails.length,
      processed,
      alertsSent,
      errors,
      durationSeconds: duration
    },
    timestamp: new Date().toISOString()
  };
}

// HTTP handler for Vercel
module.exports = async (req, res) => {
  try {
    // Check authorization (for cron jobs)
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.includes(expectedSecret)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    // Run monitoring
    const result = await runMonitoring();
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Monitoring job failed:', error);
    return res.status(500).json({
      error: 'Monitoring failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};