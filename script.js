// ============================================
// EXPOSURESHIELD v3.5 - Professional Frontend
// ============================================

// CONFIGURATION
const CONFIG = {
    APP_NAME: 'ExposureShield',
    VERSION: '3.5',
    // Set to true when you have HIBP API key
    BACKEND_LIVE: false,
    // Your HIBP API key will go here later
    HIBP_API_KEY: 'YOUR_API_KEY_HERE',
    // Simulated data for demo mode
    DEMO_BREACHES: [
        {
            name: 'Endgame',
            date: '2023-11-13',
            dataClasses: ['Email addresses', 'Passwords', 'Usernames'],
            description: 'A coordinated takedown of major cybercrime infrastructure affecting millions.'
        },
        {
            name: 'Collection #1',
            date: '2019-01-07',
            dataClasses: ['Email addresses', 'Passwords'],
            description: 'One of the largest collections of breached data circulating on hacking forums.'
        }
    ]
};

// DOM Elements
const emailInput = document.getElementById('emailInput');
const scanButton = document.getElementById('scanButton');
const resultsContainer = document.getElementById('resultsContainer');
const loadingSpinner = document.getElementById('loadingSpinner');
const breachCount = document.getElementById('breachCount');
const userCount = document.getElementById('userCount');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log(`${CONFIG.APP_NAME} v${CONFIG.VERSION} initialized`);
    updateStats();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    if (emailInput && scanButton) {
        scanButton.addEventListener('click', performScan);
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performScan();
        });
    }
}

// Email Validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Format Date
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Show Loading State
function showLoading() {
    scanButton.disabled = true;
    scanButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Scanning...';
    if (loadingSpinner) loadingSpinner.classList.remove('hidden');
    if (resultsContainer) resultsContainer.innerHTML = '';
}

// Hide Loading State
function hideLoading() {
    scanButton.disabled = false;
    scanButton.innerHTML = '<i class="fas fa-search mr-2"></i> Check Exposure';
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
}

// Display Results
function displayResults(email, breaches, isDemo = true) {
    if (!resultsContainer) return;
    
    let resultsHTML;
    
    if (breaches.length === 0) {
        // Safe result
        resultsHTML = `
            <div class="bg-gradient-to-r from-green-50 to-emerald-100 border border-green-200 rounded-2xl p-8 shadow-lg">
                <div class="flex items-center justify-center mb-6">
                    <div class="bg-green-100 p-4 rounded-full">
                        <i class="fas fa-shield-check text-4xl text-green-600"></i>
                    </div>
                </div>
                <h3 class="text-2xl font-bold text-gray-800 text-center mb-4">✅ No Breaches Found</h3>
                <p class="text-gray-600 text-center mb-6">
                    <strong>${email}</strong> wasn't found in our database of known breaches.
                </p>
                <div class="bg-white rounded-lg p-6 border border-green-200">
                    <h4 class="font-bold text-gray-800 mb-3">🔒 Security Recommendations:</h4>
                    <ul class="space-y-2 text-gray-600">
                        <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Use strong, unique passwords</li>
                        <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Enable two-factor authentication</li>
                        <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Consider a password manager</li>
                    </ul>
                </div>
            </div>
        `;
    } else {
        // Breaches found
        resultsHTML = `
            <div class="bg-gradient-to-r from-red-50 to-orange-100 border border-red-200 rounded-2xl p-8 shadow-lg">
                <div class="flex items-center justify-center mb-6">
                    <div class="bg-red-100 p-4 rounded-full">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-600"></i>
                    </div>
                </div>
                <h3 class="text-2xl font-bold text-gray-800 text-center mb-4">⚠️ ${breaches.length} Breach${breaches.length > 1 ? 'es' : ''} Found</h3>
                <p class="text-gray-600 text-center mb-8">
                    <strong>${email}</strong> appeared in ${breaches.length} data breach${breaches.length > 1 ? 'es' : ''}.
                </p>
                
                <div class="space-y-6">
                    ${breaches.map(breach => `
                        <div class="bg-white rounded-xl p-6 border border-gray-200">
                            <div class="flex justify-between items-start mb-4">
                                <h4 class="text-xl font-bold text-gray-800">${breach.name}</h4>
                                <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                                    ${formatDate(breach.date)}
                                </span>
                            </div>
                            <p class="text-gray-600 mb-4">${breach.description}</p>
                            <div class="mb-4">
                                <h5 class="font-medium text-gray-800 mb-2">Compromised Data:</h5>
                                <div class="flex flex-wrap gap-2">
                                    ${breach.dataClasses.map(data => `
                                        <span class="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                                            ${data}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="mt-8 bg-white rounded-xl p-6 border border-red-200">
                    <h4 class="font-bold text-gray-800 mb-4">🚨 Immediate Actions Required:</h4>
                    <ol class="space-y-3 text-gray-600 list-decimal pl-5">
                        <li><strong>Change your password</strong> for any account using this email</li>
                        <li><strong>Enable 2FA</strong> on important accounts (email, banking, social media)</li>
                        <li><strong>Use a password manager</strong> like Bitwarden or 1Password</li>
                        <li><strong>Monitor your accounts</strong> for suspicious activity</li>
                    </ol>
                </div>
            </div>
        `;
    }
    
    // Add demo notice if needed
    if (isDemo) {
        resultsHTML += `
            <div class="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                <p class="text-blue-800">
                    <i class="fas fa-info-circle mr-2"></i>
                    <strong>Demo Mode:</strong> This scan used simulated data. Add your HaveIBeenPwned API key for real breach checking.
                </p>
            </div>
        `;
    }
    
    resultsContainer.innerHTML = resultsHTML;
    
    // Smooth scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

// Simulate API Call (Demo Mode)
function simulateAPICall(email) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Randomly return breaches or safe result for demo
            const hasBreaches = Math.random() > 0.4;
            resolve({
                email: email,
                breaches: hasBreaches ? CONFIG.DEMO_BREACHES : [],
                timestamp: new Date().toISOString()
            });
        }, 1500);
    });
}

// Main Scan Function
async function performScan() {
    const email = emailInput ? emailInput.value.trim() : '';
    
    // Validation
    if (!email) {
        alert('Please enter an email address');
        return;
    }
    
    if (!validateEmail(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    // Show loading
    showLoading();
    
    try {
        let result;
        
        if (CONFIG.BACKEND_LIVE && CONFIG.HIBP_API_KEY !== 'YOUR_API_KEY_HERE') {
            // Real API call (when you add your key)
            result = await callHIBPAPI(email);
        } else {
            // Demo mode
            result = await simulateAPICall(email);
        }
        
        // Display results
        displayResults(result.email, result.breaches, !CONFIG.BACKEND_LIVE);
        
        // Update stats
        updateStats();
        
    } catch (error) {
        console.error('Scan error:', error);
        resultsContainer.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center">
                <i class="fas fa-exclamation-circle text-4xl text-yellow-500 mb-4"></i>
                <h3 class="text-xl font-bold text-gray-800 mb-2">Scan Temporarily Unavailable</h3>
                <p class="text-gray-600">Please try again in a few moments.</p>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Real HIBP API Call (Ready for your key)
async function callHIBPAPI(email) {
    // This will work when you add your API key
    const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
        headers: {
            'hibp-api-key': CONFIG.HIBP_API_KEY,
            'User-Agent': CONFIG.APP_NAME
        }
    });
    
    if (response.status === 404) {
        return { email, breaches: [] };
    }
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    
    const breaches = await response.json();
    return { email, breaches };
}

// Update Statistics
function updateStats() {
    if (breachCount) {
        breachCount.textContent = '4.5B+';
    }
    if (userCount) {
        userCount.textContent = '1.2M+';
    }
}

// Export for debugging
window.ExposureShield = {
    performScan,
    validateEmail,
    CONFIG
};
// ============================================
// LEGACYSHIELD WAITLIST
// ============================================

// Waitlist Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const waitlistForm = document.getElementById('waitlistForm');
    const successMessage = document.getElementById('successMessage');
    
    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitButton = waitlistForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            
            // Get form data
            const formData = {
                email: document.getElementById('waitlistEmail').value.trim(),
                assets: Array.from(document.querySelectorAll('input[name="assets"]:checked'))
                    .map(cb => cb.value),
                priority: document.getElementById('priority').value,
                comments: document.getElementById('comments').value.trim(),
                timestamp: new Date().toISOString(),
                source: 'exposureshield-website'
            };
            
            // Validation
            if (formData.assets.length === 0) {
                alert('Please select at least one type of digital asset');
                return;
            }
            
            // Show loading
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
            
            try {
                // For now, just simulate API call
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Show success
                waitlistForm.classList.add('hidden');
                successMessage.classList.remove('hidden');
                
                // In the future, you can send to your backend:
                // await fetch('/api/waitlist', {
                //     method: 'POST',
                //     headers: {'Content-Type': 'application/json'},
                //     body: JSON.stringify(formData)
                // });
                
                console.log('Waitlist submission:', formData);
                
            } catch (error) {
                console.error('Waitlist error:', error);
                alert('Something went wrong. Please try again.');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
        });
    }
});

// Reset waitlist form
function resetWaitlistForm() {
    const form = document.getElementById('waitlistForm');
    const successMessage = document.getElementById('successMessage');
    
    if (form && successMessage) {
        form.reset();
        form.classList.remove('hidden');
        successMessage.classList.add('hidden');
    }
}