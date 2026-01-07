/**
 * ExposureShield Donation System
 * Simple, compliant donation handling with PayPal integration
 */

class DonationSystem {
    constructor() {
        this.currentAmount = 15;
        this.isProcessing = false;
        this.paypalLinks = {
            5: 'https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID_5',
            15: 'https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID_15',
            50: 'https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID_50',
            custom: 'https://www.paypal.com/donate/?hosted_button_id=YOUR_CUSTOM_BUTTON'
        };
        this.init();
    }

    init() {
        console.log('Donation system initialized');
        this.setupEventListeners();
        this.setupAmountValidation();
        this.trackPageView();
    }

    setupEventListeners() {
        // Tier buttons
        document.querySelectorAll('.donate-tier').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const amount = parseInt(button.dataset.amount) || 15;
                this.selectTier(amount);
                this.processDonation(amount);
            });
        });

        // Custom amount button
        const customBtn = document.getElementById('customDonateBtn');
        if (customBtn) {
            customBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const amount = this.getCustomAmount();
                if (amount) {
                    this.processDonation(amount);
                }
            });
        }

        // Custom amount input
        const customInput = document.getElementById('customAmount');
        if (customInput) {
            customInput.addEventListener('input', () => {
                this.updateCustomAmountDisplay();
            });
        }
    }

    setupAmountValidation() {
        const input = document.getElementById('customAmount');
        if (!input) return;

        input.addEventListener('blur', () => {
            let value = parseInt(input.value) || 1;
            
            // Enforce min/max
            if (value < 1) {
                value = 1;
                this.showToast('Minimum donation is $1', 'info');
            }
            if (value > 1000) {
                value = 1000;
                this.showToast('Maximum donation is $1000', 'info');
            }
            
            input.value = value;
            this.updateCustomAmountDisplay();
        });
    }

    selectTier(amount) {
        // Remove active class from all tiers
        document.querySelectorAll('.tier-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Add active class to selected tier
        const selectedCard = document.querySelector(`.donate-tier[data-amount="${amount}"]`)?.closest('.tier-card');
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        this.currentAmount = amount;
        console.log(`Selected tier: $${amount}`);
    }

    getCustomAmount() {
        const input = document.getElementById('customAmount');
        if (!input) return 25;

        let amount = parseInt(input.value) || 25;
        
        // Validate amount
        if (amount < 1) {
            this.showToast('Please enter an amount of $1 or more', 'warning');
            return null;
        }
        if (amount > 1000) {
            this.showToast('Maximum donation amount is $1000', 'warning');
            return null;
        }

        return amount;
    }

    updateCustomAmountDisplay() {
        const input = document.getElementById('customAmount');
        const display = document.getElementById('customAmountDisplay');
        
        if (input && display) {
            let value = parseInt(input.value) || 25;
            if (value < 1) value = 1;
            if (value > 1000) value = 1000;
            
            display.textContent = `$${value}`;
        }
    }

    processDonation(amount) {
        if (this.isProcessing) {
            console.log('Already processing a donation');
            return;
        }

        this.isProcessing = true;
        this.currentAmount = amount;

        // Track donation attempt
        this.trackEvent('donation_attempted', { amount: amount });

        // Show processing state
        this.showProcessingState(true);

        // Show redirect notification
        this.showToast(`Redirecting to PayPal for $${amount} donation...`, 'info');

        // In production, use actual PayPal redirect
        // For now, simulate delay and show demo message
        setTimeout(() => {
            if (this.isDemoMode()) {
                this.handleDemoDonation(amount);
            } else {
                this.redirectToPayPal(amount);
            }
        }, 1500);
    }

    redirectToPayPal(amount) {
        // Determine which PayPal link to use
        let paypalUrl;
        
        if ([5, 15, 50].includes(amount)) {
            paypalUrl = this.paypalLinks[amount];
        } else {
            // For custom amounts, you might need a different PayPal button
            // or use PayPal's variable amount feature
            paypalUrl = this.paypalLinks.custom;
            
            // If your PayPal setup supports variable amounts via URL parameters
            // paypalUrl = `https://www.paypal.com/donate/?amount=${amount}`;
        }

        console.log(`Redirecting to PayPal: ${paypalUrl}`);
        
        // Track successful redirect
        this.trackEvent('paypal_redirect', { amount: amount });
        
        // Actually redirect to PayPal
        window.location.href = paypalUrl;
    }

    handleDemoDonation(amount) {
        // For demo purposes only
        this.showToast(
            `🎉 Demo Mode: Would redirect to PayPal for $${amount} donation<br><small>In production, this would process actual payment</small>`,
            'success'
        );
        
        // Track demo donation
        this.trackEvent('demo_donation_completed', { amount: amount });
        
        // Reset processing state
        setTimeout(() => {
            this.showProcessingState(false);
            this.isProcessing = false;
        }, 3000);
    }

    showProcessingState(show) {
        const buttons = document.querySelectorAll('.donate-button');
        
        if (show) {
            buttons.forEach(button => {
                const originalHTML = button.innerHTML;
                button.setAttribute('data-original', originalHTML);
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                button.disabled = true;
            });
        } else {
            buttons.forEach(button => {
                const originalHTML = button.getAttribute('data-original');
                if (originalHTML) {
                    button.innerHTML = originalHTML;
                }
                button.disabled = false;
            });
        }
    }

    showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.donate-toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast
        const toast = document.createElement('div');
        toast.className = `donate-toast donate-toast-${type}`;
        toast.innerHTML = `
            <div class="donate-toast-content">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles
        this.addToastStyles();

        // Add to page
        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'error': 'times-circle'
        };
        return icons[type] || 'info-circle';
    }

    addToastStyles() {
        // Only add styles once
        if (document.getElementById('donate-toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'donate-toast-styles';
        style.textContent = `
            .donate-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                transform: translateX(150%);
                transition: transform 0.3s ease;
                z-index: 10000;
                max-width: 350px;
                font-family: 'Inter', sans-serif;
            }
            
            .donate-toast.show {
                transform: translateX(0);
            }
            
            .donate-toast-content {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            
            .donate-toast i {
                font-size: 1.2rem;
                margin-top: 2px;
            }
            
            .donate-toast-success {
                background: #10b981;
            }
            
            .donate-toast-info {
                background: #3b82f6;
            }
            
            .donate-toast-warning {
                background: #f59e0b;
            }
            
            .donate-toast-error {
                background: #ef4444;
            }
            
            @media (max-width: 768px) {
                .donate-toast {
                    left: 20px;
                    right: 20px;
                    max-width: none;
                    transform: translateY(-150%);
                }
                
                .donate-toast.show {
                    transform: translateY(0);
                }
            }
        `;

        document.head.appendChild(style);
    }

    trackPageView() {
        // Simple page view tracking
        console.log('Donation page viewed');
        
        // You can integrate with Google Analytics here:
        // if (typeof gtag !== 'undefined') {
        //     gtag('event', 'page_view', {
        //         page_title: 'Donation Page',
        //         page_location: window.location.href
        //     });
        // }
    }

    trackEvent(eventName, eventData = {}) {
        // Simple event tracking
        console.log(`Event: ${eventName}`, eventData);
        
        // You can integrate with analytics services here:
        // if (typeof gtag !== 'undefined') {
        //     gtag('event', eventName, eventData);
        // }
        
        // Or send to your own analytics endpoint
        // fetch('/api/analytics', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ event: eventName, ...eventData })
        // });
    }

    isDemoMode() {
        // Check if we're in demo mode (not production)
        return window.location.hostname === 'localhost' || 
               window.location.hostname.includes('github.io') ||
               window.location.hostname.includes('netlify.app') ||
               window.location.hostname.includes('vercel.app');
    }
}

// Initialize donation system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const donationSystem = new DonationSystem();
    
    // Make it globally available for debugging
    window.donationSystem = donationSystem;
    
    console.log('ExposureShield Donation System Ready');
    console.log('Demo Mode:', donationSystem.isDemoMode());
});

// PayPal callback handler (if using PayPal return URL)
if (window.location.search.includes('paypal_return')) {
    document.addEventListener('DOMContentLoaded', () => {
        const params = new URLSearchParams(window.location.search);
        const success = params.get('success');
        const amount = params.get('amount');
        
        if (success === 'true') {
            // Show success message
            alert(`Thank you for your $${amount} donation! You should receive a receipt email shortly.`);
            
            // Track successful donation
            console.log(`Donation completed: $${amount}`);
        } else if (success === 'false') {
            // Show cancellation message
            alert('Donation was cancelled. No payment was processed.');
        }
    });
}