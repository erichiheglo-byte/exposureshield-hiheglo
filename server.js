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
            connectSrc: ["'self'", "https://exposureshield.com", "https://haveibeenpwned.com"],
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

// ===== HIBP API INTEGRATION =====
async function checkHIBP(email) {
    try {
        const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
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

// ===== API ROUTES =====

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'operational',
        service: 'exposureshield-api',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'production',
        features: {
            emailCheck: true,
            contactForm: true,
            pdfReports: true,
            emailService: 'zoho'
        }
    });
});

// Email Security Check
app.get('/api/check-email', emailCheckLimiter, async (req, res) => {
    try {
        const email = req.query.email;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email parameter is required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Check HIBP
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

// Contact Form Submission
app.post('/api/contact', contactFormLimiter, async (req, res) => {
    try {
        const { name, email, phone, company, category, priority, message } = req.body;
        
        // Validation
        if (!name || !email || !category || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                required: ['name', 'email', 'category', 'message']
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Honeypot check
        if (req.body._gotcha || req.body.website || req.body.honeypot) {
            console.log('🤖 Spam detected via honeypot');
            return res.json({
                success: true // Fake success to spammers
            });
        }

        const transporter = createTransporter();
        const timestamp = new Date().toLocaleString('en-US', {
            timeZone: 'America/New_York',
            dateStyle: 'full',
            timeStyle: 'long'
        });

        // Priority mapping
        const priorityMap = {
            low: { text: 'Low', emoji: '🟢', color: '#10b981' },
            medium: { text: 'Medium', emoji: '🟡', color: '#f59e0b' },
            high: { text: 'High', emoji: '🟠', color: '#f97316' },
            critical: { text: 'Critical', emoji: '🔴', color: '#ef4444' }
        };

        // Category mapping
        const categoryMap = {
            technical: 'Technical Support',
            sales: 'Sales & Pricing',
            enterprise: 'Enterprise Solutions',
            security: 'Security Consultation',
            compliance: 'Compliance & Auditing',
            partnership: 'Partnership Opportunities',
            other: 'Other Inquiry'
        };

        const priorityInfo = priorityMap[priority || 'medium'];
        const categoryName = categoryMap[category] || category;

        // Generate submission ID
        const submissionId = `ES-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        // Email to ExposureShield
        const adminMail = {
            from: `"ExposureShield Contact" <${process.env.ZOHO_USER}>`,
            replyTo: email,
            to: process.env.PRIMARY_EMAIL || 'contact@exposureshield.com',
            subject: `📨 New Contact: ${categoryName} - ${name}`,
            text: `
NEW CONTACT FORM SUBMISSION
===========================

Submission ID: ${submissionId}
Timestamp: ${timestamp}

👤 CONTACT INFORMATION
-----------------------
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Company: ${company || 'Not provided'}

📊 INQUIRY DETAILS
-------------------
Category: ${categoryName}
Priority: ${priorityInfo.emoji} ${priorityInfo.text}
IP Address: ${req.ip}

📝 MESSAGE
----------
${message}

────────────────────────────
🔒 ExposureShield Contact Form
📧 ${process.env.ZOHO_USER}
🌐 https://exposureshield.com
            `,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #1f2937; 
            background: #f9fafb; 
            padding: 20px; 
        }
        .container { 
            max-width: 700px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            overflow: hidden; 
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { 
            font-size: 24px; 
            font-weight: 700; 
            margin-bottom: 5px; 
        }
        .header-id {
            background: rgba(255,255,255,0.2);
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-family: monospace;
            margin-top: 10px;
            display: inline-block;
        }
        .content { 
            padding: 30px; 
        }
        .section { 
            margin-bottom: 25px; 
            padding: 20px; 
            background: #f8fafc; 
            border-radius: 8px; 
            border: 1px solid #e2e8f0; 
        }
        .section-title { 
            color: #2563eb; 
            font-size: 16px; 
            font-weight: 600; 
            margin-bottom: 15px; 
            display: flex; 
            align-items: center; 
            gap: 8px; 
        }
        .info-grid { 
            display: grid; 
            grid-template-columns: 1fr; 
            gap: 10px; 
        }
        .info-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px 0; 
            border-bottom: 1px solid #e5e7eb; 
        }
        .info-row:last-child { 
            border-bottom: none; 
        }
        .label { 
            font-weight: 600; 
            color: #4b5563; 
            min-width: 120px; 
        }
        .value { 
            color: #1f2937; 
            text-align: right; 
            flex: 1; 
        }
        .badge { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 13px; 
            font-weight: 600; 
            background: ${priorityInfo.color}15; 
            color: ${priorityInfo.color}; 
            border: 1px solid ${priorityInfo.color}30; 
        }
        .message-box { 
            background: #f1f5f9; 
            padding: 20px; 
            border-radius: 8px; 
            border-left: 4px solid #2563eb; 
            white-space: pre-wrap; 
            font-family: monospace; 
            font-size: 14px; 
            line-height: 1.5; 
        }
        .footer { 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            text-align: center; 
            color: #6b7280; 
            font-size: 13px; 
        }
        .footer a { 
            color: #2563eb; 
            text-decoration: none; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📨 New Contact Submission</h1>
            <p>ExposureShield Security Platform</p>
            <div class="header-id">${submissionId}</div>
        </div>
        
        <div class="content">
            <div class="section">
                <div class="section-title">👤 Contact Information</div>
                <div class="info-grid">
                    <div class="info-row">
                        <span class="label">Name:</span>
                        <span class="value">${name}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Email:</span>
                        <span class="value"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></span>
                    </div>
                    <div class="info-row">
                        <span class="label">Phone:</span>
                        <span class="value">${phone || 'Not provided'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Company:</span>
                        <span class="value">${company || 'Not provided'}</span>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">📊 Inquiry Details</div>
                <div class="info-grid">
                    <div class="info-row">
                        <span class="label">Category:</span>
                        <span class="value">${categoryName}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Priority:</span>
                        <span class="value">
                            <span class="badge">${priorityInfo.emoji} ${priorityInfo.text}</span>
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="label">Timestamp:</span>
                        <span class="value">${timestamp}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Submission ID:</span>
                        <span class="value">${submissionId}</span>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">📝 Message</div>
                <div class="message-box">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>
            
            <div class="footer">
                <p>🔒 This is an automated message from the ExposureShield contact form.</p>
                <p><strong>Reply to:</strong> <a href="mailto:${email}">${email}</a></p>
                <p style="margin-top: 15px;">
                    <a href="https://exposureshield.com">exposureshield.com</a> • 
                    Security-focused engineering • Privacy-first design
                </p>
            </div>
        </div>
    </div>
</body>
</html>
            `
        };

        // Auto-reply to User
        const userMail = {
            from: `"ExposureShield Support" <${process.env.ZOHO_USER}>`,
            to: email,
            subject: '✓ Thank you for contacting ExposureShield',
            text: `
Dear ${name},

Thank you for reaching out to ExposureShield. We have received your inquiry and our security team will review it shortly.

📋 Inquiry Summary:
• Category: ${categoryName}
• Priority: ${priorityInfo.text}
• Submission ID: ${submissionId}
• Submitted: ${timestamp}

⏱️ What to expect next:
1. Initial review within 24 hours
2. Detailed response from our security experts
3. Follow-up if additional information is needed

📞 For urgent matters:
Phone: (207) 992-7874
Hours: Monday-Friday, 9AM-5PM EST

🔒 Security Note:
All communications with ExposureShield are encrypted and handled with strict confidentiality in compliance with GDPR and CCPA regulations.

Best regards,
The ExposureShield Security Team

---
ExposureShield Security Solutions
Enterprise-grade digital protection
https://exposureshield.com
            `,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #1f2937; 
            background: #f9fafb; 
            padding: 20px; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            overflow: hidden; 
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #10b981 0%, #34d399 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .header-icon { 
            font-size: 48px; 
            margin-bottom: 15px; 
        }
        .header h1 { 
            font-size: 24px; 
            font-weight: 700; 
            margin-bottom: 5px; 
        }
        .content { 
            padding: 30px; 
        }
        .summary-box { 
            background: #f0f9ff; 
            border: 1px solid #7dd3fc; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
        }
        .summary-title { 
            color: #0369a1; 
            font-size: 16px; 
            font-weight: 600; 
            margin-bottom: 15px; 
        }
        .steps { 
            margin: 25px 0; 
        }
        .step { 
            display: flex; 
            align-items: flex-start; 
            gap: 15px; 
            margin-bottom: 20px; 
        }
        .step-number { 
            background: #2563eb; 
            color: white; 
            width: 32px; 
            height: 32px; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-weight: 600; 
            flex-shrink: 0; 
            font-size: 14px; 
        }
        .urgent-box { 
            background: #fef3c7; 
            border: 1px solid #fbbf24; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 25px 0; 
        }
        .security-box { 
            background: #f0f9ff; 
            border: 1px solid #7dd3fc; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 25px 0; 
        }
        .footer { 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            text-align: center; 
            color: #6b7280; 
            font-size: 13px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">✓</div>
            <h1>Message Received</h1>
            <p>ExposureShield Security Platform</p>
        </div>
        
        <div class="content">
            <p>Dear <strong>${name}</strong>,</p>
            <p>Thank you for reaching out to ExposureShield. We have received your inquiry and our security team will review it shortly.</p>
            
            <div class="summary-box">
                <div class="summary-title">📋 Inquiry Summary</div>
                <p><strong>Category:</strong> ${categoryName}</p>
                <p><strong>Priority:</strong> ${priorityInfo.emoji} ${priorityInfo.text}</p>
                <p><strong>Submission ID:</strong> ${submissionId}</p>
                <p><strong>Submitted:</strong> ${timestamp}</p>
            </div>
            
            <div class="steps">
                <div class="summary-title">⏱️ What to Expect Next</div>
                <div class="step">
                    <div class="step-number">1</div>
                    <div>Initial review within 24 hours</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div>Detailed response from security experts</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div>Follow-up if additional information is needed</div>
                </div>
            </div>
            
            <div class="urgent-box">
                <div class="summary-title">📞 For Urgent Matters</div>
                <p><strong>Phone:</strong> (207) 992-7874</p>
                <p><strong>Hours:</strong> Monday-Friday, 9AM-5PM EST</p>
                <p><strong>Response:</strong> Immediate for critical security issues</p>
            </div>
            
            <div class="security-box">
                <div class="summary-title">🔒 Security & Privacy Note</div>
                <p>All communications with ExposureShield are encrypted and handled with strict confidentiality in compliance with GDPR and CCPA regulations.</p>
            </div>
            
            <p>Best regards,<br>
            <strong>The ExposureShield Security Team</strong></p>
            
            <div class="footer">
                <p>
                    <a href="https://exposureshield.com" style="color: #2563eb; text-decoration: none; font-weight: 600;">exposureshield.com</a>
                    <br>Enterprise-grade digital protection • Privacy-first design
                </p>
            </div>
        </div>
    </div>
</body>
</html>
            `
        };

        // Send emails
        console.log(`📤 Sending contact email - Submission ID: ${submissionId}`);
        
        const [adminResult, userResult] = await Promise.all([
            transporter.sendMail(adminMail),
            transporter.sendMail(userMail)
        ]);

        console.log(`✅ Emails sent successfully for ${submissionId}`);

        // Response
        res.json({
            success: true,
            message: 'Contact form submitted successfully',
            data: {
                id: submissionId,
                timestamp: new Date().toISOString(),
                category: categoryName,
                priority: priorityInfo.text,
                autoReplySent: true,
                estimatedResponse: '24 hours'
            },
            _meta: {
                service: 'zoho-smtp',
                version: '2.0.0'
            }
        });

    } catch (error) {
        console.error('❌ Contact form error:', error);
        
        let userMessage = 'Failed to submit contact form. Please try again.';
        let errorCode = 'SUBMISSION_ERROR';
        
        if (error.code === 'EAUTH') {
            userMessage = 'Email service authentication failed.';
            errorCode = 'AUTH_ERROR';
        } else if (error.code === 'ECONNECTION') {
            userMessage = 'Cannot connect to email service.';
            errorCode = 'CONNECTION_ERROR';
        }
        
        res.status(500).json({
            success: false,
            error: userMessage,
            code: errorCode,
            _meta: {
                timestamp: new Date().toISOString(),
                service: 'zoho-smtp'
            }
        });
    }
});

// ===== PAYPAL WEBHOOK VERIFICATION =====
app.post('/api/paypal-webhook', apiLimiter, async (req, res) => {
    try {
        // Verify PayPal webhook signature here
        // This is a placeholder - implement actual PayPal webhook verification
        
        const { event_type, resource } = req.body;
        
        if (event_type === 'CHECKOUT.ORDER.APPROVED') {
            // Handle successful payment
            const payerEmail = resource.payer.email_address;
            const orderId = resource.id;
            
            console.log(`✅ PayPal payment approved: ${orderId} for ${payerEmail}`);
            
            // Mark email as paid in your system
            // You'd typically save this to a database
            
            res.json({ success: true, message: 'Webhook processed' });
        } else {
            res.json({ success: true, message: 'Webhook ignored' });
        }
        
    } catch (error) {
        console.error('PayPal webhook error:', error);
        res.status(400).json({ success: false, error: 'Invalid webhook' });
    }
});

// ===== PDF REPORT GENERATION WEBHOOK =====
app.post('/api/generate-pdf', apiLimiter, async (req, res) => {
    try {
        const { email, breaches, status, reportId } = req.body;
        
        // Validate request
        if (!email || !reportId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // In production, you would:
        // 1. Verify payment was made for this email
        // 2. Generate PDF using jsPDF or a PDF service
        // 3. Store PDF in S3/cloud storage
        // 4. Return download URL
        
        console.log(`📄 PDF requested for: ${email}, Report ID: ${reportId}`);
        
        // For now, return success - frontend handles PDF generation
        res.json({
            success: true,
            message: 'PDF generation request received',
            data: {
                reportId,
                email,
                status: 'queued',
                estimatedTime: '5 seconds'
            }
        });
        
    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process PDF request'
        });
    }
});

// ===== SYSTEM STATUS =====
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        system: 'ExposureShield API',
        version: '2.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'production',
        endpoints: [
            { path: '/api/health', method: 'GET', description: 'Health check' },
            { path: '/api/check-email', method: 'GET', description: 'Email security check' },
            { path: '/api/contact', method: 'POST', description: 'Contact form submission' },
            { path: '/api/status', method: 'GET', description: 'System status' }
        ]
    });
});

// ===== 404 HANDLER =====
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: 'The requested API endpoint does not exist',
        path: req.originalUrl,
        availableEndpoints: [
            'GET  /api/health',
            'GET  /api/check-email?email=you@example.com',
            'POST /api/contact',
            'GET  /api/status'
        ]
    });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
    console.error('🚨 Unhandled error:', err);
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        requestId: req.headers['x-request-id'] || Date.now(),
        timestamp: new Date().toISOString()
    });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3001;

// Test email connection on startup
async function initializeServer() {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        
        console.log('✅ Zoho SMTP connection verified successfully');
        
        app.listen(PORT, () => {
            console.log(`
🚀 ExposureShield Production Server Started!
────────────────────────────────────────────
📡 Port: ${PORT}
🌐 Environment: ${process.env.NODE_ENV || 'production'}
📧 Email Service: Zoho (${process.env.ZOHO_USER})
🔐 HIBP API: ${process.env.HIBP_API_KEY ? 'Configured' : 'Not configured'}
🔒 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'Not configured'}
💰 PayPal: ${process.env.PAYPAL_CLIENT_SECRET ? 'Configured' : 'Not configured'}
🕒 Time: ${new Date().toLocaleString()}
────────────────────────────────────────────
✅ API Endpoints Ready:
   • GET  /api/health
   • GET  /api/check-email
   • POST /api/contact
   • GET  /api/status
────────────────────────────────────────────
            `);
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error.message);
        console.error('Please check your Zoho App Password configuration');
        console.error('App Password:', process.env.ZOHO_PASS ? '***' + process.env.ZOHO_PASS.slice(-4) : 'Not set');
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