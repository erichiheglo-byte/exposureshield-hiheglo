// shared.js - Centralized Authentication System for ExposureShield
// Single source for all auth, header updates, and session management

const ExposureShieldAuth = (function() {
    // ========== CORE AUTH STATE ==========
    const STORAGE_KEYS = {
        TOKEN: 'exposureshield_token',
        USER: 'exposureshield_user',
        LEGACY_PLAN: 'user_legacy_plan',
        PENDING_PLAN: 'pending_legacy_plan',
        PENDING_EMAIL: 'pending_account_email'
    };

    // ========== PUBLIC API FUNCTIONS ==========
    
    // Check if user is logged in
    function isAuthenticated() {
        return !!localStorage.getItem(STORAGE_KEYS.TOKEN);
    }
    
    // Get current user data
    function getCurrentUser() {
        const user = localStorage.getItem(STORAGE_KEYS.USER);
        try {
            return user ? JSON.parse(user) : null;
        } catch (e) {
            // Corrupted user JSON - clear it to prevent repeated crashes
            localStorage.removeItem(STORAGE_KEYS.USER);
            return null;
        }
    }
    
    // Login function (call this after successful authentication)
    function login(token, userData) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        updateHeaderUI();
        transferPendingData(userData && userData.email ? userData.email : null);
        return true;
    }
    
    // Logout function
    function logout() {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        window.location.href = 'index.html';
    }
    
    // Protect pages that require authentication
    function requireAuth(options = {}) {
        const config = {
            redirectTo: 'login.html',
            showAlert: false,
            ...options
        };
        
        if (!isAuthenticated()) {
            const currentPage = window.location.pathname.split('/').pop();
            const redirectUrl = `${config.redirectTo}?redirect=${encodeURIComponent(currentPage)}`;
            
            if (config.showAlert) {
                if (confirm('You need to login to access this page. Go to login page?')) {
                    window.location.href = redirectUrl;
                }
            } else {
                window.location.href = redirectUrl;
            }
            return false;
        }
        return true;
    }
    
    // ========== UI MANAGEMENT ==========
    
    // Update header buttons based on login state
    function updateHeaderUI() {
        const authButtons = document.querySelector('.auth-buttons');
        if (!authButtons) return;
        
        if (isAuthenticated()) {
            const user = getCurrentUser();

            // If token exists but user is missing/corrupt, force logout to prevent crashes
            if (!user) {
                logout();
                return;
            }

            authButtons.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: #2563eb; font-weight: 500;">
                        <i class="fas fa-user-circle"></i> ${user.name || user.email || 'User'}
                    </span>
                    <a href="dashboard.html" class="dashboard-link" style="padding: 10px 20px;">
                        <i class="fas fa-tachometer-alt"></i> Dashboard
                    </a>
                    <a href="vault.html" class="auth-button login" style="margin-right: 10px;">
                        <i class="fas fa-file-archive"></i> Vault
                    </a>
                    <button class="auth-button login" onclick="ExposureShieldAuth.logout()">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            `;
        } else {
            authButtons.innerHTML = `
                <a href="login.html" class="auth-button login">
                    <i class="fas fa-sign-in-alt"></i> Sign In
                </a>
                <a href="register.html" class="auth-button signup">
                    <i class="fas fa-user-plus"></i> Create Account
                </a>
            `;
        }
    }
    
    // ========== LEGACY PLAN MANAGEMENT ==========
    
    // Transfer pending legacy plan to user account
    function transferPendingData(userEmail) {
        const pendingPlan = localStorage.getItem(STORAGE_KEYS.PENDING_PLAN);
        const pendingEmail = localStorage.getItem(STORAGE_KEYS.PENDING_EMAIL);

        // Guard against null/undefined emails and normalize comparison
        const normalizedUserEmail = (userEmail || '').toLowerCase();
        const normalizedPendingEmail = (pendingEmail || '').toLowerCase();
        
        if (pendingPlan && normalizedUserEmail && normalizedUserEmail === normalizedPendingEmail) {
            localStorage.setItem(STORAGE_KEYS.LEGACY_PLAN, pendingPlan);
            localStorage.removeItem(STORAGE_KEYS.PENDING_PLAN);
            localStorage.removeItem(STORAGE_KEYS.PENDING_EMAIL);
            return true;
        }
        return false;
    }
    
    // Save legacy plan (works for both logged-in and anonymous users)
    function saveLegacyPlan(planData, userEmail = null) {
        if (isAuthenticated()) {
            localStorage.setItem(STORAGE_KEYS.LEGACY_PLAN, JSON.stringify(planData));
            return { success: true, type: 'user_account' };
        } else {
            localStorage.setItem(STORAGE_KEYS.PENDING_PLAN, JSON.stringify(planData));
            if (userEmail) {
                localStorage.setItem(STORAGE_KEYS.PENDING_EMAIL, userEmail);
            }
            return { success: true, type: 'pending_transfer' };
        }
    }
    
    // Get user's legacy plan
    function getLegacyPlan() {
        const plan = localStorage.getItem(STORAGE_KEYS.LEGACY_PLAN);
        try {
            return plan ? JSON.parse(plan) : null;
        } catch (e) {
            // Corrupted plan JSON - clear it
            localStorage.removeItem(STORAGE_KEYS.LEGACY_PLAN);
            return null;
        }
    }
    
    // ========== HELPER FUNCTIONS ==========
    
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div style="padding: 12px 16px; background: ${type === 'success' ? '#10b981' : '#3b82f6'}; 
                 color: white; border-radius: 8px; margin: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }
    
    // ========== INITIALIZATION ==========
    
    function init() {
        // Update header on every page load
        updateHeaderUI();
        
        // Auto-redirect if logged in and on login/register pages
        const currentPage = window.location.pathname.split('/').pop();
        if (isAuthenticated()) {
            const user = getCurrentUser();

            // If token exists but user is missing/corrupt, force logout
            if (!user) {
                logout();
                return;
            }

            if (currentPage === 'login.html' || currentPage === 'register.html') {
                window.location.href = 'dashboard.html';
            }
            transferPendingData(user.email);
        }
    }
    
    // ========== PUBLIC API ==========
    return {
        // Core auth
        isAuthenticated,
        getCurrentUser,
        login,
        logout,
        requireAuth,
        
        // UI
        updateHeaderUI,
        
        // Legacy plans
        saveLegacyPlan,
        getLegacyPlan,
        transferPendingData,
        
        // Helpers
        showNotification,
        
        // Initialization
        init
    };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    ExposureShieldAuth.init();
});

// Make available globally
window.ExposureShieldAuth = ExposureShieldAuth;
