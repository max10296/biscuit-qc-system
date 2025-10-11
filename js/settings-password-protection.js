/**
 * Settings Password Protection System
 * Provides secure access control for the settings tab
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        STORAGE_KEY: 'settingsPasswordHash',
        SESSION_KEY: 'settingsAuthenticated',
        DEFAULT_PASSWORD: 'admin123', // Default password (user should change this)
        LOCKOUT_KEY: 'settingsLockout',
        MAX_ATTEMPTS: 5,
        LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds
        SESSION_DURATION: 30 * 60 * 1000 // 30 minutes session timeout
    };

    const PASSWORD_PROTECTION_ENABLED = false;

    // State management
    let isAuthenticated = false;
    let sessionTimeout = null;
    let attemptCount = 0;

    /**
     * Simple hash function for password storage (not cryptographically secure, but sufficient for this use case)
     */
    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return btoa(hash.toString() + password.length);
    }

    /**
     * Initialize password protection
     */
    function init() {
        if (!PASSWORD_PROTECTION_ENABLED) {
            isAuthenticated = true;
            sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify({ timestamp: Date.now() }));
            localStorage.removeItem(CONFIG.LOCKOUT_KEY);
            if (typeof console !== 'undefined') {
                console.info('Settings password protection is disabled. Settings tab is always accessible.');
            }
            // Remove any previously injected password UI if it exists
            const existingSection = document.getElementById('password-settings-section');
            if (existingSection) {
                existingSection.remove();
            }
            return;
        }

        // Check if password is set, if not, set default
        if (!localStorage.getItem(CONFIG.STORAGE_KEY)) {
            localStorage.setItem(CONFIG.STORAGE_KEY, hashPassword(CONFIG.DEFAULT_PASSWORD));
            showFirstTimeSetup();
        }

        // Check lockout status
        if (isLockedOut()) {
            showLockoutMessage();
            return;
        }

        // Check session
        checkSession();

        // Intercept settings tab clicks
        interceptSettingsAccess();

        // Add change password option to settings
        addChangePasswordOption();
    }

    /**
     * Check if system is locked out due to too many failed attempts
     */
    function isLockedOut() {
        const lockoutData = localStorage.getItem(CONFIG.LOCKOUT_KEY);
        if (lockoutData) {
            const { timestamp, attempts } = JSON.parse(lockoutData);
            const timePassed = Date.now() - timestamp;
            
            if (timePassed < CONFIG.LOCKOUT_DURATION && attempts >= CONFIG.MAX_ATTEMPTS) {
                return true;
            } else if (timePassed >= CONFIG.LOCKOUT_DURATION) {
                // Clear lockout
                localStorage.removeItem(CONFIG.LOCKOUT_KEY);
                attemptCount = 0;
            }
        }
        return false;
    }

    /**
     * Show lockout message
     */
    function showLockoutMessage() {
        const lockoutData = JSON.parse(localStorage.getItem(CONFIG.LOCKOUT_KEY));
        const timeRemaining = Math.ceil((CONFIG.LOCKOUT_DURATION - (Date.now() - lockoutData.timestamp)) / 60000);
        
        if (typeof showNotification === 'function') {
            showNotification(`Too many failed attempts. Please try again in ${timeRemaining} minutes.`, 'error', 5000);
        } else {
            alert(`Too many failed attempts. Please try again in ${timeRemaining} minutes.`);
        }
    }

    /**
     * Check session validity
     */
    function checkSession() {
        const session = sessionStorage.getItem(CONFIG.SESSION_KEY);
        if (session) {
            const sessionData = JSON.parse(session);
            const now = Date.now();
            
            if (now - sessionData.timestamp < CONFIG.SESSION_DURATION) {
                isAuthenticated = true;
                resetSessionTimeout();
            } else {
                clearSession();
            }
        }
    }

    /**
     * Reset session timeout
     */
    function resetSessionTimeout() {
        clearTimeout(sessionTimeout);
        sessionTimeout = setTimeout(() => {
            clearSession();
            if (typeof showNotification === 'function') {
                showNotification('Session expired. Please login again to access settings.', 'warning', 3000);
            }
        }, CONFIG.SESSION_DURATION);

        // Update session timestamp
        sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify({
            timestamp: Date.now(),
            authenticated: true
        }));
    }

    /**
     * Clear session
     */
    function clearSession() {
        isAuthenticated = false;
        sessionStorage.removeItem(CONFIG.SESSION_KEY);
        clearTimeout(sessionTimeout);
    }

    /**
     * Intercept settings tab access
     */
    function interceptSettingsAccess() {
        if (!PASSWORD_PROTECTION_ENABLED) return;
        // Find settings tab button
        const settingsTab = document.querySelector('[data-tab="settings-tab"]');
        if (!settingsTab) return;

        // Store original click handler
        const originalClickHandler = settingsTab.onclick;

        // Override click handler
        settingsTab.addEventListener('click', function(e) {
            if (!isAuthenticated && !isLockedOut()) {
                e.preventDefault();
                e.stopPropagation();
                showPasswordPrompt();
            } else if (isLockedOut()) {
                e.preventDefault();
                e.stopPropagation();
                showLockoutMessage();
            }
        }, true);
    }

    /**
     * Show password prompt modal
     */
    function showPasswordPrompt() {
        if (!PASSWORD_PROTECTION_ENABLED) return;
        // Create modal HTML
        const modalHTML = `
            <div id="password-modal" class="modal" style="display: block; z-index: 10001;">
                <div class="modal-content" style="max-width: 400px; margin-top: 10%;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 0.5rem 0.5rem 0 0;">
                        <h2 style="margin: 0; font-size: 1.5rem; display: flex; align-items: center;">
                            <i class="fas fa-lock" style="margin-right: 0.5rem;"></i>
                            Settings Authentication
                        </h2>
                    </div>
                    <div class="modal-body" style="padding: 2rem;">
                        <p style="margin-bottom: 1.5rem; color: #6b7280;">Please enter the password to access settings:</p>
                        <div style="margin-bottom: 1rem;">
                            <label for="settings-password" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Password:</label>
                            <div style="position: relative;">
                                <input type="password" id="settings-password" 
                                    style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 0.375rem; font-size: 1rem;"
                                    placeholder="Enter password" autocomplete="off">
                                <button type="button" id="toggle-password-visibility" 
                                    style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #6b7280; cursor: pointer;">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 1rem;">
                            <i class="fas fa-info-circle"></i> Default password: admin123
                        </div>
                        ${attemptCount > 0 ? `<div style="color: #ef4444; font-size: 0.875rem; margin-bottom: 1rem;">
                            <i class="fas fa-exclamation-triangle"></i> ${CONFIG.MAX_ATTEMPTS - attemptCount} attempts remaining
                        </div>` : ''}
                    </div>
                    <div class="modal-footer" style="padding: 1rem 2rem; background: #f9fafb; border-radius: 0 0 0.5rem 0.5rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                        <button id="cancel-password" class="btn btn-secondary" 
                            style="padding: 0.5rem 1.5rem; background: #e5e7eb; color: #374151; border: none; border-radius: 0.375rem; cursor: pointer;">
                            Cancel
                        </button>
                        <button id="submit-password" class="btn btn-primary"
                            style="padding: 0.5rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 0.375rem; cursor: pointer;">
                            <i class="fas fa-sign-in-alt" style="margin-right: 0.5rem;"></i>Login
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        // Focus on password input
        const passwordInput = document.getElementById('settings-password');
        passwordInput.focus();

        // Toggle password visibility
        const toggleBtn = document.getElementById('toggle-password-visibility');
        toggleBtn.addEventListener('click', function() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });

        // Handle submit
        const submitBtn = document.getElementById('submit-password');
        submitBtn.addEventListener('click', handlePasswordSubmit);

        // Handle enter key
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handlePasswordSubmit();
            }
        });

        // Handle cancel
        const cancelBtn = document.getElementById('cancel-password');
        cancelBtn.addEventListener('click', function() {
            modalContainer.remove();
        });
    }

    /**
     * Handle password submission
     */
    function handlePasswordSubmit() {
        if (!PASSWORD_PROTECTION_ENABLED) return;
        const passwordInput = document.getElementById('settings-password');
        const password = passwordInput.value;
        const storedHash = localStorage.getItem(CONFIG.STORAGE_KEY);

        if (hashPassword(password) === storedHash) {
            // Success
            isAuthenticated = true;
            attemptCount = 0;
            localStorage.removeItem(CONFIG.LOCKOUT_KEY);
            
            // Set session
            sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify({
                timestamp: Date.now(),
                authenticated: true
            }));
            resetSessionTimeout();

            // Remove modal
            document.querySelector('#password-modal').parentElement.remove();

            // Show success message
            if (typeof showNotification === 'function') {
                showNotification('Authentication successful! You can now access settings.', 'success', 2000);
            }

            // Trigger settings tab click
            const settingsTab = document.querySelector('[data-tab="settings-tab"]');
            if (settingsTab) {
                settingsTab.click();
            }
        } else {
            // Failed attempt
            attemptCount++;
            
            if (attemptCount >= CONFIG.MAX_ATTEMPTS) {
                // Lock out
                localStorage.setItem(CONFIG.LOCKOUT_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    attempts: attemptCount
                }));
                
                document.querySelector('#password-modal').parentElement.remove();
                showLockoutMessage();
            } else {
                // Show error
                passwordInput.value = '';
                passwordInput.style.borderColor = '#ef4444';
                
                const errorMsg = `Incorrect password. ${CONFIG.MAX_ATTEMPTS - attemptCount} attempts remaining.`;
                if (typeof showNotification === 'function') {
                    showNotification(errorMsg, 'error', 3000);
                } else {
                    alert(errorMsg);
                }
                
                // Update attempts display in modal
                const modalBody = document.querySelector('#password-modal .modal-body');
                const existingWarning = modalBody.querySelector('.fa-exclamation-triangle')?.parentElement;
                if (existingWarning) {
                    existingWarning.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${CONFIG.MAX_ATTEMPTS - attemptCount} attempts remaining`;
                } else {
                    const warning = document.createElement('div');
                    warning.style.cssText = 'color: #ef4444; font-size: 0.875rem; margin-bottom: 1rem;';
                    warning.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${CONFIG.MAX_ATTEMPTS - attemptCount} attempts remaining`;
                    modalBody.appendChild(warning);
                }
            }
        }
    }

    /**
     * Add change password option to settings
     */
    function addChangePasswordOption() {
        if (!PASSWORD_PROTECTION_ENABLED) return;
        // Wait for settings tab to be available
        setTimeout(() => {
            const generalSettings = document.getElementById('general-settings');
            if (!generalSettings) return;

            // Check if already added
            if (document.getElementById('password-settings-section')) return;

            // Create password settings section
            const passwordSection = document.createElement('div');
            passwordSection.id = 'password-settings-section';
            passwordSection.className = 'card mt-4';
            passwordSection.innerHTML = `
                <div class="card-header">
                    <h3 class="text-lg font-bold flex items-center">
                        <i class="fas fa-key mr-2"></i>
                        Password Settings
                    </h3>
                </div>
                <div class="card-body">
                    <p class="text-sm text-gray-600 mb-4">Manage password protection for the settings tab.</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Current Password:</label>
                            <input type="password" id="current-password" class="w-full p-2 border rounded" placeholder="Enter current password">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">New Password:</label>
                            <input type="password" id="new-password" class="w-full p-2 border rounded" placeholder="Enter new password">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Confirm New Password:</label>
                            <input type="password" id="confirm-password" class="w-full p-2 border rounded" placeholder="Confirm new password">
                        </div>
                        <div class="flex items-end">
                            <button id="change-password-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                                <i class="fas fa-save mr-2"></i>Change Password
                            </button>
                        </div>
                    </div>
                    <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p class="text-sm text-yellow-800">
                            <i class="fas fa-info-circle mr-1"></i>
                            <strong>Security Notes:</strong>
                        </p>
                        <ul class="text-xs text-yellow-700 mt-2 space-y-1">
                            <li>• Default password is: <code>admin123</code> (please change it immediately)</li>
                            <li>• Password must be at least 6 characters long</li>
                            <li>• After 5 failed attempts, the system will lock for 15 minutes</li>
                            <li>• Session expires after 30 minutes of inactivity</li>
                        </ul>
                    </div>
                </div>
            `;

            generalSettings.querySelector('.card-body').appendChild(passwordSection);

            // Add event listener for change password button
            document.getElementById('change-password-btn').addEventListener('click', handleChangePassword);
        }, 1000);
    }

    /**
     * Handle password change
     */
    function handleChangePassword() {
        if (!PASSWORD_PROTECTION_ENABLED) {
            if (typeof showNotification === 'function') {
                showNotification('Password protection is disabled. No password changes are required.', 'info', 3000);
            }
            return;
        }
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            if (typeof showNotification === 'function') {
                showNotification('Please fill in all password fields.', 'error', 3000);
            } else {
                alert('Please fill in all password fields.');
            }
            return;
        }

        // Check current password
        const storedHash = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (hashPassword(currentPassword) !== storedHash) {
            if (typeof showNotification === 'function') {
                showNotification('Current password is incorrect.', 'error', 3000);
            } else {
                alert('Current password is incorrect.');
            }
            return;
        }

        // Validate new password
        if (newPassword.length < 6) {
            if (typeof showNotification === 'function') {
                showNotification('New password must be at least 6 characters long.', 'error', 3000);
            } else {
                alert('New password must be at least 6 characters long.');
            }
            return;
        }

        // Check password match
        if (newPassword !== confirmPassword) {
            if (typeof showNotification === 'function') {
                showNotification('New passwords do not match.', 'error', 3000);
            } else {
                alert('New passwords do not match.');
            }
            return;
        }

        // Save new password
        localStorage.setItem(CONFIG.STORAGE_KEY, hashPassword(newPassword));

        // Clear fields
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';

        // Show success message
        if (typeof showNotification === 'function') {
            showNotification('Password changed successfully!', 'success', 3000);
        } else {
            alert('Password changed successfully!');
        }
    }

    /**
     * Show first-time setup message
     */
    function showFirstTimeSetup() {
        setTimeout(() => {
            if (typeof showNotification === 'function') {
                showNotification('Settings password protection enabled. Default password: admin123 (please change it in settings)', 'info', 5000);
            }
        }, 2000);
    }

    /**
     * Public API
     */
    window.SettingsPasswordProtection = {
        init: init,
        logout: function() {
            if (!PASSWORD_PROTECTION_ENABLED) {
                if (typeof showNotification === 'function') {
                    showNotification('Settings access is already unlocked.', 'info', 2000);
                }
                return;
            }
            clearSession();
            if (typeof showNotification === 'function') {
                showNotification('Logged out from settings.', 'info', 2000);
            }
            const tabs = document.querySelectorAll('.tab');
            if (tabs.length > 0) {
                tabs[0].click();
            }
        },
        isAuthenticated: function() {
            return PASSWORD_PROTECTION_ENABLED ? isAuthenticated : true;
        },
        resetPassword: function() {
            if (!PASSWORD_PROTECTION_ENABLED) {
                if (typeof showNotification === 'function') {
                    showNotification('Password protection is disabled. Reset is not necessary.', 'info', 4000);
                }
                return;
            }
            if (confirm('Are you sure you want to reset the password to default (admin123)?')) {
                localStorage.setItem(CONFIG.STORAGE_KEY, hashPassword(CONFIG.DEFAULT_PASSWORD));
                localStorage.removeItem(CONFIG.LOCKOUT_KEY);
                clearSession();
                attemptCount = 0;
                if (typeof showNotification === 'function') {
                    showNotification('Password has been reset to: admin123', 'warning', 5000);
                } else {
                    alert('Password has been reset to: admin123');
                }
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();