// ============================================
// EXPOSURESHIELD v3.0
// ============================================

const CONFIG = {
    VERSION: '3.0',
    BACKEND_LIVE: false
};

// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Waitlist manager (local storage)
const WaitlistManager = {
    STORAGE_KEY: 'exposureshield_waitlist',
    
    save(email) {
        try {
            const entries = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            entries.push({
                email: email,
                timestamp: new Date().toISOString(),
                id: Date.now()
            });
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
            return true;
        } catch (error) {
            console.error('Save error:', error);
            return false;
        }
    },
    
    count() {
        try {
            const entries = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            return entries.length;
        } catch (error) {
            return 0;
        }
    }
};

// Main scanner function
async function checkEmail() {
    const emailInput = document.getElementById('emailInput');
    const email = emailInput.value.trim();
    const resultsDiv = document.getElementById('results');
    const button = document.querySelector('.scan-form button');
    
    // Clear previous results
    resultsDiv.innerHTML = '';
    
    // Validate
    if (!email) {
        resultsDiv.innerHTML = '<div class="alert error">⚠️ Please enter an email address</div>';
        return;
    }
    
    if (!validateEmail(email)) {
        resultsDiv.innerHTML = '<div class="alert error">❌ Please enter a valid email address</div>';
        return;
    }
    
    // Show scanning
    button.textContent = '🔄 Scanning...';
    button.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        // Demo result
        resultsDiv.innerHTML = \`
            <div class="result-card">
                <div class="result-header">
                    <span class="result-icon">🎯</span>
                    <h3>Launch Preview Active</h3>
                </div>
                <div style="color: #cbd5e1; line-height: 1.6;">
                    <p><strong>Email checked:</strong> <code>\${email}</code></p>
                    <p>When ExposureShield fully launches, you'll see:</p>
                    <ul style="margin: 15px 0 15px 20px;">
                        <li>Real-time breach detection from 780+ databases</li>
                        <li>Detailed exposure reports</li>
                        <li>Actionable security recommendations</li>
                    </ul>
                    
                    <div style="background: rgba(102, 126, 234, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h4 style="margin-bottom: 10px;">🚀 Launching This Week!</h4>
                        <p>Backend deployment in progress. The full scanner will be live within 24-48 hours.</p>
                        <p style="margin-top: 10px;"><small>Already <strong>\${WaitlistManager.count()}</strong> people have joined the waitlist.</small></p>
                    </div>
                </div>
            </div>
        \`;
        
        button.textContent = '🔍 Scan Again';
        button.disabled = false;
    }, 2000);
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log(\`✅ ExposureShield \${CONFIG.VERSION} loaded\`);
    
    // Enter key support
    const emailInput = document.getElementById('emailInput');
    if (emailInput) {
        emailInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                checkEmail();
            }
        });
    }
    
    // Show waitlist count
    const count = WaitlistManager.count();
    if (count > 0) {
        console.log(\`📊 Waitlist entries: \${count}\`);
    }
});

// Utility functions
function scrollToWaitlist() {
    const waitlistSection = document.querySelector('section');
    if (waitlistSection) {
        waitlistSection.scrollIntoView({ behavior: 'smooth' });
    }
}
