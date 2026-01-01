// FRONTEND PATCH: Use API status as single source of truth
document.addEventListener('DOMContentLoaded', function() {
    // Patch any existing checkEmail function
    const originalCheckEmail = window.checkEmail;
    if (originalCheckEmail) {
        window.checkEmail = async function(email) {
            const response = await fetch(`/api/check-email?email=${encodeURIComponent(email)}`);
            const data = await response.json();
            
            if (data.ok) {
                // OVERRIDE any frontend risk calculation with API's status
                const riskLevelElement = document.querySelector('[class*="risk"], [id*="risk"], .risk-level, #risk-level');
                if (riskLevelElement) {
                    riskLevelElement.textContent = 
                        data.status.charAt(0).toUpperCase() + data.status.slice(1);
                }
                
                // Call original function for other UI updates
                return originalCheckEmail.call(this, email);
            }
            return data;
        };
        console.log('Frontend patched: Using API status as single source of truth');
    }
});
