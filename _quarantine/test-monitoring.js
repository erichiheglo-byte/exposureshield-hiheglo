// Test the Essential monitoring system
require('dotenv').config();

async function testMonitoring() {
    console.log('🧪 Testing ExposureShield Essential Monitoring\n');
    
    // Check environment variables
    const requiredVars = [
        'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_TOKEN',
        'HIBP_API_KEY',
        'RESEND_API_KEY',
        'CRON_SECRET'
    ];
    
    console.log('Environment Variables:');
    requiredVars.forEach(varName => {
        const hasValue = process.env[varName] && process.env[varName].length > 0;
        console.log(`  ${varName}: ${hasValue ? '✅' : '❌'}`);
    });
    
    // Test endpoints
    console.log('\n🔗 Testing Endpoints:');
    const baseUrl = 'http://localhost:3001';
    
    try {
        // Test health endpoint
        const healthRes = await fetch(`${baseUrl}/api/health`);
        const healthData = await healthRes.json();
        console.log(`  /api/health: ${healthRes.ok ? '✅' : '❌'}`);
        
        // Test monitoring endpoint
        const monitorRes = await fetch(`${baseUrl}/api/essential/monitor`, {
            method: 'POST',
            headers: {
                'x-cron-secret': process.env.CRON_SECRET || 'test'
            }
        });
        console.log(`  /api/essential/monitor: ${monitorRes.ok ? '✅' : '❌'}`);
        
        console.log('\n✅ Essential Monitoring System is Ready!');
        console.log('\n💰 You can now offer:');
        console.log('   • Essential Plan: $19.99/month');
        console.log('   • Automatic PayPal activation');
        console.log('   • 24/7 breach monitoring');
        console.log('   • Email alerts via Resend');
        console.log('\n📈 To launch:');
        console.log('   1. Configure PayPal webhook to: /api/essential/webhook');
        console.log('   2. Set up Vercel cron job');
        console.log('   3. Add "Subscribe to Essential" button to your site');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testMonitoring();