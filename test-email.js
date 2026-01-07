// Test email configuration
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('🧪 Testing Zoho Email Configuration...');
    console.log('User:', process.env.ZOHO_USER);
    console.log('Password length:', process.env.ZOHO_PASS?.length);
    
    const transporter = nodemailer.createTransport({
        host: process.env.ZOHO_HOST,
        port: process.env.ZOHO_PORT,
        secure: process.env.ZOHO_SECURE === 'true',
        auth: {
            user: process.env.ZOHO_USER,
            pass: process.env.ZOHO_PASS
        },
        tls: {
            ciphers: 'SSLv3'
        }
    });
    
    try {
        // Verify connection
        console.log('🔌 Verifying SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection verified!');
        
        // Send test email
        console.log('📤 Sending test email...');
        const info = await transporter.sendMail({
            from: `"ExposureShield Test" <${process.env.ZOHO_USER}>`,
            to: process.env.PRIMARY_EMAIL,
            subject: '✅ ExposureShield Email Test',
            text: 'This is a test email from your ExposureShield backend.',
            html: '<h2>✅ Email Test Successful!</h2><p>Your Zoho SMTP configuration is working correctly.</p>'
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        
    } catch (error) {
        console.error('❌ Email test failed:', error.message);
        console.error('Error code:', error.code);
        console.error('Error command:', error.command);
        
        if (error.code === 'EAUTH') {
            console.error('\n🔑 Authentication failed. Please check:');
            console.error('1. App Password is correct: Wj18G0Zc3BS8');
            console.error('2. User email is correct: contact@exposureshield.com');
            console.error('3. Two-factor authentication is disabled or app password is used');
        }
    }
}

testEmail();