const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// ===== VALIDATE REQUIRED ENV VARIABLES =====
const requiredEnvVars = ['ZOHO_USER', 'ZOHO_PASS', 'HIBP_API_KEY', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    process.exit(1);
}

// ===== SECURITY MIDDLEWARE =====
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://exposureshield.com", "https://haveibeenpwned.com", "https://api.resend.com", "https://api-m.sandbox.paypal.com", "https://api-m.paypal.com"],
            frameSrc: ["'self'", "https://www.paypal.com"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

app.use(cors({
    origin: [
        'https://exposureshield.com',
        'https://www.exposureshield.com',
        'http://localhost:3000',
        'http://localhost:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== RATE LIMITING =====
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

const emailCheckLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 email checks per hour per IP
    message: {
        success: false,
        error: 'Too many email checks. Please try again later.',
        code: 'EMAIL_CHECK_LIMIT_EXCEEDED'
    }
});

const contactFormLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 contact form submissions per hour per IP
    message: {
        success: false,
        error: 'Too many contact submissions. Please try again later.',
        code: 'CONTACT_LIMIT_EXCEEDED'
    }
});

const monitoringLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 monitoring triggers per hour
    message: {
        success: false,
        error: 'Too many monitoring requests. Please wait.',
        code: 'MONITORING_LIMIT_EXCEEDED'
    }
});

// ===== ZOHO EMAIL TRANSPORTER =====
const createTransporter = () => {
    console.log('🔧 Creating Zoho transporter for:', process.env.ZOHO_USER);
    
    return nodemailer.createTransport({
        host: process.env.ZOHO_HOST || 'smtp.zoho.com',
        port: parseInt(process.env.ZOHO_PORT || 587),
        secure: process.env.ZOHO_SECURE === 'true',
        auth: {
            user: process.env.ZOHO_USER,
            pass: process.env.ZOHO_PASS
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development'
    });
};

// ===== ESSENTIAL MONITORING FUNCTIONS =====

// Redis/Upstash helper functions
async function upstashRequest(path, method = 'POST', body = null) {
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
        throw new Error('Upstash Redis not configured');
    }
    
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${UPSTASH_URL}${path}`, options);
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(`Upstash error: ${response.status} - ${JSON.stringify(data)}`);
    }
    
    return data;
}

async function redisGet(key) {
    try {
        const result = await upstashRequest(`/get/${encodeURIComponent(key)}`, 'GET');
        return result?.result || null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
}

async function redisSet(key, value) {
    try {
        await upstashRequest(`/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`);
        return true;
    } catch (error) {
        console.error('Redis set error:', error);
        return false;
    }
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

async function redisSAdd(setKey, member) {
    try {
        await upstashRequest(`/sadd/${encodeURIComponent(setKey)}/${encodeURIComponent(member)}`);
        return true;
    } catch (error) {
        console.error('Redis SADD error:', error);
        return false;
    }
}

async function redisSRem(setKey, member) {
    try {
        await upstashRequest(`/srem/${encodeURIComponent(setKey)}/${encodeURIComponent(member)}`);
        return true;
    } catch (error) {
        console.error('Redis SREM error:', error);
        return false;
    }
}

async function redisSMembers(setKey) {
    try {
        const result = await upstashRequest(`/smembers/${encodeURIComponent(setKey)}`, 'GET');
        return Array.isArray(result?.result) ? result.result : [];
    } catch (error) {
        console.error('Redis SMEMBERS error:', error);
        return [];
    }
}

// HIBP API Integration
async function checkHIBP(email) {
    try {
        const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, {
            headers: {
                'hibp-api-key': process.env.HIBP_API_KEY,
                'User-Agent': 'ExposureShield-Security-Check/1.0'
            }
        });

        if (response.status === 404) {
            return { breaches: [], status: 'low' };
        }

        if (!response.ok) {
            throw new Error(`HIBP API error: ${response.status}`);
        }

        const breaches = await response.json();
        
        // Calculate risk level
        let status = 'low';
        if (breaches.length === 1) status = 'medium';
        if (breaches.length >= 2) status = 'high';
        
        return { breaches, status };
        
    } catch (error) {
        console.error('HIBP check error:', error.message);
        throw error;
    }
}

// Generate hash for breaches (for change detection)
function generateBreachHash(breaches) {
    const normalized = (Array.isArray(breaches) ? breaches : []).map(b => ({
        Name: b?.Name || "",
        BreachDate: b?.BreachDate || "",
        AddedDate: b?.AddedDate || "",
    })).sort((a, b) => (a.AddedDate || "").localeCompare(b.AddedDate || "") || a.Name.localeCompare(b.Name));

    const str = JSON.stringify(normalized);
    return crypto.createHash("sha256").update(str).digest("hex");
}

// Send alert email via Resend
async function sendMonitoringAlert(email, newBreaches, totalBreaches) {
    try {
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY not configured');
        }

        const breachList = newBreaches.slice(0, 5).map(b => {
            const dataTypes = b.DataClasses?.slice(0, 3).join(', ') || 'Various data';
            return `
                <div style="margin-bottom: 15px; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #dc2626;">
                    <strong style="color: #1f2937;">${b.Name}</strong><br/>
                    <small style="color: #6b7280;">Date: ${b.BreachDate || 'Unknown'} • Exposed: ${dataTypes}</small>
                </div>
            `;
        }).join('');

        const emailData = {
            from: 'ExposureShield Alerts <alerts@exposureshield.com>',
            to: email,
            subject: `🚨 ExposureShield Alert: ${newBreaches.length} New Breach${newBreaches.length > 1 ? 'es' : ''} Detected`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
                        <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: 700;">🚨 Security Alert</h1>
                            <p style="margin: 10px 0 0; opacity: 0.9;">ExposureShield Essential Monitoring</p>
                        </div>
                        
                        <div style="padding: 30px;">
                            <p>We detected <strong style="color: #dc2626;">${newBreaches.length} new data breach${newBreaches.length > 1 ? 'es' : ''}</strong> affecting your monitored email:</p>
                            
                            <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #7dd3fc;">
                                <strong style="font-size: 16px;">${email}</strong><br/>
                                <small style="color: #6b7280;">Total breaches detected: ${totalBreaches}</small>
                            </div>
                            
                            <h2 style="color: #1e40af; margin-top: 25px; font-size: 18px;">📋 New Breaches Detected</h2>
                            ${breachList || '<p>No breach details available.</p>'}
                            
                            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #fbbf24;">
                                <h3 style="color: #92400e; margin-top: 0;">🚨 Immediate Action Required</h3>
                                <ol style="margin: 15px 0; padding-left: 20px;">
                                    <li><strong>Change passwords</strong> for affected accounts immediately</li>
                                    <li><strong>Enable two-factor authentication</strong> (2FA) where available</li>
                                    <li><strong>Monitor financial accounts</strong> for suspicious activity</li>
                                    <li><strong>Use unique passwords</strong> for every service</li>
                                </ol>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://exposureshield.com/dashboard" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                                    View Your Security Dashboard
                                </a>
                            </div>
                            
                            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; color: #6b7280; font-size: 12px;">
                                <p>You're receiving this because you subscribed to <strong>ExposureShield Essential monitoring ($19.99/month)</strong>.</p>
                                <p>To manage alerts or cancel, visit your account dashboard.</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

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

        console.log(`✅ Alert email sent to: ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send alert to ${email}:`, error.message);
        throw error;
    }
}

// ===== ESSENTIAL MONITORING ROUTES =====

// PayPal Webhook for Essential Subscriptions
app.post('/api/essential/webhook', apiLimiter, async (req, res) => {
    try {
        console.log('📩 PayPal webhook received:', req.body.event_type);
        
        const { event_type, resource } = req.body;
        const subscriptionId = resource?.id;
        const status = String(resource?.status || '').toUpperCase();
        const email = resource?.subscriber?.email_address?.toLowerCase().trim();
        
        // Save webhook event for debugging
        await redisSetJson(`paypal:webhook:${Date.now()}`, {
            event_type,
            subscriptionId,
            status,
            email,
            received_at: new Date().toISOString()
        });
        
        if (!email) {
            console.log('⚠️ No email in webhook, skipping');
            return res.status(200).json({ success: true, note: 'No email provided' });
        }
        
        // Handle subscription events
        switch (event_type) {
            case 'BILLING.SUBSCRIPTION.CREATED':
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                // Activate Essential monitoring
                const userData = {
                    email,
                    plan: 'essential',
                    subscriptionId,
                    status: 'active',
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    lastCheckedAt: null,
                    lastBreachHash: null,
                    breaches: [],
                    breachCount: 0,
                    lastAlertAt: null,
                    alertsSent: 0
                };
                
                await redisSetJson(`user:essential:${email}`, userData);
                await redisSAdd('monitor:active', email);
                await redisSetJson(`subscription:${subscriptionId}`, userData);
                
                console.log(`✅ Essential monitoring activated for: ${email}`);
                
                // Send welcome email
                try {
                    const transporter = createTransporter();
                    await transporter.sendMail({
                        from: `"ExposureShield" <${process.env.ZOHO_USER}>`,
                        to: email,
                        subject: '🎉 Welcome to ExposureShield Essential!',
                        html: `
                            <h2>Welcome to ExposureShield Essential!</h2>
                            <p>Your 24/7 security monitoring is now active.</p>
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Plan:</strong> Essential ($19.99/month)</p>
                            <p>You'll receive alerts whenever new breaches affect your email.</p>
                            <p>Visit your dashboard: https://exposureshield.com/dashboard</p>
                        `
                    });
                } catch (emailError) {
                    console.error('Failed to send welcome email:', emailError);
                }
                
                break;
                
            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
                // Deactivate monitoring
                const user = await redisGetJson(`user:essential:${email}`);
                if (user) {
                    user.status = 'cancelled';
                    user.enabled = false;
                    user.cancelledAt = new Date().toISOString();
                    
                    await redisSetJson(`user:essential:${email}`, user);
                    await redisSRem('monitor:active', email);
                    
                    console.log(`❌ Essential monitoring deactivated for: ${email}`);
                }
                break;
        }
        
        res.json({ 
            success: true,
            message: 'Webhook processed',
            event: event_type,
            email 
        });
        
    } catch (error) {
        console.error('PayPal webhook error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Manual Monitoring Trigger (for testing/cron)
app.post('/api/essential/monitor', monitoringLimiter, async (req, res) => {
    try {
        // Check authorization for cron
        const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
        const expectedSecret = process.env.CRON_SECRET;
        
        if (expectedSecret && cronSecret !== expectedSecret) {
            return res.status(401).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }
        
        console.log('🚀 Starting Essential monitoring run...');
        const startTime = Date.now();
        
        // Get all active subscribers
        const activeEmails = await redisSMembers('monitor:active');
        console.log(`📊 Found ${activeEmails.length} Essential subscribers to monitor`);
        
        let processed = 0;
        let alertsSent = 0;
        let errors = 0;
        
        // Process each subscriber (limit for demo)
        const batch = activeEmails.slice(0, 20);
        
        for (const email of batch) {
            try {
                processed++;
                
                // Get user data
                const userKey = `user:essential:${email}`;
                const user = await redisGetJson(userKey);
                
                if (!user || !user.enabled) {
                    console.log(`⏭️ Skipping ${email} - not active`);
                    continue;
                }
                
                console.log(`🔍 Checking ${email}...`);
                
                // Check HIBP for breaches
                const hibpResult = await checkHIBP(email);
                const breaches = hibpResult.breaches || [];
                const currentHash = generateBreachHash(breaches);
                
                // Check if breaches have changed
                if (user.lastBreachHash !== currentHash) {
                    // Determine new breaches
                    const previousBreachNames = user.breaches || [];
                    const currentBreachNames = breaches.map(b => b.Name);
                    const newBreaches = breaches.filter(b => !previousBreachNames.includes(b.Name));
                    
                    if (newBreaches.length > 0) {
                        console.log(`⚠️ ${newBreaches.length} new breaches for ${email}`);
                        
                        // Send alert email
                        try {
                            await sendMonitoringAlert(email, newBreaches, breaches.length);
                            alertsSent++;
                            user.alertsSent = (user.alertsSent || 0) + 1;
                            user.lastAlertAt = new Date().toISOString();
                        } catch (alertError) {
                            console.error(`Failed to send alert for ${email}:`, alertError);
                            errors++;
                        }
                    }
                    
                    // Update user record
                    user.lastBreachHash = currentHash;
                    user.lastCheckedAt = new Date().toISOString();
                    user.breaches = currentBreachNames;
                    user.breachCount = breaches.length;
                    
                    await redisSetJson(userKey, user);
                } else {
                    // No changes, just update timestamp
                    user.lastCheckedAt = new Date().toISOString();
                    await redisSetJson(userKey, user);
                }
                
                // Rate limiting: HIBP allows 1 request every 1.5 seconds
                await new Promise(resolve => setTimeout(resolve, 1600));
                
            } catch (error) {
                console.error(`❌ Error processing ${email}:`, error.message);
                errors++;
            }
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`✅ Monitoring completed in ${duration}s - Processed: ${processed}, Alerts: ${alertsSent}, Errors: ${errors}`);
        
        res.json({
            success: true,
            summary: {
                totalSubscribers: activeEmails.length,
                processed,
                alertsSent,
                errors,
                durationSeconds: duration
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Monitoring run failed:', error);
        res.status(500).json({
            success: false,
            error: 'Monitoring failed',
            message: error.message
        });
    }
});

// Get monitoring status for a user
app.get('/api/essential/status/:email', apiLimiter, async (req, res) => {
    try {
        const email = req.params.email.toLowerCase().trim();
        
        // Get user data
        const user = await redisGetJson(`user:essential:${email}`);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Not an Essential subscriber'
            });
        }
        
        res.json({
            success: true,
            data: {
                email: user.email,
                plan: user.plan,
                status: user.status,
                enabled: user.enabled,
                subscriptionId: user.subscriptionId,
                createdAt: user.createdAt,
                lastCheckedAt: user.lastCheckedAt,
                lastAlertAt: user.lastAlertAt,
                breachCount: user.breachCount || 0,
                alertsSent: user.alertsSent || 0,
                monitoringActive: user.enabled === true
            }
        });
        
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get all active subscribers (admin only)
app.get('/api/essential/subscribers', apiLimiter, async (req, res) => {
    try {
        // Simple admin check
        const adminToken = req.headers['x-admin-token'];
        if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        const activeEmails = await redisSMembers('monitor:active');
        const subscribers = [];
        
        for (const email of activeEmails.slice(0, 50)) {
            const user = await redisGetJson(`user:essential:${email}`);
            if (user) {
                subscribers.push({
                    email: user.email,
                    status: user.status,
                    createdAt: user.createdAt,
                    lastCheckedAt: user.lastCheckedAt,
                    breachCount: user.breachCount || 0,
                    alertsSent: user.alertsSent || 0
                });
            }
        }
        
        res.json({
            success: true,
            count: subscribers.length,
            subscribers
        });
        
    } catch (error) {
        console.error('Get subscribers error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Test monitoring for a specific email
app.post('/api/essential/test', monitoringLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email required' 
            });
        }
        
        console.log(`🧪 Testing monitoring for: ${email}`);
        
        // Add to monitoring temporarily
        const testUser = {
            email: email.toLowerCase().trim(),
            plan: 'essential',
            subscriptionId: 'test-' + Date.now(),
            status: 'active',
            enabled: true,
            createdAt: new Date().toISOString(),
            lastCheckedAt: null,
            lastBreachHash: null,
            breaches: [],
            breachCount: 0
        };
        
        await redisSetJson(`user:essential:${email}`, testUser);
        await redisSAdd('monitor:active', email);
        
        // Trigger immediate check
        const hibpResult = await checkHIBP(email);
        const breaches = hibpResult.breaches || [];
        
        // Send test alert if breaches found
        if (breaches.length > 0) {
            try {
                await sendMonitoringAlert(email, breaches.slice(0, 3), breaches.length);
                console.log(`✅ Test alert sent for ${email}`);
            } catch (alertError) {
                console.error('Test alert failed:', alertError);
            }
        }
        
        // Clean up test user after a minute
        setTimeout(async () => {
            await redisSRem('monitor:active', email);
            console.log(`🧹 Cleaned up test user: ${email}`);
        }, 60000);
        
        res.json({
            success: true,
            message: 'Test monitoring started',
            email,
            breachesFound: breaches.length,
            testDuration: '60 seconds'
        });
        
    } catch (error) {
        console.error('Test monitoring error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Test failed',
            message: error.message 
        });
    }
});

// ===== API ROUTES (Your Existing Routes - Keep These) =====

// Health Check (Updated with monitoring info)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'operational',
        service: 'exposureshield-api',
        timestamp: new Date().toISOString(),
        version: '2.1.0',
        environment: process.env.NODE_ENV || 'production',
        features: {
            emailCheck: true,
            contactForm: true,
            pdfReports: true,
            emailService: 'zoho',
            essentialMonitoring: true,
            monitoringInterval: '6 hours',
            alertSystem: 'resend'
        },
        monitoring: {
            active: true,
            plan: 'essential',
            price: '$19.99/month',
            includes: ['24/7 Dark Web Monitoring', 'Real-time Breach Alerts', 'Basic Identity Protection', 'Password Security Audit']
        }
    });
});

// Email Security Check (Existing - Keep This)
app.get('/api/check-email', emailCheckLimiter, async (req, res) => {
    try {
        const email = req.query.email;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email parameter is required'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        const result = await checkHIBP(email);
        
        res.json({
            success: true,
            email: email,
            breaches: result.breaches,
            status: result.status,
            count: result.breaches.length,
            timestamp: new Date().toISOString(),
            _meta: {
                source: 'haveibeenpwned.com',
                rateLimit: req.rateLimit
            }
        });

    } catch (error) {
        console.error('Email check error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Unable to check email security status',
            code: 'HIBP_API_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});

// Contact Form Submission (Existing - Keep This)
app.post('/api/contact', contactFormLimiter, async (req, res) => {
    // ... keep your existing contact form code ...
    // (The detailed contact form code you already have)
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3001;

// Test connections on startup
async function initializeServer() {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        
        console.log('✅ Zoho SMTP connection verified successfully');
        
        // Test essential monitoring setup
        const hasMonitoring = process.env.RESEND_API_KEY && process.env.UPSTASH_REDIS_REST_URL;
        
        app.listen(PORT, () => {
            console.log(`
🚀 ExposureShield Production Server Started!
────────────────────────────────────────────
📡 Port: ${PORT}
🌐 Environment: ${process.env.NODE_ENV || 'production'}
📧 Email Service: Zoho (${process.env.ZOHO_USER})
🔐 HIBP API: ${process.env.HIBP_API_KEY ? 'Configured' : 'Not configured'}
💰 Essential Monitoring: ${hasMonitoring ? '✅ Ready ($19.99/month)' : '❌ Not configured'}
🔒 Redis: ${process.env.UPSTASH_REDIS_REST_URL ? 'Configured' : 'Not configured'}
📨 Resend Alerts: ${process.env.RESEND_API_KEY ? 'Configured' : 'Not configured'}
🕒 Time: ${new Date().toLocaleString()}
────────────────────────────────────────────
✅ API Endpoints Ready:
   • GET  /api/health
   • GET  /api/check-email
   • POST /api/contact
   • POST /api/essential/webhook (PayPal)
   • POST /api/essential/monitor (Cron)
   • GET  /api/essential/status/:email
   • POST /api/essential/test
────────────────────────────────────────────
💰 Essential Plan Features:
   • 24/7 Dark Web Monitoring
   • Real-time Breach Alerts
   • Basic Identity Protection
   • Password Security Audit
   • Email Security Scanning
   • Identity Theft Insurance*
   • Family Protection*
   *Coming soon
────────────────────────────────────────────
            `);
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error.message);
        process.exit(1);
    }
}

initializeServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received. Shutting down gracefully...');
    process.exit(0);
});