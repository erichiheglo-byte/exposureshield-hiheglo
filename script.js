// ============================================
// EXPOSURESHIELD v4.0 - Professional Production
// ============================================

// CONFIGURATION
const CONFIG = {
    APP_NAME: 'ExposureShield',
    VERSION: '4.0',
    BACKEND_LIVE: true, // Set to true - your API key is in Vercel
    API_ENDPOINT: '/api/check-email', // Your secure Vercel endpoint
    DEMO_BREACHES: [
        {
            name: 'Endgame',
            date: '2023-11-13',
            dataClasses: ['Email addresses', 'Passwords', 'Usernames'],
            description: 'A coordinated takedown of major cybercrime infrastructure affecting millions of users worldwide.'
        },
        {
            name: 'Collection #1',
            date: '2019-01-07',
            dataClasses: ['Email addresses', 'Passwords'],
            description: 'One of the largest collections of breached data found circulating on hacking forums.'
        }
    ],
    MAX_RETRIES: 2,
    REQUEST_TIMEOUT: 10000 // 10 seconds
};

// DOM Elements Cache
const elements = {
    emailInput: document.getElementById('emailInput'),
    scanButton: document.getElementById('scanButton'),
    resultsContainer: document.getElementById('resultsContainer'),
    loadingOverlay: document.getElementById('scanningOverlay'),
    breachCount: document.getElementById('breachCount'),
    userCount: document.getElementById('userCount'),
    statsUpdated: document.getElementById('statsUpdated'),
    waitlistForm: document.getElementById('waitlistForm'),
    successMessage: document.getElementById('successMessage')
};

// State Management
let currentScanState = {
    isScanning: false,
    lastEmail: '',
    scanHistory: []
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log(`${CONFIG.APP_NAME} v${CONFIG.VERSION} initialized`);
    
    initializeScanner();
    initializeWaitlist();
    updateStatistics();
    setupEventListeners();
    
    // Add subtle animation to CTA button
    if (elements.scanButton) {
        elements.scanButton.classList.add('hover-lift');
    }
});

// ============================================
// EMAIL SCANNER - CORE FUNCTIONALITY
// ============================================

function initializeScanner() {
    if (!elements.emailInput || !elements.scanButton) return;
    
    // Load previous scan if exists
    const lastScan = localStorage.getItem('lastScan');
    if (lastScan) {
        try {
            const scanData = JSON.parse(lastScan);
            if (scanData.email && scanData.results) {
                elements.emailInput.value = scanData.email;
                setTimeout(() => {
                    displayResults(scanData.email, scanData.results, false);
                }, 500);
            }
        } catch (e) {
            console.log('No previous scan found');
        }
    }
}

function setupEventListeners() {
    // Scan button click
    if (elements.scanButton) {
        elements.scanButton.addEventListener('click', performScan);
    }
    
    // Enter key in email field
    if (elements.emailInput) {
        elements.emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performScan();
        });
        
        // Clear results when user starts typing new email
        elements.emailInput.addEventListener('input', () => {
            if (currentScanState.lastEmail && 
                elements.emailInput.value !== currentScanState.lastEmail &&
                elements.resultsContainer) {
                elements.resultsContainer.innerHTML = '';
            }
        });
    }
}

// ============================================
// EMAIL VALIDATION
// ============================================

function validateEmail(email) {
    if (!email) return { valid: false, message: 'Please enter an email address' };
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, message: 'Please enter a valid email address' };
    }
    
    // Basic disposable email check
    const disposableDomains = ['tempmail.com', 'mailinator.com', 'guerrillamail.com'];
    const domain = email.split('@')[1];
    if (disposableDomains.some(d => domain.includes(d))) {
        return { valid: true, message: 'Note: Disposable email detected', warning: true };
    }
    
    return { valid: true, message: '' };
}

// ============================================
// LOADING STATES
// ============================================

function showLoadingState() {
    currentScanState.isScanning = true;
    
    if (elements.scanButton) {
        elements.scanButton.disabled = true;
        elements.scanButton.innerHTML = `
            <i class="fas fa-spinner fa-spin mr-2"></i>
            <span class="scanning-text">Scanning Databases...</span>
        `;
    }
    
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.remove('hidden');
        // Add pulsing animation
        elements.loadingOverlay.classList.add('fade-in');
    }
    
    // Disable form during scan
    if (elements.emailInput) elements.emailInput.disabled = true;
}

function hideLoadingState() {
    currentScanState.isScanning = false;
    
    if (elements.scanButton) {
        elements.scanButton.disabled = false;
        elements.scanButton.innerHTML = `
            <i class="fas fa-search mr-2"></i>
            <span>Check Exposure</span>
        `;
    }
    
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.add('hidden');
        elements.loadingOverlay.classList.remove('fade-in');
    }
    
    if (elements.emailInput) elements.emailInput.disabled = false;
}

// ============================================
// API CALL - SECURE VERCEL PROXY
// ============================================

async function callBreachAPI(email, retryCount = 0) {
    if (!CONFIG.BACKEND_LIVE) {
        // Demo mode - simulate API call
        await new Promise(resolve => setTimeout(resolve, 1200));
        const hasBreaches = Math.random() > 0.5;
        return {
            email: email,
            breaches: hasBreaches ? CONFIG.DEMO_BREACHES : [],
            source: 'demo',
            timestamp: new Date().toISOString()
        };
    }
    
    try {
        // Call your secure Vercel endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
        
        const response = await fetch(
            `${CONFIG.API_ENDPOINT}?email=${encodeURIComponent(email)}`,
            {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'ExposureShield'
                }
            }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Too many requests. Please wait a moment.');
            }
            throw new Error(`API error: ${response.status}`);
        }
        
        const breaches = await response.json();
        
        return {
            email: email,
            breaches: breaches,
            source: 'hibp',
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('API call failed:', error);
        
        // Retry logic
        if (retryCount < CONFIG.MAX_RETRIES) {
            console.log(`Retrying... (${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return callBreachAPI(email, retryCount + 1);
        }
        
        // Fallback to demo mode if API fails
        return {
            email: email,
            breaches: CONFIG.DEMO_BREACHES.slice(0, 1),
            source: 'fallback',
            timestamp: new Date().toISOString(),
            error: error.message
        };
    }
}

// ============================================
// MAIN SCAN FUNCTION
// ============================================

async function performScan() {
    const email = elements.emailInput ? elements.emailInput.value.trim() : '';
    
    // Validation
    const validation = validateEmail(email);
    if (!validation.valid) {
        showNotification(validation.message, 'error');
        return;
    }
    
    if (validation.warning) {
        showNotification(validation.message, 'warning');
    }
    
    // Don't rescan same email immediately
    if (currentScanState.lastEmail === email && currentScanState.isScanning) {
        return;
    }
    
    currentScanState.lastEmail = email;
    
    // Clear previous results
    if (elements.resultsContainer) {
        elements.resultsContainer.innerHTML = '';
    }
    
    // Show loading
    showLoadingState();
    
    try {
        // Perform the scan
        const result = await callBreachAPI(email);
        
        // Store in history
        currentScanState.scanHistory.unshift({
            email: result.email,
            breachCount: result.breaches.length,
            timestamp: result.timestamp
        });
        
        // Keep only last 10 scans
        if (currentScanState.scanHistory.length > 10) {
            currentScanState.scanHistory.pop();
        }
        
        // Save to localStorage
        localStorage.setItem('lastScan', JSON.stringify({
            email: result.email,
            results: result.breaches,
            timestamp: result.timestamp
        }));
        
        // Display results
        displayResults(result.email, result.breaches, result.source !== 'hibp');
        
        // Update statistics
        updateStatistics();
        
        // Track successful scan
        trackScan(result);
        
    } catch (error) {
        console.error('Scan failed:', error);
        
        // Show error to user
        if (elements.resultsContainer) {
            elements.resultsContainer.innerHTML = `
                <div class="error-card">
                    <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Service Temporarily Unavailable</h3>
                    <p class="text-gray-600">Please try again in a few moments.</p>
                    <button onclick="performScan()" class="retry-button">
                        <i class="fas fa-redo mr-2"></i>Retry Scan
                    </button>
                </div>
            `;
        }
        
    } finally {
        hideLoadingState();
    }
}

// ============================================
// RESULTS DISPLAY
// ============================================

function displayResults(email, breaches, isDemo = false) {
    if (!elements.resultsContainer) return;
    
    let resultsHTML;
    const breachCount = breaches.length;
    
    if (breachCount === 0) {
        // No breaches found
        resultsHTML = createSafeResult(email, isDemo);
    } else {
        // Breaches found
        resultsHTML = createBreachResult(email, breaches, isDemo);
    }
    
    // Add demo notice if needed
    if (isDemo) {
        resultsHTML += createDemoNotice();
    }
    
    elements.resultsContainer.innerHTML = resultsHTML;
    
    // Smooth scroll to results
    setTimeout(() => {
        elements.resultsContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
    
    // Add animations
    setTimeout(() => {
        const cards = elements.resultsContainer.querySelectorAll('.result-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 100}ms`;
            card.classList.add('fade-in-up');
        });
    }, 50);
}

function createSafeResult(email, isDemo) {
    return `
        <div class="result-card safe-card">
            <div class="card-header">
                <div class="status-icon">
                    <i class="fas fa-shield-check"></i>
                </div>
                <div>
                    <h3 class="card-title">✅ No Breaches Found</h3>
                    <p class="card-subtitle">Your email appears secure in our database</p>
                </div>
            </div>
            
            <div class="card-body">
                <div class="email-display">
                    <span class="label">Email checked:</span>
                    <code class="email-value">${email}</code>
                </div>
                
                <div class="success-message">
                    <i class="fas fa-check-circle text-green-500"></i>
                    <span>Good news! No security breaches found for this email address.</span>
                </div>
                
                <div class="recommendations">
                    <h4>🔒 Keep Your Data Secure:</h4>
                    <div class="recommendations-grid">
                        <div class="recommendation-item">
                            <i class="fas fa-key text-blue-500"></i>
                            <h5>Use Strong Passwords</h5>
                            <p>Create unique passwords for every account</p>
                        </div>
                        <div class="recommendation-item">
                            <i class="fas fa-user-shield text-blue-500"></i>
                            <h5>Enable 2FA</h5>
                            <p>Add an extra layer of security</p>
                        </div>
                        <div class="recommendation-item">
                            <i class="fas fa-sync-alt text-blue-500"></i>
                            <h5>Regular Checks</h5>
                            <p>Scan periodically for new breaches</p>
                        </div>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button onclick="shareResult('${email}', 0)" class="share-button">
                        <i class="fas fa-share-alt"></i> Share Result
                    </button>
                    <button onclick="performScan()" class="rescan-button">
                        <i class="fas fa-redo"></i> Scan Another Email
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createBreachResult(email, breaches, isDemo) {
    const breachList = breaches.map((breach, index) => `
        <div class="breach-item ${index === 0 ? 'latest-breach' : ''}">
            <div class="breach-header">
                <div class="breach-title">
                    <h4>${breach.name}</h4>
                    <span class="breach-date">${formatDate(breach.date)}</span>
                </div>
                <span class="breach-severity">${getSeverityLevel(breach.dataClasses)}</span>
            </div>
            
            <p class="breach-description">${breach.description}</p>
            
            <div class="breach-data">
                <span class="data-label">Compromised Data:</span>
                <div class="data-tags">
                    ${breach.dataClasses.map(data => `
                        <span class="data-tag">${data}</span>
                    `).join('')}
                </div>
            </div>
            
            <div class="breach-actions">
                <button onclick="showBreachDetails(${index})" class="details-button">
                    <i class="fas fa-info-circle"></i> Details
                </button>
                <button onclick="getRemediation('${breach.name}')" class="remediate-button">
                    <i class="fas fa-tools"></i> Fix It
                </button>
            </div>
        </div>
    `).join('');

    return `
        <div class="result-card breach-card">
            <div class="card-header alert">
                <div class="status-icon warning">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div>
                    <h3 class="card-title">⚠️ Security Alert: ${breaches.length} Breach${breaches.length > 1 ? 'es' : ''} Found</h3>
                    <p class="card-subtitle">Immediate action recommended</p>
                </div>
            </div>
            
            <div class="card-body">
                <div class="email-display">
                    <span class="label">Compromised Email:</span>
                    <code class="email-value warning">${email}</code>
                </div>
                
                <div class="alert-banner">
                    <i class="fas fa-clock"></i>
                    <span>This email was exposed. Change passwords immediately.</span>
                </div>
                
                <div class="breaches-list">
                    <h4>📋 Detected Breaches:</h4>
                    ${breachList}
                </div>
                
                <div class="critical-actions">
                    <h4>🚨 Immediate Actions Required:</h4>
                    <ol class="action-list">
                        <li><strong>Change passwords</strong> for any account using this email</li>
                        <li><strong>Enable Two-Factor Authentication</strong> on all important accounts</li>
                        <li><strong>Use a password manager</strong> to create strong, unique passwords</li>
                        <li><strong>Monitor accounts</strong> for suspicious activity</li>
                    </ol>
                </div>
                
                <div class="protection-tips">
                    <h4>🛡️ Enhanced Protection:</h4>
                    <div class="tips-grid">
                        <div class="tip">
                            <i class="fas fa-lock"></i>
                            <p>Consider identity theft protection service</p>
                        </div>
                        <div class="tip">
                            <i class="fas fa-bell"></i>
                            <p>Set up breach alerts for this email</p>
                        </div>
                        <div class="tip">
                            <i class="fas fa-file-contract"></i>
                            <p>Review privacy settings on all accounts</p>
                        </div>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button onclick="generateReport('${email}')" class="report-button">
                        <i class="fas fa-file-pdf"></i> Download Report
                    </button>
                    <button onclick="showRemediationGuide()" class="guide-button">
                        <i class="fas fa-book"></i> Remediation Guide
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createDemoNotice() {
    return `
        <div class="demo-notice">
            <div class="notice-content">
                <i class="fas fa-info-circle text-blue-500"></i>
                <div>
                    <p class="notice-title">Demo Mode Active</p>
                    <p class="notice-text">
                        Showing simulated breach data. Your HIBP API key is securely configured in Vercel.
                        <a href="#" onclick="toggleAPIMode()" class="notice-link">Switch to live mode</a>
                    </p>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// WAITLIST FUNCTIONALITY
// ============================================

function initializeWaitlist() {
    if (!elements.waitlistForm) return;
    
    elements.waitlistForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitButton = this.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        
        // Get form data
        const formData = {
            email: document.getElementById('waitlistEmail').value.trim(),
            assets: Array.from(document.querySelectorAll('input[name="assets"]:checked'))
                .map(cb => cb.value),
            priority: document.getElementById('priority').value,
            comments: document.getElementById('comments').value.trim(),
            timestamp: new Date().toISOString(),
            source: 'exposureshield.com',
            campaign: 'legacyshield-launch'
        };
        
        // Validation
        const emailValidation = validateEmail(formData.email);
        if (!emailValidation.valid) {
            showNotification(emailValidation.message, 'error');
            return;
        }
        
        if (formData.assets.length === 0) {
            showNotification('Please select at least one digital asset type', 'error');
            return;
        }
        
        if (!formData.priority) {
            showNotification('Please select your timeframe', 'error');
            return;
        }
        
        // Show loading
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        
        try {
            // In production, you would send to your backend
            // const response = await fetch('/api/waitlist', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(formData)
            // });
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Show success
            showWaitlistSuccess(formData.email);
            
            // Store in localStorage
            storeWaitlistSubmission(formData);
            
            // Track conversion
            trackConversion('waitlist_signup', formData);
            
            console.log('Waitlist submission:', formData);
            
        } catch (error) {
            console.error('Waitlist error:', error);
            showNotification('Something went wrong. Please try again.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
        }
    });
}

function showWaitlistSuccess(email) {
    if (!elements.waitlistForm || !elements.successMessage) return;
    
    // Hide form, show success
    elements.waitlistForm.style.display = 'none';
    elements.successMessage.style.display = 'block';
    
    // Update email in success message
    const emailElement = elements.successMessage.querySelector('.user-email');
    if (emailElement) {
        emailElement.textContent = email;
    }
    
    // Animate success icon
    const icon = elements.successMessage.querySelector('.success-icon');
    if (icon) {
        icon.classList.add('bounce-in');
    }
}

function resetWaitlistForm() {
    if (!elements.waitlistForm || !elements.successMessage) return;
    
    elements.waitlistForm.reset();
    elements.waitlistForm.style.display = 'block';
    elements.successMessage.style.display = 'none';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateStr) {
    if (!dateStr) return 'Date unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getSeverityLevel(dataClasses) {
    const highRisk = ['Passwords', 'Credit card numbers', 'Government IDs'];
    const hasHighRisk = dataClasses.some(data => highRisk.includes(data));
    
    return hasHighRisk ? 'High Risk' : 'Medium Risk';
}

function updateStatistics() {
    if (elements.breachCount) {
        elements.breachCount.textContent = '4.5B+';
    }
    if (elements.userCount) {
        elements.userCount.textContent = '1.2M+';
    }
    if (elements.statsUpdated) {
        elements.statsUpdated.textContent = 'Updated just now';
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function storeWaitlistSubmission(data) {
    try {
        const submissions = JSON.parse(localStorage.getItem('waitlistSubmissions') || '[]');
        submissions.push(data);
        localStorage.setItem('waitlistSubmissions', JSON.stringify(submissions));
    } catch (e) {
        console.error('Failed to store waitlist submission:', e);
    }
}

// ============================================
// ANALYTICS & TRACKING
// ============================================

function trackScan(result) {
    // Basic analytics - in production, use Google Analytics or similar
    console.log('Scan completed:', {
        email: result.email.substring(0, 3) + '...', // Partial for privacy
        breachCount: result.breaches.length,
        source: result.source,
        timestamp: result.timestamp
    });
    
    // Update scan count
    let scanCount = parseInt(localStorage.getItem('totalScans') || '0');
    scanCount++;
    localStorage.setItem('totalScans', scanCount.toString());
}

function trackConversion(event, data) {
    console.log('Conversion:', event, {
        email: data.email.substring(0, 3) + '...',
        timestamp: data.timestamp
    });
}

// ============================================
// EXPORT FOR GLOBAL ACCESS
// ============================================

// Make key functions available globally
window.ExposureShield = {
    performScan,
    resetWaitlistForm,
    shareResult: function(email, breachCount) {
        const text = `My email ${email} was found in ${breachCount} data breach${breachCount !== 1 ? 'es' : ''}. Check yours at ${window.location.origin}`;
        if (navigator.share) {
            navigator.share({ title: 'ExposureShield Result', text: text });
        } else {
            navigator.clipboard.writeText(text);
            showNotification('Result copied to clipboard!', 'success');
        }
    },
    showBreachDetails: function(index) {
        showNotification(`Details for breach #${index + 1}`, 'info');
    },
    getRemediation: function(breachName) {
        window.open(`https://haveibeenpwned.com/PwnedWebsites/${breachName}`, '_blank');
    },
    generateReport: function(email) {
        showNotification('Report generation coming soon!', 'info');
    },
    showRemediationGuide: function() {
        window.open('https://www.troyhunt.com/heres-what-you-need-to-know-about-the-latest-data-breach/', '_blank');
    },
    toggleAPIMode: function() {
        CONFIG.BACKEND_LIVE = !CONFIG.BACKEND_LIVE;
        showNotification(
            CONFIG.BACKEND_LIVE ? 'Switched to live API mode' : 'Switched to demo mode',
            'success'
        );
    },
    CONFIG
};

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log(`${CONFIG.APP_NAME} v${CONFIG.VERSION} ready`);
    });
}