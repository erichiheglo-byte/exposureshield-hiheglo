// Exposure Shield - Professional JavaScript
// Updated to work with new HTML structure

// Configuration
const EXPOSURE_SHIELD = {
    config: {
        APP_NAME: 'Exposure Shield',
        VERSION: '5.0.0',
        API_ENDPOINT: '/api/check-email'
    },

    utils: {
        formatNumber: (num) => {
            if (num === undefined || num === null || num === 0) return 'Unknown';
            return num.toLocaleString();
        },
        
        formatDate: (dateString) => {
            if (!dateString) return 'Date unknown';
            try {
                const date = new Date(dateString);
                const now = new Date();
                const diffTime = Math.abs(now - date);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
                return date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short'
                });
            } catch {
                return 'Date unknown';
            }
        },
        
        escapeHtml: (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    },

    state: {
        isChecking: false
    },

    // Initialize everything
    init: function() {
        console.log(`🚀 ${this.config.APP_NAME} v${this.config.VERSION} starting...`);
        
        // Set up the scan button
        this.setupScanButton();
        
        // Set up mobile menu
        this.setupMobileMenu();
        
        // Set up form submission
        this.setupContactForm();
        
        console.log('✅ Exposure Shield initialized');
    },

    // Set up the main scan button
    setupScanButton: function() {
        const button = document.getElementById('checkExposureBtn');
        if (!button) {
            console.error('❌ Scan button not found');
            return;
        }
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleScan(button);
        });
        
        // Also handle Enter key in email input
        const emailInput = document.querySelector('.email-input');
        if (emailInput) {
            emailInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleScan(button);
                }
            });
        }
        
        console.log('✅ Scan button ready');
    },

    // Set up mobile menu toggle
    setupMobileMenu: function() {
        const menuBtn = document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');
        
        if (menuBtn && navLinks) {
            menuBtn.addEventListener('click', () => {
                navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
                menuBtn.innerHTML = navLinks.style.display === 'flex' ? 
                    '<i class="fas fa-times"></i>' : 
                    '<i class="fas fa-bars"></i>';
            });
            
            // Make responsive
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    navLinks.style.display = 'flex';
                    menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
                } else {
                    navLinks.style.display = 'none';
                }
            });
        }
    },

    // Set up contact form
    setupContactForm: function() {
        const form = document.querySelector('.contact-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const name = document.getElementById('name').value;
                const email = document.getElementById('email').value;
                const message = document.getElementById('message').value;
                
                if (name && email && message) {
                    // In a real app, you would send this to your backend
                    alert('Thank you for your message! We\'ll get back to you within 24 hours.');
                    form.reset();
                } else {
                    alert('Please fill in all fields.');
                }
            });
        }
    },

    // Handle scan button click
    async handleScan(button) {
        if (this.state.isChecking) return;
        
        this.state.isChecking = true;
        
        // Get email
        const emailInput = document.querySelector('.email-input');
        const email = emailInput ? emailInput.value.trim() : '';
        
        if (!email || !email.includes('@')) {
            alert('Please enter a valid email address.');
            this.state.isChecking = false;
            return;
        }
        
        // Update button state
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        button.disabled = true;
        
        try {
            // Call API
            const breaches = await this.checkEmail(email);
            
            // Show results
            this.showResults(email, breaches);
            
        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message || 'Unable to check email');
            
        } finally {
            // Restore button
            button.innerHTML = originalHTML;
            button.disabled = false;
            this.state.isChecking = false;
        }
    },

    // Check email via API
    async checkEmail(email) {
        const url = `${this.config.API_ENDPOINT}?email=${encodeURIComponent(email)}`;
        console.log(`🌐 Checking: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    },

    // Remove existing results
    removeResults: function() {
        const container = document.getElementById('resultsContainer');
        if (container) {
            container.innerHTML = '';
        }
    },

    // Show results
    showResults: function(email, breaches) {
        this.removeResults();
        
        const container = document.getElementById('resultsContainer');
        if (!container) return;
        
        // Add CSS for results if not already added
        this.injectResultsStyles();
        
        if (!breaches || breaches.length === 0) {
            container.innerHTML = this.getNoBreachesHTML(email);
        } else {
            container.innerHTML = this.getBreachesHTML(email, breaches);
        }
        
        // Scroll to results
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    // Inject results styles
    injectResultsStyles: function() {
        if (document.getElementById('results-styles')) return;
        
        const css = `
            .es-results {
                animation: fadeIn 0.5s ease-out;
                margin-top: 40px;
            }
            
            .es-result-card {
                background: white;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
                border: 1px solid #e9ecef;
            }
            
            .es-result-safe {
                border-top: 5px solid #10b981;
            }
            
            .es-result-alert {
                border-top: 5px solid #ef4444;
            }
            
            .es-result-header {
                padding: 35px 40px;
                text-align: center;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            }
            
            .es-result-icon {
                width: 80px;
                height: 80px;
                margin: 0 auto 25px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 36px;
            }
            
            .es-icon-safe {
                background: rgba(16, 185, 129, 0.1);
                color: #10b981;
                border: 2px solid rgba(16, 185, 129, 0.3);
            }
            
            .es-icon-alert {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
                border: 2px solid rgba(239, 68, 68, 0.3);
            }
            
            .es-email-box {
                background: #f8f9fa;
                border-radius: 12px;
                padding: 25px;
                margin: 0 40px 30px;
                text-align: center;
                border: 1px solid #e9ecef;
            }
            
            .es-email-address {
                font-family: 'SF Mono', Monaco, monospace;
                font-size: 20px;
                font-weight: 700;
                color: #1f2937;
                word-break: break-all;
            }
            
            .es-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 0 40px 40px;
            }
            
            .es-stat {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border-radius: 12px;
                padding: 25px;
                text-align: center;
                border: 1px solid #dee2e6;
            }
            
            .es-stat-value {
                font-size: 36px;
                font-weight: 800;
                margin-bottom: 8px;
            }
            
            .es-stat-label {
                color: #6b7280;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                font-weight: 600;
            }
            
            .es-breaches {
                margin: 0 40px 40px;
            }
            
            .es-breach-item {
                display: flex;
                align-items: flex-start;
                padding: 25px;
                margin-bottom: 15px;
                background: #f8f9fa;
                border-radius: 12px;
                border-left: 4px solid #ef4444;
            }
            
            .es-breach-icon {
                width: 50px;
                height: 50px;
                background: white;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 20px;
                flex-shrink: 0;
                font-size: 22px;
                color: #6b7280;
                border: 1px solid #e5e7eb;
            }
            
            .es-breach-content {
                flex: 1;
            }
            
            .es-breach-name {
                font-size: 18px;
                font-weight: 700;
                margin: 0 0 10px;
                color: #1f2937;
            }
            
            .es-breach-meta {
                display: flex;
                gap: 20px;
                color: #6b7280;
                font-size: 14px;
            }
            
            .es-actions {
                margin: 40px;
                padding: 30px;
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-radius: 16px;
                border-left: 5px solid #f59e0b;
            }
            
            .es-footer {
                padding: 30px 40px;
                background: #f8f9fa;
                border-top: 1px solid #e9ecef;
                text-align: center;
            }
            
            .es-button {
                padding: 14px 32px;
                border-radius: 10px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
                font-size: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                min-width: 180px;
            }
            
            .es-button-primary {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: white;
            }
            
            .es-button-primary:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
            }
            
            @media (max-width: 768px) {
                .es-result-header,
                .es-email-box,
                .es-stats,
                .es-breaches,
                .es-actions,
                .es-footer {
                    margin: 20px;
                    padding: 25px;
                }
                
                .es-stats {
                    grid-template-columns: 1fr;
                }
                
                .es-breach-meta {
                    flex-direction: column;
                    gap: 8px;
                }
            }
        `;
        
        const style = document.createElement('style');
        style.id = 'results-styles';
        style.textContent = css;
        document.head.appendChild(style);
    },

    // HTML for no breaches
    getNoBreachesHTML: function(email) {
        return `
            <div class="es-results">
                <div class="es-result-card es-result-safe">
                    <div class="es-result-header">
                        <div class="es-result-icon es-icon-safe">
                            <i class="fas fa-shield-check"></i>
                        </div>
                        <h2 style="margin: 0 0 15px; font-size: 32px; font-weight: 800; color: #1f2937;">
                            No Breaches Found
                        </h2>
                        <p style="color: #6b7280; font-size: 18px; margin: 0;">
                            Your email appears secure
                        </p>
                    </div>
                    
                    <div class="es-email-box">
                        <div style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">
                            Email Checked
                        </div>
                        <div class="es-email-address">${this.utils.escapeHtml(email)}</div>
                    </div>
                    
                    <div style="padding: 0 40px; text-align: center; margin-bottom: 40px;">
                        <p style="font-size: 20px; color: #10b981; font-weight: 600; margin: 0 0 25px;">
                            ✅ Excellent! Your email hasn't been found in any known data breaches.
                        </p>
                        <p style="color: #6b7280; line-height: 1.6; font-size: 17px;">
                            This means your email hasn't been publicly exposed in any major data breaches 
                            tracked by Have I Been Pwned. Keep up the good security practices!
                        </p>
                    </div>
                    
                    <div class="es-footer">
                        <p style="color: #6b7280; margin-bottom: 25px; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i class="fas fa-shield-alt" style="color: #10b981;"></i>
                            Data provided by <strong>Have I Been Pwned</strong>
                        </p>
                        
                        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                            <button class="es-button es-button-primary" onclick="EXPOSURE_SHIELD.resetForNewScan()">
                                <i class="fas fa-search"></i>
                                Check Another Email
                            </button>
                            
                            <button class="es-button" style="background: white; color: #6b7280; border: 2px solid #e5e7eb;" 
                                    onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
                                <i class="fas fa-arrow-up"></i>
                                Back to Top
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // HTML for breaches found
    getBreachesHTML: function(email, breaches) {
        const totalBreaches = breaches.length;
        const totalAccounts = breaches.reduce((sum, breach) => {
            return sum + (breach.PwnCount ? parseInt(breach.PwnCount) : 0);
        }, 0);
        
        const latestBreach = breaches
            .filter(b => b.BreachDate)
            .sort((a, b) => new Date(b.BreachDate) - new Date(a.BreachDate))[0];
        
        return `
            <div class="es-results">
                <div class="es-result-card es-result-alert">
                    <div class="es-result-header">
                        <div class="es-result-icon es-icon-alert">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h2 style="margin: 0 0 15px; font-size: 32px; font-weight: 800; color: #1f2937;">
                            Security Alert
                        </h2>
                        <p style="color: #ef4444; font-size: 18px; margin: 0; font-weight: 600;">
                            ${totalBreaches} Data Breach${totalBreaches !== 1 ? 'es' : ''} Found
                        </p>
                    </div>
                    
                    <div class="es-email-box">
                        <div style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">
                            Compromised Email
                        </div>
                        <div class="es-email-address">${this.utils.escapeHtml(email)}</div>
                    </div>
                    
                    <div class="es-stats">
                        <div class="es-stat">
                            <div class="es-stat-value" style="color: #ef4444;">${totalBreaches}</div>
                            <div class="es-stat-label">Total Breaches</div>
                        </div>
                        
                        <div class="es-stat">
                            <div class="es-stat-value" style="color: ${totalAccounts > 0 ? '#ef4444' : '#6b7280'}">
                                ${this.utils.formatNumber(totalAccounts)}
                            </div>
                            <div class="es-stat-label">Accounts Affected</div>
                        </div>
                        
                        <div class="es-stat">
                            <div class="es-stat-value" style="color: ${latestBreach ? '#ef4444' : '#6b7280'}">
                                ${latestBreach ? this.utils.formatDate(latestBreach.BreachDate) : 'N/A'}
                            </div>
                            <div class="es-stat-label">Latest Breach</div>
                        </div>
                    </div>
                    
                    ${breaches.length > 0 ? `
                        <div class="es-breaches">
                            <h3 style="margin: 0 0 25px; color: #1f2937; font-size: 24px; font-weight: 700;">
                                <i class="fas fa-list" style="margin-right: 10px;"></i>
                                Breach Details
                            </h3>
                            
                            ${breaches.slice(0, 5).map(breach => `
                                <div class="es-breach-item">
                                    <div class="es-breach-icon">
                                        ${breach.Domain ? '🌐' : '⚠️'}
                                    </div>
                                    <div class="es-breach-content">
                                        <h4 class="es-breach-name">${this.utils.escapeHtml(breach.Name || 'Unknown')}</h4>
                                        <div class="es-breach-meta">
                                            <span>
                                                <i class="far fa-calendar" style="margin-right: 5px;"></i>
                                                ${this.utils.formatDate(breach.BreachDate)}
                                            </span>
                                            ${breach.PwnCount ? `
                                                <span>
                                                    <i class="fas fa-users" style="margin-right: 5px;"></i>
                                                    ${this.utils.formatNumber(breach.PwnCount)} accounts
                                                </span>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="es-actions">
                        <h3 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-exclamation-circle"></i>
                            Recommended Actions
                        </h3>
                        
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(245, 158, 11, 0.2);">
                                <strong>1. Change Passwords:</strong> Update passwords for affected accounts immediately
                            </li>
                            <li style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(245, 158, 11, 0.2);">
                                <strong>2. Enable 2FA:</strong> Add two-factor authentication to all critical accounts
                            </li>
                            <li style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(245, 158, 11, 0.2);">
                                <strong>3. Use Password Manager:</strong> Generate unique passwords for every account
                            </li>
                            <li>
                                <strong>4. Monitor Accounts:</strong> Watch for suspicious activity and unauthorized access
                            </li>
                        </ul>
                    </div>
                    
                    <div class="es-footer">
                        <p style="color: #6b7280; margin-bottom: 25px; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
                            Breach data from <strong>Have I Been Pwned</strong>
                        </p>
                        
                        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                            <button class="es-button es-button-primary" onclick="EXPOSURE_SHIELD.resetForNewScan()">
                                <i class="fas fa-search"></i>
                                Check Another Email
                            </button>
                            
                            <button class="es-button" style="background: white; color: #6b7280; border: 2px solid #e5e7eb;" 
                                    onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
                                <i class="fas fa-arrow-up"></i>
                                Back to Top
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Show error
    showError: function(message) {
        const container = document.getElementById('resultsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="es-results">
                <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 16px; padding: 40px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 20px; color: #d97706;">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <h3 style="margin: 0 0 15px; color: #92400e; font-size: 24px;">
                        Temporary Service Issue
                    </h3>
                    <p style="color: #92400e; margin-bottom: 25px; line-height: 1.6;">
                        ${message || 'We couldn\'t complete the security check at this moment.'}
                    </p>
                    <button onclick="EXPOSURE_SHIELD.resetForNewScan()" 
                            style="background: #f59e0b; color: #92400e; border: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        Try Again
                    </button>
                </div>
            </div>
        `;
    },

    // Reset for new scan
    resetForNewScan: function() {
        this.removeResults();
        
        // Clear email input
        const emailInput = document.querySelector('.email-input');
        if (emailInput) {
            emailInput.value = '';
            emailInput.focus();
        }
        
        // Scroll to scan section
        const scanSection = document.getElementById('scan');
        if (scanSection) {
            scanSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        console.log('🔄 Ready for new scan');
    }
};

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => EXPOSURE_SHIELD.init());
} else {
    setTimeout(() => EXPOSURE_SHIELD.init(), 100);
}

// Make globally available
window.EXPOSURE_SHIELD = EXPOSURE_SHIELD;