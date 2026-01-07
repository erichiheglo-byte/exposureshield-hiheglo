const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

// Contact form specific rate limiting (more restrictive)
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour per IP
    message: 'Too many contact requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation middleware
const validateContact = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s\-'.]+$/)
        .withMessage('Name contains invalid characters'),
    
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
    
    body('phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^[\d\s\-\+\(\)]{10,20}$/)
        .withMessage('Please provide a valid phone number'),
    
    body('company')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 200 })
        .withMessage('Company name too long'),
    
    body('category')
        .isIn(['technical', 'sales', 'enterprise', 'security', 'compliance', 'partnership', 'other'])
        .withMessage('Invalid category selected'),
    
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid priority level'),
    
    body('message')
        .trim()
        .isLength({ min: 10, max: 5000 })
        .withMessage('Message must be between 10 and 5000 characters')
        .escape(),
];

// Create Zoho transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.ZOHO_HOST || 'smtp.zoho.com',
        port: process.env.ZOHO_PORT || 587,
        secure: process.env.ZOHO_SECURE === 'true',
        auth: {
            user: process.env.ZOHO_USER,
            pass: process.env.ZOHO_PASS,
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 10000,
    });
};

// POST /api/contact - Submit contact form
router.post('/', contactLimiter, validateContact, async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array(),
                message: 'Validation failed'
            });
        }

        const { name, email, phone, company, category, priority, message } = req.body;
        
        // Check for honeypot/spam
        if (req.body._gotcha || req.body.website) {
            console.log('Spam detected via honeypot');
            return res.json({
                success: true, // Return success to spammers
                message: 'Message received'
            });
        }

        const transporter = createTransporter();
        const timestamp = new Date().toLocaleString('en-US', {
            timeZone: 'America/New_York'
        });

        // Priority badge
        const priorityBadges = {
            low: '🟢 Low',
            medium: '🟡 Medium',
            high: '🟠 High',
            critical: '🔴 Critical'
        };

        // Category mapping
        const categoryNames = {
            technical: 'Technical Support',
            sales: 'Sales & Pricing',
            enterprise: 'Enterprise Solutions',
            security: 'Security Consultation',
            compliance: 'Compliance & Auditing',
            partnership: 'Partnership Opportunities',
            other: 'Other Inquiry'
        };

        // Email to ExposureShield
        const adminMailOptions = {
            from: `"ExposureShield Contact Form" <${process.env.ZOHO_USER}>`,
            replyTo: email,
            to: process.env.ADMIN_EMAIL || 'contact@exposureshield.com',
            cc: process.env.CC_EMAIL ? process.env.CC_EMAIL.split(',') : [],
            subject: `New Contact: ${categoryNames[category]} - ${name}`,
            text: `
CONTACT FORM SUBMISSION - ExposureShield
=========================================

📋 BASIC INFORMATION
────────────────────
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Company: ${company || 'Not provided'}

📊 INQUIRY DETAILS
──────────────────
Category: ${categoryNames[category]}
Priority: ${priorityBadges[priority || 'medium']}
Submitted: ${timestamp}
IP Address: ${req.ip}

📝 MESSAGE
──────────
${message}

────────────────────
This is an automated message from the ExposureShield contact form.
DO NOT REPLY TO THIS EMAIL - Use reply-to address above.
            `,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 25px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 25px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; }
        .section { margin-bottom: 25px; padding: 20px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }
        .badge-low { background: #dcfce7; color: #166534; }
        .badge-medium { background: #fef3c7; color: #92400e; }
        .badge-high { background: #fee2e2; color: #991b1b; }
        .badge-critical { background: #fecaca; color: #7f1d1d; }
        .message-box { background: #f1f5f9; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; white-space: pre-wrap; }
        .footer { margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 0.85rem; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0; font-size: 1.5rem;">📨 New Contact Form Submission</h1>
        <p style="margin: 5px 0 0; opacity: 0.9; font-size: 0.95rem;">ExposureShield Security Platform</p>
    </div>
    
    <div class="content">
        <div class="section">
            <h2 style="margin-top: 0; color: #2563eb; font-size: 1.2rem;">👤 Contact Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; width: 120px; font-weight: 600;">Name:</td><td style="padding: 8px 0;">${name}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 600;">Email:</td><td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td></tr>
                <tr><td style="padding: 8px 0; font-weight: 600;">Phone:</td><td style="padding: 8px 0;">${phone || 'Not provided'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 600;">Company:</td><td style="padding: 8px 0;">${company || 'Not provided'}</td></tr>
            </table>
        </div>
        
        <div class="section">
            <h2 style="margin-top: 0; color: #2563eb; font-size: 1.2rem;">📊 Inquiry Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; width: 120px; font-weight: 600;">Category:</td><td style="padding: 8px 0;">${categoryNames[category]}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 600;">Priority:</td><td style="padding: 8px 0;">
                    <span class="badge badge-${priority || 'medium'}">${priorityBadges[priority || 'medium']}</span>
                </td></tr>
                <tr><td style="padding: 8px 0; font-weight: 600;">Submitted:</td><td style="padding: 8px 0;">${timestamp} EST</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 600;">IP Address:</td><td style="padding: 8px 0;">${req.ip}</td></tr>
            </table>
        </div>
        
        <div class="section">
            <h2 style="margin-top: 0; color: #2563eb; font-size: 1.2rem;">📝 Message Content</h2>
            <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
        </div>
        
        <div class="footer">
            <p>🔒 This is an automated message from the ExposureShield contact form.</p>
            <p><strong>DO NOT REPLY TO THIS EMAIL</strong> - Use the reply-to address (${email}) for responses.</p>
            <p style="margin-top: 15px; font-size: 0.8rem;">
                <a href="https://exposureshield.com" style="color: #64748b; text-decoration: none;">exposureshield.com</a> 
                • Security-focused engineering • Privacy-first design
            </p>
        </div>
    </div>
</body>
</html>
            `
        };

        // Auto-reply to user
        const userMailOptions = {
            from: `"ExposureShield Support" <${process.env.ZOHO_USER}>`,
            to: email,
            subject: 'Thank you for contacting ExposureShield',
            text: `
Dear ${name},

Thank you for reaching out to ExposureShield. We have received your inquiry and our security team will review it shortly.

📋 Inquiry Summary:
- Category: ${categoryNames[category]}
- Priority: ${priorityBadges[priority || 'medium']}
- Submitted: ${timestamp}

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
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 25px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 25px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; }
        .summary { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; }
        .steps { margin: 25px 0; }
        .step { display: flex; align-items: flex-start; gap: 15px; margin-bottom: 15px; }
        .step-number { background: #2563eb; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
        .urgent-box { background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .security-note { background: #f0f9ff; border: 1px solid #7dd3fc; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .footer { margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 0.85rem; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0; font-size: 1.5rem;">✓ Message Received</h1>
        <p style="margin: 5px 0 0; opacity: 0.9; font-size: 0.95rem;">ExposureShield Security Platform</p>
    </div>
    
    <div class="content">
        <p>Dear <strong>${name}</strong>,</p>
        
        <p>Thank you for reaching out to ExposureShield. We have received your inquiry and our security team will review it shortly.</p>
        
        <div class="summary">
            <h3 style="margin-top: 0; color: #2563eb; font-size: 1.1rem;">📋 Inquiry Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; width: 100px; font-weight: 600;">Category:</td><td style="padding: 6px 0;">${categoryNames[category]}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: 600;">Priority:</td><td style="padding: 6px 0;">${priorityBadges[priority || 'medium']}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: 600;">Submitted:</td><td style="padding: 6px 0;">${timestamp} EST</td></tr>
            </table>
        </div>
        
        <div class="steps">
            <h3 style="margin-top: 0; color: #2563eb; font-size: 1.1rem;">⏱️ What to Expect Next</h3>
            <div class="step">
                <div class="step-number">1</div>
                <div>Initial review by our security team within 24 hours</div>
            </div>
            <div class="step">
                <div class="step-number">2</div>
                <div>Detailed response from a security expert in your inquiry category</div>
            </div>
            <div class="step">
                <div class="step-number">3</div>
                <div>Follow-up if additional information is needed for your case</div>
            </div>
        </div>
        
        <div class="urgent-box">
            <h4 style="margin-top: 0; color: #92400e; font-size: 1rem;">📞 For Urgent Matters</h4>
            <p style="margin: 10px 0;">
                <strong>Phone:</strong> (207) 992-7874<br>
                <strong>Hours:</strong> Monday-Friday, 9AM-5PM EST<br>
                <strong>Response:</strong> Immediate for critical security issues
            </p>
        </div>
        
        <div class="security-note">
            <h4 style="margin-top: 0; color: #0369a1; font-size: 1rem;">🔒 Security & Privacy Note</h4>
            <p style="margin: 10px 0; font-size: 0.95rem;">
                All communications with ExposureShield are encrypted and handled with strict confidentiality 
                in compliance with GDPR and CCPA regulations. We never share your information with third parties.
            </p>
        </div>
        
        <p>Best regards,<br>
        <strong>The ExposureShield Security Team</strong></p>
        
        <div class="footer">
            <p>
                <a href="https://exposureshield.com" style="color: #2563eb; text-decoration: none; font-weight: 600;">exposureshield.com</a>
                <br>Enterprise-grade digital protection • Privacy-first design
            </p>
            <p style="font-size: 0.8rem; margin-top: 10px;">
                This is an automated message. Please do not reply to this email.<br>
                For inquiries, respond to the support thread that will follow.
            </p>
        </div>
    </div>
</body>
</html>
            `
        };

        // Send both emails
        await Promise.all([
            transporter.sendMail(adminMailOptions),
            transporter.sendMail(userMailOptions)
        ]);

        console.log(`✅ Contact form submitted: ${name} <${email}> - ${categoryNames[category]}`);

        res.json({
            success: true,
            message: 'Contact form submitted successfully',
            data: {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                category: categoryNames[category],
                priority: priority
            }
        });

    } catch (error) {
        console.error('❌ Contact form error:', error);
        
        // Differentiate between validation errors and server errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: [error.message]
            });
        }

        // Handle email sending errors
        if (error.code === 'EAUTH') {
            return res.status(500).json({
                success: false,
                message: 'Email service configuration error',
                code: 'EMAIL_CONFIG_ERROR'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to submit contact form',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// GET /api/contact/status - Check contact service status
router.get('/status', async (req, res) => {
    try {
        const transporter = createTransporter();
        
        // Verify SMTP connection
        await transporter.verify();
        
        res.json({
            success: true,
            service: 'contact',
            status: 'operational',
            timestamp: new Date().toISOString(),
            emailService: process.env.EMAIL_SERVICE || 'Zoho',
            message: 'Contact form service is running normally'
        });
    } catch (error) {
        console.error('Contact service status check failed:', error);
        res.status(503).json({
            success: false,
            service: 'contact',
            status: 'degraded',
            timestamp: new Date().toISOString(),
            error: 'Email service temporarily unavailable',
            message: 'Contact form submissions may be delayed'
        });
    }
});

module.exports = router;