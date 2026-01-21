// LegacyShield API Diagnostic Script
// Copy and paste this into browser Console (F12)

(async function() {
    console.log("🚀 Starting LegacyShield API Diagnostic");
    console.log("========================================");
    
    // 1. Check authentication state
    console.log("\n🔍 1. AUTHENTICATION STATE:");
    console.log("   Current URL:", window.location.href);
    
    const tokenKeys = ['token', 'access_token', 'auth_token', 'jwt'];
    tokenKeys.forEach(key => {
        const value = localStorage.getItem(key);
        console.log(`   localStorage.${key}:`, value ? `✓ (${value.length} chars)` : '✗');
    });
    
    console.log("   Cookies:", document.cookie ? `✓ (${document.cookie.length} chars)` : '✗');
    if (document.cookie) {
        console.log("   Cookie details:", document.cookie);
    }
    
    // 2. Test Bearer token
    console.log("\n🔑 2. TESTING BEARER TOKEN:");
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    
    if (token) {
        console.log("   Found token, length:", token.length);
        try {
            const response = await fetch('/api/legacy/get', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log("   Status:", response.status, response.statusText);
            
            if (response.ok) {
                const data = await response.json();
                console.log("   ✅ SUCCESS! Response:", data);
            } else {
                const errorText = await response.text();
                console.log("   ❌ FAILED:", errorText);
            }
        } catch (error) {
            console.log("   ❌ Network error:", error.message);
        }
    } else {
        console.log("   ⚠️ No token found in localStorage");
    }
    
    // 3. Test Cookies
    console.log("\n🍪 3. TESTING COOKIES:");
    try {
        const response = await fetch('/api/legacy/get', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log("   Status:", response.status, response.statusText);
        
        if (response.ok) {
            const data = await response.json();
            console.log("   ✅ SUCCESS! Response:", data);
        } else {
            const errorText = await response.text();
            console.log("   ❌ FAILED:", errorText);
        }
    } catch (error) {
        console.log("   ❌ Network error:", error.message);
    }
    
    // 4. Check dashboard function
    console.log("\n📊 4. CHECKING DASHBOARD FUNCTION:");
    if (typeof apiLegacyGet === 'function') {
        console.log("   ✅ apiLegacyGet function exists");
        try {
            console.log("   Calling apiLegacyGet()...");
            const result = await apiLegacyGet();
            console.log("   Result:", result);
        } catch (error) {
            console.log("   ❌ apiLegacyGet() error:", error.message);
        }
    } else {
        console.log("   ❌ apiLegacyGet function NOT FOUND");
    }
    
    // 5. Network request analysis
    console.log("\n🌐 5. NETWORK ANALYSIS:");
    console.log("   Open DevTools → Network tab");
    console.log("   Look for '/api/legacy/get' request");
    console.log("   Check Request Headers for 'Authorization' or 'Cookie'");
    console.log("   Check Response status and body");
    
    console.log("\n========================================");
    console.log("✅ Diagnostic complete!");
    
    // Generate summary
    console.log("\n📋 RECOMMENDATIONS:");
    const hasToken = !!token;
    const hasCookies = !!document.cookie;
    
    if (hasToken) {
        console.log("   • Your system uses localStorage tokens (Bearer auth)");
        console.log("   • Make sure /api/legacy/get.js accepts Bearer tokens");
    } else if (hasCookies) {
        console.log("   • Your system uses cookies for auth");
        console.log("   • Use 'credentials: include' in fetch() calls");
    } else {
        console.log("   • No auth method detected");
        console.log("   • You need to log in first");
    }
    
})();
