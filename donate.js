/**
 * ExposureShield Donation System v2.0
 * Professional, compliant donation handling with advanced PayPal integration
 * Copyright (c) 2024 ExposureShield Security Solutions
 */

class DonationSystem {
    constructor() {
        this.config = {
            minAmount: 1,
            maxAmount: 10000,
            defaultAmount: 15,
            currency: 'USD',
            taxRate: 0, // No tax for donations
            processingFee: 0.029, // 2.9% + $0.30 PayPal fee
            flatFee: 0.30,
            demoMode: this.isDemoEnvironment(),
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
            retryAttempts: 3,
            analyticsEnabled: true
        };

        this.state = {
            currentAmount: this.config.defaultAmount,
            isProcessing: false,
            processingStartTime: null,
            retryCount: 0,
            sessionId: this.generateSessionId(),
            donationAttempts: [],
            paymentMethod: null,
            userConsent: false
        };

        this.paypalConfig = {
            businessEmail: 'donations@exposureshield.com',
            returnUrl: `${window.location.origin}/donate/thank-you`,
            cancelUrl: `${window.location.origin}/donate`,
            notifyUrl: `${window.location.origin}/api/paypal/ipn`,
            buttonIds: {
                5: 'YOUR_BUTTON_ID_5',
                15: 'YOUR_BUTTON_ID_15',
                50: 'YOUR_BUTTON_ID_50',
                custom: 'YOUR_CUSTOM_BUTTON'
            },
            environment: this.config.demoMode ? 'sandbox' : 'production',
            apiVersion: '2.0'
        };

        this.ui = {
            elements: {},
            animations: {
                tierSelect: 'donation-tier-select',
                amountUpdate: 'donation-amount-update',
                processingStart: 'donation-processing-start',
                processingEnd: 'donation-processing-end'
            }
        };

        this.analytics = {
            events: [],
            pageViews: [],
            errors: []
        };

        this.cache = {
            donorInfo: null,
            lastDonation: null,
            preferredAmount: null
        };

        this.init();
    }

    /**
     * Initialize the donation system
     */
    init() {
        try {
            this.setupEnvironment();
            this.loadCache();
            this.setupUIElements();
            this.setupEventListeners();
            this.setupValidation();
            this.setupAnalytics();
            this.setupSessionManagement();
            this.setupPerformanceMonitoring();
            
            this.log('System initialized', {
                sessionId: this.state.sessionId,
                demoMode: this.config.demoMode,
                environment: this.paypalConfig.environment
            });
            
            this.trackPageView();
            this.checkReturnFromPayment();
            
        } catch (error) {
            this.handleError('Initialization failed', error);
        }
    }

    /**
     * Setup environment-specific configurations
     */
    setupEnvironment() {
        // Detect environment
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            this.config.demoMode = true;
            this.paypalConfig.environment = 'sandbox';
            console.warn('⚠️ Running in demo/sandbox mode');
        }
        
        // Set PayPal URLs based on environment
        if (this.paypalConfig.environment === 'sandbox') {
            this.paypalConfig.baseUrl = 'https://www.sandbox.paypal.com';
        } else {
            this.paypalConfig.baseUrl = 'https://www.paypal.com';
        }
    }

    /**
     * Load cached data from localStorage
     */
    loadCache() {
        try {
            const cached = localStorage.getItem('exposureshield_donations');
            if (cached) {
                const data = JSON.parse(cached);
                this.cache = { ...this.cache, ...data };
                
                if (this.cache.preferredAmount) {
                    this.state.currentAmount = this.cache.preferredAmount;
                    this.updateCustomAmountInput(this.cache.preferredAmount);
                }
            }
        } catch (error) {
            this.log('Cache load failed', error);
        }
    }

    /**
     * Save data to cache
     */
    saveCache() {
        try {
            const data = {
                donorInfo: this.cache.donorInfo,
                lastDonation: this.cache.lastDonation,
                preferredAmount: this.state.currentAmount,
                lastUpdated: new Date().toISOString()
            };
            
            localStorage.setItem('exposureshield_donations', JSON.stringify(data));
        } catch (error) {
            this.log('Cache save failed', error);
        }
    }

    /**
     * Setup UI element references
     */
    setupUIElements() {
        this.ui.elements = {
            customAmountInput: document.getElementById('customAmount'),
            customAmountDisplay: document.getElementById('customAmountDisplay'),
            customDonateBtn: document.getElementById('customDonateBtn'),
            tierCards: document.querySelectorAll('.tier-card'),
            tierButtons: document.querySelectorAll('.donate-tier'),
            quickAmountButtons: document.querySelectorAll('.quick-amount'),
            donationForm: document.getElementById('donationForm'),
            processingOverlay: this.createProcessingOverlay(),
            receiptModal: this.createReceiptModal(),
            errorModal: this.createErrorModal()
        };
    }

    /**
     * Create processing overlay
     */
    createProcessingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'donation-processing-overlay';
        overlay.innerHTML = `
            <div class="processing-content">
                <div class="processing-spinner">
                    <div class="spinner"></div>
                </div>
                <div class="processing-message">
                    <h3>Processing Your Donation</h3>
                    <p>Please wait while we secure your payment...</p>
                    <div class="processing-details">
                        <div class="detail-item">
                            <span class="detail-label">Amount:</span>
                            <span class="detail-value" id="processingAmount">$${this.state.currentAmount}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Method:</span>
                            <span class="detail-value" id="processingMethod">PayPal</span>
                        </div>
                    </div>
                </div>
                <div class="processing-security">
                    <i class="fas fa-lock"></i>
                    <span>Secure Payment Processing</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        return overlay;
    }

    /**
     * Create receipt modal
     */
    createReceiptModal() {
        const modal = document.createElement('div');
        modal.className = 'donation-receipt-modal';
        modal.innerHTML = `
            <div class="receipt-content">
                <div class="receipt-header">
                    <i class="fas fa-check-circle"></i>
                    <h2>Thank You for Your Donation!</h2>
                </div>
                <div class="receipt-body">
                    <div class="receipt-details">
                        <div class="receipt-row">
                            <span>Donation Amount:</span>
                            <strong id="receiptAmount">$0.00</strong>
                        </div>
                        <div class="receipt-row">
                            <span>Transaction ID:</span>
                            <code id="receiptTransactionId">N/A</code>
                        </div>
                        <div class="receipt-row">
                            <span>Date & Time:</span>
                            <span id="receiptDate">${new Date().toLocaleString()}</span>
                        </div>
                        <div class="receipt-row">
                            <span>Payment Method:</span>
                            <span id="receiptMethod">PayPal</span>
                        </div>
                    </div>
                    <div class="receipt-actions">
                        <button class="btn-print" onclick="window.print()">
                            <i class="fas fa-print"></i> Print Receipt
                        </button>
                        <button class="btn-email" id="emailReceiptBtn">
                            <i class="fas fa-envelope"></i> Email Receipt
                        </button>
                        <button class="btn-close" onclick="donationSystem.closeReceipt()">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                    <div class="receipt-footer">
                        <p><i class="fas fa-info-circle"></i> A receipt has been sent to your email address.</p>
                        <p><i class="fas fa-shield-alt"></i> Your donation supports free security services worldwide.</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Create error modal
     */
    createErrorModal() {
        const modal = document.createElement('div');
        modal.className = 'donation-error-modal';
        modal.innerHTML = `
            <div class="error-content">
                <div class="error-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>Payment Processing Error</h2>
                </div>
                <div class="error-body">
                    <p id="errorMessage">An unexpected error occurred. Please try again.</p>
                    <div class="error-suggestions">
                        <h4>Suggestions:</h4>
                        <ul>
                            <li>Check your internet connection</li>
                            <li>Verify payment details</li>
                            <li>Try a different payment method</li>
                            <li>Contact support if problem persists</li>
                        </ul>
                    </div>
                </div>
                <div class="error-actions">
                    <button class="btn-retry" id="retryPaymentBtn">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                    <button class="btn-cancel" onclick="donationSystem.closeError()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn-support" onclick="window.location.href='/contact'">
                        <i class="fas fa-headset"></i> Contact Support
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Tier selection
        this.ui.elements.tierButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const amount = parseInt(button.dataset.amount) || this.config.defaultAmount;
                this.selectTier(amount);
                this.animateTierSelection(button);
            });
        });

        // Custom amount input
        if (this.ui.elements.customAmountInput) {
            this.ui.elements.customAmountInput.addEventListener('input', (e) => {
                this.handleCustomAmountInput(e.target.value);
            });
            
            this.ui.elements.customAmountInput.addEventListener('blur', () => {
                this.validateCustomAmount();
            });
            
            this.ui.elements.customAmountInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.processDonation(this.state.currentAmount);
                }
            });
        }

        // Custom donate button
        if (this.ui.elements.customDonateBtn) {
            this.ui.elements.customDonateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const amount = this.getValidatedCustomAmount();
                if (amount) {
                    this.processDonation(amount);
                }
            });
        }

        // Quick amount buttons
        this.ui.elements.quickAmountButtons.forEach(button => {
            button.addEventListener('click', () => {
                const amount = parseInt(button.dataset.amount);
                this.setCustomAmount(amount);
                this.animateAmountUpdate();
            });
        });

        // PayPal return handler
        window.addEventListener('paypal-return', (e) => {
            this.handlePayPalReturn(e.detail);
        });

        // Before unload handler
        window.addEventListener('beforeunload', (e) => {
            if (this.state.isProcessing) {
                e.preventDefault();
                e.returnValue = 'Your donation is being processed. Are you sure you want to leave?';
            }
        });

        // Visibility change handler
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.isProcessing) {
                this.log('Page hidden during processing', { 
                    processingTime: Date.now() - this.state.processingStartTime 
                });
            }
        });
    }

    /**
     * Setup validation rules
     */
    setupValidation() {
        // Add validation styles
        this.addValidationStyles();
        
        // Initialize input validation
        if (this.ui.elements.customAmountInput) {
            this.ui.elements.customAmountInput.setAttribute('min', this.config.minAmount);
            this.ui.elements.customAmountInput.setAttribute('max', this.config.maxAmount);
            this.ui.elements.customAmountInput.setAttribute('step', '1');
        }
    }

    /**
     * Setup analytics tracking
     */
    setupAnalytics() {
        if (!this.config.analyticsEnabled) return;
        
        // Track donation funnel
        this.trackEvent('donation_page_view', {
            session_id: this.state.sessionId,
            referrer: document.referrer,
            url: window.location.href
        });
    }

    /**
     * Setup session management
     */
    setupSessionManagement() {
        // Set session expiration
        setTimeout(() => {
            if (!this.state.isProcessing) {
                this.log('Session expired');
                this.state.sessionId = this.generateSessionId();
            }
        }, this.config.sessionTimeout);
        
        // Auto-save cache every minute
        setInterval(() => {
            this.saveCache();
        }, 60000);
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor donation processing time
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name.includes('donation')) {
                    this.log('Performance entry', entry);
                }
            }
        });
        
        observer.observe({ entryTypes: ['measure', 'mark'] });
    }

    /**
     * Handle custom amount input
     */
    handleCustomAmountInput(value) {
        let amount = parseInt(value) || 0;
        
        if (amount > this.config.maxAmount) {
            amount = this.config.maxAmount;
            this.showValidationMessage(`Maximum donation is $${this.config.maxAmount}`, 'warning');
        }
        
        if (amount < this.config.minAmount && amount > 0) {
            amount = this.config.minAmount;
            this.showValidationMessage(`Minimum donation is $${this.config.minAmount}`, 'warning');
        }
        
        this.state.currentAmount = amount;
        this.updateCustomAmountDisplay();
        this.deselectAllTiers();
    }

    /**
     * Validate custom amount
     */
    validateCustomAmount() {
        const amount = this.getValidatedCustomAmount();
        if (!amount) {
            this.showValidationMessage(`Please enter an amount between $${this.config.minAmount} and $${this.config.maxAmount}`, 'error');
            return false;
        }
        return true;
    }

    /**
     * Get validated custom amount
     */
    getValidatedCustomAmount() {
        const input = this.ui.elements.customAmountInput;
        if (!input) return null;
        
        let amount = parseInt(input.value) || 0;
        
        if (amount < this.config.minAmount || amount > this.config.maxAmount) {
            return null;
        }
        
        return amount;
    }

    /**
     * Set custom amount
     */
    setCustomAmount(amount) {
        if (amount >= this.config.minAmount && amount <= this.config.maxAmount) {
            this.state.currentAmount = amount;
            this.updateCustomAmountInput(amount);
            this.updateCustomAmountDisplay();
            this.deselectAllTiers();
            this.log('Custom amount set', { amount });
        }
    }

    /**
     * Update custom amount input
     */
    updateCustomAmountInput(amount) {
        if (this.ui.elements.customAmountInput) {
            this.ui.elements.customAmountInput.value = amount;
        }
    }

    /**
     * Update custom amount display
     */
    updateCustomAmountDisplay() {
        if (this.ui.elements.customAmountDisplay) {
            this.ui.elements.customAmountDisplay.textContent = `$${this.state.currentAmount}`;
        }
    }

    /**
     * Select donation tier
     */
    selectTier(amount) {
        // Deselect all tiers
        this.deselectAllTiers();
        
        // Select new tier
        const tierCard = document.querySelector(`.donate-tier[data-amount="${amount}"]`)?.closest('.tier-card');
        if (tierCard) {
            tierCard.classList.add('selected');
            this.state.currentAmount = amount;
            this.updateCustomAmountInput(amount);
            this.updateCustomAmountDisplay();
            
            this.log('Tier selected', { 
                amount, 
                tierName: tierCard.querySelector('.tier-name')?.textContent 
            });
            
            this.trackEvent('tier_selected', { amount });
        }
    }

    /**
     * Deselect all tiers
     */
    deselectAllTiers() {
        this.ui.elements.tierCards.forEach(card => {
            card.classList.remove('selected');
        });
    }

    /**
     * Animate tier selection
     */
    animateTierSelection(button) {
        const card = button.closest('.tier-card');
        if (card) {
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
                card.style.transform = '';
            }, 150);
        }
    }

    /**
     * Animate amount update
     */
    animateAmountUpdate() {
        const display = this.ui.elements.customAmountDisplay;
        if (display) {
            display.style.transform = 'scale(1.1)';
            setTimeout(() => {
                display.style.transform = '';
            }, 200);
        }
    }

    /**
     * Process donation
     */
    async processDonation(amount) {
        if (this.state.isProcessing) {
            this.showToast('Please wait for the current transaction to complete', 'warning');
            return;
        }

        // Validate amount
        if (!this.validateAmount(amount)) {
            return;
        }

        // Get user consent
        if (!await this.getUserConsent(amount)) {
            return;
        }

        try {
            // Start processing
            this.startProcessing(amount);
            
            // Prepare donation data
            const donationData = this.prepareDonationData(amount);
            
            // Track donation attempt
            this.trackDonationAttempt(donationData);
            
            // Process payment
            if (this.config.demoMode) {
                await this.processDemoDonation(donationData);
            } else {
                await this.processRealDonation(donationData);
            }
            
        } catch (error) {
            this.handleProcessingError(error, amount);
        }
    }

    /**
     * Validate donation amount
     */
    validateAmount(amount) {
        if (amount < this.config.minAmount) {
            this.showToast(`Minimum donation is $${this.config.minAmount}`, 'error');
            return false;
        }
        
        if (amount > this.config.maxAmount) {
            this.showToast(`Maximum donation is $${this.config.maxAmount}`, 'error');
            return false;
        }
        
        return true;
    }

    /**
     * Get user consent
     */
    async getUserConsent(amount) {
        return new Promise((resolve) => {
            // For demo purposes, always return true
            // In production, you might show a confirmation modal
            resolve(true);
        });
    }

    /**
     * Start processing
     */
    startProcessing(amount) {
        this.state.isProcessing = true;
        this.state.processingStartTime = Date.now();
        this.state.retryCount = 0;
        
        // Show processing overlay
        this.showProcessingOverlay(amount);
        
        // Disable all donation buttons
        this.disableDonationButtons(true);
        
        // Track processing start
        this.trackEvent('donation_processing_start', { 
            amount,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Stop processing
     */
    stopProcessing() {
        this.state.isProcessing = false;
        this.state.processingStartTime = null;
        
        // Hide processing overlay
        this.hideProcessingOverlay();
        
        // Re-enable donation buttons
        this.disableDonationButtons(false);
    }

    /**
     * Prepare donation data
     */
    prepareDonationData(amount) {
        const sessionId = this.state.sessionId;
        const timestamp = new Date().toISOString();
        
        return {
            id: `DON-${timestamp.replace(/[^0-9]/g, '')}-${sessionId.substring(0, 8)}`,
            amount: amount,
            currency: this.config.currency,
            sessionId: sessionId,
            timestamp: timestamp,
            fees: this.calculateFees(amount),
            totalAmount: this.calculateTotal(amount),
            donorInfo: this.cache.donorInfo,
            metadata: {
                userAgent: navigator.userAgent,
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        };
    }

    /**
     * Calculate PayPal fees
     */
    calculateFees(amount) {
        const processingFee = amount * this.config.processingFee;
        const totalFee = processingFee + this.config.flatFee;
        return parseFloat(totalFee.toFixed(2));
    }

    /**
     * Calculate total amount
     */
    calculateTotal(amount) {
        const fees = this.calculateFees(amount);
        return parseFloat((amount + fees).toFixed(2));
    }

    /**
     * Track donation attempt
     */
    trackDonationAttempt(donationData) {
        this.state.donationAttempts.push({
            ...donationData,
            attemptTime: new Date().toISOString()
        });
        
        this.trackEvent('donation_attempt', donationData);
    }

    /**
     * Process real donation via PayPal
     */
    async processRealDonation(donationData) {
        try {
            // Show redirect confirmation
            this.showRedirectConfirmation(donationData.amount);
            
            // Build PayPal URL
            const paypalUrl = this.buildPayPalUrl(donationData);
            
            // Track redirect
            this.trackEvent('paypal_redirect', {
                amount: donationData.amount,
                url: paypalUrl,
                timestamp: new Date().toISOString()
            });
            
            // Short delay for user to see message
            await this.delay(1500);
            
            // Redirect to PayPal
            window.location.href = paypalUrl;
            
        } catch (error) {
            throw new Error(`PayPal redirect failed: ${error.message}`);
        }
    }

    /**
     * Process demo donation
     */
    async processDemoDonation(donationData) {
        try {
            // Simulate processing delay
            await this.delay(2000);
            
            // Generate demo transaction
            const transaction = this.generateDemoTransaction(donationData);
            
            // Show success
            this.showReceipt(transaction);
            
            // Update cache
            this.cache.lastDonation = transaction;
            this.cache.preferredAmount = donationData.amount;
            this.saveCache();
            
            // Track success
            this.trackEvent('demo_donation_success', transaction);
            
        } catch (error) {
            throw new Error(`Demo donation failed: ${error.message}`);
        }
    }

    /**
     * Build PayPal URL
     */
    buildPayPalUrl(donationData) {
        const baseParams = {
            cmd: '_donations',
            business: this.paypalConfig.businessEmail,
            item_name: `ExposureShield Donation - $${donationData.amount}`,
            amount: donationData.amount,
            currency_code: donationData.currency,
            no_note: 1,
            no_shipping: 1,
            rm: 1,
            return: `${this.paypalConfig.returnUrl}?session=${this.state.sessionId}&amount=${donationData.amount}`,
            cancel_return: this.paypalConfig.cancelUrl,
            notify_url: this.paypalConfig.notifyUrl,
            custom: JSON.stringify({
                sessionId: this.state.sessionId,
                donationId: donationData.id,
                timestamp: donationData.timestamp
            })
        };
        
        const params = new URLSearchParams(baseParams);
        return `${this.paypalConfig.baseUrl}/cgi-bin/webscr?${params.toString()}`;
    }

    /**
     * Generate demo transaction
     */
    generateDemoTransaction(donationData) {
        const transactionId = `DEMO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        return {
            ...donationData,
            transactionId: transactionId,
            status: 'completed',
            paymentMethod: 'PayPal (Demo)',
            receiptSent: true,
            demo: true,
            processingTime: Date.now() - this.state.processingStartTime
        };
    }

    /**
     * Handle processing error
     */
    handleProcessingError(error, amount) {
        this.state.retryCount++;
        
        this.log('Donation processing error', {
            error: error.message,
            amount,
            retryCount: this.state.retryCount,
            processingTime: Date.now() - this.state.processingStartTime
        });
        
        this.trackEvent('donation_error', {
            error: error.message,
            amount,
            retryCount: this.state.retryCount
        });
        
        // Check if we should retry
        if (this.state.retryCount < this.config.retryAttempts) {
            this.showToast(`Payment failed. Retrying... (${this.state.retryCount}/${this.config.retryAttempts})`, 'warning');
            setTimeout(() => this.processDonation(amount), 1000 * this.state.retryCount);
        } else {
            this.showError('Payment processing failed. Please try again or contact support.', error);
            this.stopProcessing();
        }
    }

    /**
     * Check return from payment
     */
    checkReturnFromPayment() {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.has('paypal_return')) {
            const success = urlParams.get('success');
            const amount = urlParams.get('amount');
            const transactionId = urlParams.get('tx');
            
            if (success === 'true' && amount && transactionId) {
                this.showReceipt({
                    amount: parseFloat(amount),
                    transactionId: transactionId,
                    timestamp: new Date().toISOString(),
                    status: 'completed',
                    paymentMethod: 'PayPal'
                });
                
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }

    /**
     * Handle PayPal return
     */
    handlePayPalReturn(details) {
        this.log('PayPal return received', details);
        
        if (details.status === 'completed') {
            this.showReceipt(details);
        } else {
            this.showError('Payment was cancelled or failed', details);
        }
    }

    /**
     * Show processing overlay
     */
    showProcessingOverlay(amount) {
        const overlay = this.ui.elements.processingOverlay;
        const amountElement = overlay.querySelector('#processingAmount');
        
        if (amountElement) {
            amountElement.textContent = `$${amount}`;
        }
        
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Hide processing overlay
     */
    hideProcessingOverlay() {
        this.ui.elements.processingOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Show redirect confirmation
     */
    showRedirectConfirmation(amount) {
        this.showToast(
            `<i class="fas fa-external-link-alt"></i> Redirecting to PayPal to complete your $${amount} donation...`,
            'info',
            3000
        );
    }

    /**
     * Show receipt
     */
    showReceipt(transaction) {
        const modal = this.ui.elements.receiptModal;
        const amountElement = modal.querySelector('#receiptAmount');
        const transactionIdElement = modal.querySelector('#receiptTransactionId');
        const dateElement = modal.querySelector('#receiptDate');
        const methodElement = modal.querySelector('#receiptMethod');
        
        if (amountElement) amountElement.textContent = `$${transaction.amount}`;
        if (transactionIdElement) transactionIdElement.textContent = transaction.transactionId;
        if (dateElement) dateElement.textContent = new Date(transaction.timestamp).toLocaleString();
        if (methodElement) methodElement.textContent = transaction.paymentMethod;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        this.stopProcessing();
        
        // Track receipt view
        this.trackEvent('receipt_displayed', {
            transactionId: transaction.transactionId,
            amount: transaction.amount
        });
    }

    /**
     * Close receipt
     */
    closeReceipt() {
        this.ui.elements.receiptModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Show error
     */
    showError(message, errorDetails = null) {
        const modal = this.ui.elements.errorModal;
        const messageElement = modal.querySelector('#errorMessage');
        
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Setup retry button
        const retryBtn = modal.querySelector('#retryPaymentBtn');
        if (retryBtn) {
            retryBtn.onclick = () => {
                this.closeError();
                this.processDonation(this.state.currentAmount);
            };
        }
        
        // Log error details
        if (errorDetails) {
            this.log('Payment error details', errorDetails);
        }
    }

    /**
     * Close error modal
     */
    closeError() {
        this.ui.elements.errorModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Disable donation buttons
     */
    disableDonationButtons(disabled) {
        const buttons = document.querySelectorAll('.donate-button, .donate-tier, .quick-amount');
        
        buttons.forEach(button => {
            button.disabled = disabled;
            if (disabled) {
                button.classList.add('disabled');
            } else {
                button.classList.remove('disabled');
            }
        });
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 5000) {
        // Remove existing toasts
        document.querySelectorAll('.donation-toast').forEach(toast => toast.remove());
        
        // Create toast
        const toast = document.createElement('div');
        toast.className = `donation-toast donation-toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <div class="toast-message">${message}</div>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Add styles if not already added
        this.addToastStyles();
        
        // Show with animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto-remove
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
        
        return toast;
    }

    /**
     * Show validation message
     */
    showValidationMessage(message, type = 'error') {
        const input = this.ui.elements.customAmountInput;
        if (!input) return;
        
        // Remove existing validation message
        const existingMessage = input.parentElement.querySelector('.validation-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Add validation message
        const messageElement = document.createElement('div');
        messageElement.className = `validation-message validation-${type}`;
        messageElement.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        input.parentElement.appendChild(messageElement);
        
        // Highlight input
        input.classList.add(`validation-${type}`);
        
        // Auto-remove
        setTimeout(() => {
            messageElement.remove();
            input.classList.remove(`validation-${type}`);
        }, 5000);
    }

    /**
     * Get toast icon
     */
    getToastIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'error': 'times-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * Add toast styles
     */
    addToastStyles() {
        if (document.getElementById('donation-toast-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'donation-toast-styles';
        style.textContent = `
            .donation-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                transform: translateX(150%);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10000;
                max-width: 400px;
                font-family: 'Inter', sans-serif;
            }
            
            .donation-toast.show {
                transform: translateX(0);
            }
            
            .toast-content {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            
            .toast-content i {
                font-size: 1.2rem;
                margin-top: 2px;
                flex-shrink: 0;
            }
            
            .toast-message {
                flex: 1;
                line-height: 1.5;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.2s;
                padding: 0;
                margin-left: 8px;
            }
            
            .toast-close:hover {
                opacity: 1;
            }
            
            .donation-toast-success {
                background: linear-gradient(135deg, #10b981, #34d399);
            }
            
            .donation-toast-info {
                background: linear-gradient(135deg, #3b82f6, #60a5fa);
            }
            
            .donation-toast-warning {
                background: linear-gradient(135deg, #f59e0b, #fbbf24);
            }
            
            .donation-toast-error {
                background: linear-gradient(135deg, #ef4444, #f87171);
            }
            
            @media (max-width: 768px) {
                .donation-toast {
                    left: 20px;
                    right: 20px;
                    max-width: none;
                    transform: translateY(-150%);
                }
                
                .donation-toast.show {
                    transform: translateY(0);
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Add validation styles
     */
    addValidationStyles() {
        if (document.getElementById('donation-validation-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'donation-validation-styles';
        style.textContent = `
            .validation-message {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 8px;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 0.9rem;
                animation: slideDown 0.3s ease;
            }
            
            .validation-error {
                background: #fee2e2;
                color: #dc2626;
                border: 1px solid #fca5a5;
            }
            
            .validation-warning {
                background: #fef3c7;
                color: #92400e;
                border: 1px solid #fcd34d;
            }
            
            .validation-success {
                background: #dcfce7;
                color: #166534;
                border: 1px solid #86efac;
            }
            
            .validation-error-input {
                border-color: #dc2626 !important;
                background: #fef2f2;
            }
            
            .validation-warning-input {
                border-color: #f59e0b !important;
                background: #fffbeb;
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Track page view
     */
    trackPageView() {
        this.trackEvent('page_view', {
            page: 'donation',
            sessionId: this.state.sessionId,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Track event
     */
    trackEvent(eventName, eventData = {}) {
        const event = {
            name: eventName,
            data: eventData,
            timestamp: new Date().toISOString(),
            sessionId: this.state.sessionId
        };
        
        this.analytics.events.push(event);
        
        // Log to console in development
        if (this.config.demoMode) {
            console.log(`📊 Event: ${eventName}`, eventData);
        }
        
        // Send to analytics endpoint (implement based on your analytics solution)
        this.sendAnalyticsEvent(event);
    }

    /**
     * Send analytics event
     */
    sendAnalyticsEvent(event) {
        // Implement based on your analytics solution
        // Example: Google Analytics, Mixpanel, etc.
        
        /*
        if (typeof gtag !== 'undefined') {
            gtag('event', event.name, event.data);
        }
        
        if (typeof mixpanel !== 'undefined') {
            mixpanel.track(event.name, event.data);
        }
        */
        
        // Send to your own endpoint
        /*
        fetch('/api/analytics/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        }).catch(error => {
            this.log('Analytics send failed', error);
        });
        */
    }

    /**
     * Log message
     */
    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            sessionId: this.state.sessionId,
            message,
            data
        };
        
        console.log(`[DonationSystem ${timestamp}] ${message}`, data || '');
        
        // Store in analytics
        this.analytics.events.push({
            name: 'log',
            data: logEntry,
            timestamp
        });
    }

    /**
     * Handle error
     */
    handleError(context, error) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            context,
            error: error.message,
            stack: error.stack,
            sessionId: this.state.sessionId
        };
        
        this.analytics.errors.push(errorEntry);
        
        console.error(`[DonationSystem Error] ${context}:`, error);
        
        // Send to error tracking service
        this.sendErrorReport(errorEntry);
    }

    /**
     * Send error report
     */
    sendErrorReport(errorEntry) {
        // Implement error reporting (Sentry, LogRocket, etc.)
        /*
        if (typeof Sentry !== 'undefined') {
            Sentry.captureException(new Error(errorEntry.context), {
                extra: errorEntry
            });
        }
        */
        
        // Send to your own endpoint
        /*
        fetch('/api/errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorEntry)
        });
        */
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Check if demo environment
     */
    isDemoEnvironment() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || 
               hostname === '127.0.0.1' ||
               hostname.includes('github.io') ||
               hostname.includes('netlify.app') ||
               hostname.includes('vercel.app') ||
               hostname.includes('staging.');
    }

    /**
     * Delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            config: this.config,
            state: this.state,
            cache: this.cache,
            analytics: {
                events: this.analytics.events.length,
                errors: this.analytics.errors.length
            }
        };
    }

    /**
     * Reset system
     */
    reset() {
        this.state = {
            currentAmount: this.config.defaultAmount,
            isProcessing: false,
            processingStartTime: null,
            retryCount: 0,
            sessionId: this.generateSessionId(),
            donationAttempts: [],
            paymentMethod: null,
            userConsent: false
        };
        
        this.updateCustomAmountInput(this.config.defaultAmount);
        this.updateCustomAmountDisplay();
        this.deselectAllTiers();
        
        this.log('System reset');
    }
}

// Initialize donation system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        const donationSystem = new DonationSystem();
        
        // Make available globally
        window.donationSystem = donationSystem;
        
        // Add CSS styles
        donationSystem.addDonationSystemStyles();
        
        console.log('✅ ExposureShield Donation System v2.0 Ready');
        console.log('📊 System Status:', donationSystem.getStatus());
        
    } catch (error) {
        console.error('❌ Donation System Initialization Failed:', error);
        
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'donation-system-error';
        errorDiv.innerHTML = `
            <div class="error-alert">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Donation System Temporarily Unavailable</h3>
                <p>We're experiencing technical difficulties. Please try again later or contact support.</p>
                <button onclick="window.location.reload()">
                    <i class="fas fa-redo"></i> Reload Page
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }
});

// PayPal IPN handler example
if (window.location.pathname.includes('/api/paypal/ipn')) {
    // This would be server-side code
    // For demo purposes, we'll just log it
    console.log('PayPal IPN received');
}

// Add CSS styles for the donation system
if (!document.getElementById('donation-system-styles')) {
    const style = document.createElement('style');
    style.id = 'donation-system-styles';
    style.textContent = `
        /* Processing Overlay */
        .donation-processing-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(8px);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: 'Inter', sans-serif;
        }
        
        .donation-processing-overlay.active {
            display: flex;
            animation: fadeIn 0.3s ease;
        }
        
        .processing-content {
            text-align: center;
            max-width: 400px;
            padding: 40px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }
        
        .processing-spinner {
            margin-bottom: 30px;
        }
        
        .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid #e2e8f0;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
        .processing-message h3 {
            font-family: 'Poppins', sans-serif;
            font-size: 1.5rem;
            margin-bottom: 10px;
            color: #0f172a;
        }
        
        .processing-message p {
            color: #64748b;
            margin-bottom: 25px;
        }
        
        .processing-details {
            background: #f8fafc;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 25px;
            border: 1px solid #e2e8f0;
        }
        
        .detail-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .detail-item:last-child {
            margin-bottom: 0;
        }
        
        .detail-label {
            color: #64748b;
            font-weight: 500;
        }
        
        .detail-value {
            color: #0f172a;
            font-weight: 600;
        }
        
        .processing-security {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: #10b981;
            font-weight: 600;
            padding: 12px;
            background: #f0fdf4;
            border-radius: 8px;
            border: 1px solid #bbf7d0;
        }
        
        /* Receipt Modal */
        .donation-receipt-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            padding: 20px;
        }
        
        .donation-receipt-modal.active {
            display: flex;
            animation: fadeIn 0.3s ease;
        }
        
        .receipt-content {
            background: white;
            border-radius: 20px;
            max-width: 500px;
            width: 100%;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        
        .receipt-header {
            background: linear-gradient(135deg, #10b981, #34d399);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .receipt-header i {
            font-size: 3rem;
            margin-bottom: 20px;
        }
        
        .receipt-header h2 {
            font-family: 'Poppins', sans-serif;
            font-size: 1.8rem;
            margin: 0;
        }
        
        .receipt-body {
            padding: 40px;
        }
        
        .receipt-details {
            background: #f8fafc;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
            border: 1px solid #e2e8f0;
        }
        
        .receipt-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .receipt-row:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
        }
        
        .receipt-row code {
            background: #f1f5f9;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.9rem;
        }
        
        .receipt-actions {
            display: flex;
            gap: 12px;
            margin-bottom: 25px;
        }
        
        .receipt-actions button {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .btn-print {
            background: #3b82f6;
            color: white;
        }
        
        .btn-print:hover {
            background: #2563eb;
        }
        
        .btn-email {
            background: #8b5cf6;
            color: white;
        }
        
        .btn-email:hover {
            background: #7c3aed;
        }
        
        .btn-close {
            background: #f1f5f9;
            color: #64748b;
        }
        
        .btn-close:hover {
            background: #e2e8f0;
        }
        
        .receipt-footer {
            background: #f0fdf4;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #bbf7d0;
        }
        
        .receipt-footer p {
            margin: 8px 0;
            color: #166534;
            font-size: 0.9rem;
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }
        
        .receipt-footer i {
            margin-top: 2px;
        }
        
        /* Error Modal */
        .donation-error-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            padding: 20px;
        }
        
        .donation-error-modal.active {
            display: flex;
            animation: fadeIn 0.3s ease;
        }
        
        .error-content {
            background: white;
            border-radius: 20px;
            max-width: 500px;
            width: 100%;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        
        .error-header {
            background: linear-gradient(135deg, #f59e0b, #fbbf24);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .error-header i {
            font-size: 2.5rem;
            margin-bottom: 15px;
        }
        
        .error-header h2 {
            font-family: 'Poppins', sans-serif;
            font-size: 1.5rem;
            margin: 0;
        }
        
        .error-body {
            padding: 30px;
        }
        
        .error-body p {
            color: #0f172a;
            margin-bottom: 25px;
            line-height: 1.6;
        }
        
        .error-suggestions {
            background: #fef3c7;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #fcd34d;
        }
        
        .error-suggestions h4 {
            font-family: 'Poppins', sans-serif;
            margin-bottom: 10px;
            color: #92400e;
        }
        
        .error-suggestions ul {
            margin: 0;
            padding-left: 20px;
            color: #92400e;
        }
        
        .error-suggestions li {
            margin-bottom: 8px;
        }
        
        .error-suggestions li:last-child {
            margin-bottom: 0;
        }
        
        .error-actions {
            display: flex;
            gap: 12px;
            padding: 0 30px 30px;
        }
        
        .error-actions button {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .btn-retry {
            background: #3b82f6;
            color: white;
        }
        
        .btn-retry:hover {
            background: #2563eb;
        }
        
        .btn-cancel {
            background: #f1f5f9;
            color: #64748b;
        }
        
        .btn-cancel:hover {
            background: #e2e8f0;
        }
        
        .btn-support {
            background: #10b981;
            color: white;
        }
        
        .btn-support:hover {
            background: #059669;
        }
        
        /* Tier Selection Animation */
        .tier-card.selected {
            border-color: #3b82f6 !important;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.15) !important;
            transform: translateY(-4px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .tier-card.selected .tier-amount {
            color: #2563eb;
        }
        
        /* Donation Button States */
        .donate-button.disabled,
        .donate-tier.disabled,
        .quick-amount.disabled {
            opacity: 0.6;
            cursor: not-allowed;
            pointer-events: none;
        }
        
        /* Donation System Error */
        .donation-system-error {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            padding: 20px;
        }
        
        .error-alert {
            max-width: 400px;
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }
        
        .error-alert i {
            font-size: 3rem;
            color: #f59e0b;
            margin-bottom: 20px;
        }
        
        .error-alert h3 {
            font-family: 'Poppins', sans-serif;
            font-size: 1.5rem;
            margin-bottom: 15px;
            color: #0f172a;
        }
        
        .error-alert p {
            color: #64748b;
            margin-bottom: 25px;
            line-height: 1.6;
        }
        
        .error-alert button {
            background: linear-gradient(135deg, #3b82f6, #60a5fa);
            color: white;
            border: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 10px;
        }
        
        .error-alert button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(37, 99, 235, 0.3);
        }
        
        /* Animations */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .receipt-actions,
            .error-actions {
                flex-direction: column;
            }
            
            .processing-content,
            .receipt-content,
            .error-content {
                padding: 30px 20px;
            }
            
            .receipt-header,
            .error-header {
                padding: 30px 20px;
            }
        }
        
        @media (max-width: 480px) {
            .receipt-body,
            .error-body {
                padding: 20px 15px;
            }
            
            .receipt-actions,
            .error-actions {
                padding: 0 15px 20px;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// PayPal SDK integration (optional)
if (typeof window.paypal === 'undefined') {
    // Load PayPal SDK if needed
    const script = document.createElement('script');
    script.src = 'https://www.paypal.com/sdk/js?client-id=sb&currency=USD';
    script.async = true;
    script.onload = () => {
        console.log('PayPal SDK loaded');
    };
    document.head.appendChild(script);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DonationSystem;
}