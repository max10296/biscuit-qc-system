/**
 * Application Improvements and Fixes
 * Addresses important issues and enhances the Biscuit QC System
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        DEBUG_MODE: false, // Set to false for production
        PERFORMANCE_MONITORING: true,
        AUTO_SAVE_INTERVAL: 30000, // 30 seconds
        ERROR_REPORTING: true
    };

    // Performance monitoring
    const PerformanceMonitor = {
        metrics: {},
        
        start: function(label) {
            this.metrics[label] = performance.now();
        },
        
        end: function(label) {
            if (this.metrics[label]) {
                const duration = performance.now() - this.metrics[label];
                if (CONFIG.DEBUG_MODE) {
                    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
                }
                delete this.metrics[label];
                return duration;
            }
        },
        
        measure: function(label, callback) {
            this.start(label);
            const result = callback();
            this.end(label);
            return result;
        }
    };

    /**
     * Initialize improvements
     */
    function init() {
        // 1. Fix Debug Mode
        fixDebugMode();
        
        // 2. Clean Console Logs
        cleanConsoleLogs();
        
        // 3. Improve Error Handling
        improveErrorHandling();
        
        // 4. Add Performance Optimizations
        addPerformanceOptimizations();
        
        // 5. Fix Memory Leaks
        fixMemoryLeaks();
        
        // 6. Add Data Validation
        addDataValidation();
        
        // 7. Improve Navigation
        improveNavigation();
        
        // 8. Add Accessibility Features
        addAccessibilityFeatures();
        
        // 9. Add Auto-save Indicator
        addAutoSaveIndicator();
        
        // 10. Add Keyboard Shortcuts
        addKeyboardShortcuts();
    }

    /**
     * Fix debug mode across the application
     */
    function fixDebugMode() {
        // Override global DEBUG flag
        window.DEBUG = CONFIG.DEBUG_MODE;
        
        // Override console methods in production
        if (!CONFIG.DEBUG_MODE) {
            const noop = function() {};
            const methods = ['log', 'debug', 'info', 'warn'];
            
            methods.forEach(method => {
                const original = console[method];
                console[method] = function() {
                    if (CONFIG.DEBUG_MODE) {
                        original.apply(console, arguments);
                    }
                };
            });
        }
    }

    /**
     * Clean console logs for production
     */
    function cleanConsoleLogs() {
        if (!CONFIG.DEBUG_MODE) {
            // Remove debug console logs
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => {
                if (script.src && script.src.includes('js/')) {
                    // Scripts are already loaded, we can't modify them
                    // But we've already overridden console methods above
                }
            });
        }
    }

    /**
     * Improve error handling
     */
    function improveErrorHandling() {
        // Enhanced global error handler
        window.addEventListener('error', function(event) {
            if (CONFIG.ERROR_REPORTING) {
                const errorInfo = {
                    message: event.error?.message || event.message,
                    source: event.filename,
                    line: event.lineno,
                    column: event.colno,
                    stack: event.error?.stack,
                    timestamp: new Date().toISOString()
                };
                
                // Log to local storage for debugging
                const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
                errors.push(errorInfo);
                // Keep only last 50 errors
                if (errors.length > 50) {
                    errors.shift();
                }
                localStorage.setItem('app_errors', JSON.stringify(errors));
                
                // Show user-friendly error message
                if (typeof showNotification === 'function') {
                    showNotification('An error occurred. The issue has been logged.', 'error', 3000);
                }
            }
        });
        
        // Enhanced promise rejection handler
        window.addEventListener('unhandledrejection', function(event) {
            if (CONFIG.ERROR_REPORTING) {
                const errorInfo = {
                    reason: event.reason?.message || String(event.reason),
                    promise: String(event.promise),
                    timestamp: new Date().toISOString()
                };
                
                const errors = JSON.parse(localStorage.getItem('app_promise_errors') || '[]');
                errors.push(errorInfo);
                if (errors.length > 50) {
                    errors.shift();
                }
                localStorage.setItem('app_promise_errors', JSON.stringify(errors));
            }
        });
    }

    /**
     * Add performance optimizations
     */
    function addPerformanceOptimizations() {
        // 1. Debounce input handlers
        debounceInputHandlers();
        
        // 2. Lazy load heavy components
        lazyLoadComponents();
        
        // 3. Optimize table rendering
        optimizeTableRendering();
        
        // 4. Cache DOM queries
        cacheDOMQueries();
    }

    /**
     * Debounce input handlers to improve performance
     */
    function debounceInputHandlers() {
        const inputs = document.querySelectorAll('input[type="text"], input[type="number"], textarea');
        
        inputs.forEach(input => {
            const originalHandler = input.oninput;
            if (originalHandler) {
                input.oninput = debounce(originalHandler, 300);
            }
        });
    }

    /**
     * Lazy load heavy components
     */
    function lazyLoadComponents() {
        // Use Intersection Observer for lazy loading
        if ('IntersectionObserver' in window) {
            const lazyElements = document.querySelectorAll('[data-lazy]');
            const imageObserver = new IntersectionObserver(function(entries, observer) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        const element = entry.target;
                        // Load the component
                        if (element.dataset.lazySrc) {
                            element.src = element.dataset.lazySrc;
                            delete element.dataset.lazySrc;
                        }
                        imageObserver.unobserve(element);
                    }
                });
            });
            
            lazyElements.forEach(element => imageObserver.observe(element));
        }
    }

    /**
     * Optimize table rendering
     */
    function optimizeTableRendering() {
        // Use requestAnimationFrame for table updates
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            // Add virtual scrolling for large tables
            if (table.rows.length > 100) {
                addVirtualScrolling(table);
            }
        });
    }

    /**
     * Cache DOM queries
     */
    function cacheDOMQueries() {
        // Create a cache for frequently accessed elements
        window.domCache = {
            productSelect: document.getElementById('product-name'),
            dateInput: document.getElementById('report-date'),
            shiftSelect: document.getElementById('shift-time'),
            batchInput: document.getElementById('batch-number'),
            notification: document.getElementById('notification'),
            settingsTab: document.querySelector('[data-tab="settings-tab"]'),
            get: function(id) {
                if (!this[id]) {
                    this[id] = document.getElementById(id);
                }
                return this[id];
            }
        };
    }

    /**
     * Fix memory leaks
     */
    function fixMemoryLeaks() {
        // 1. Remove event listeners on element removal
        const originalRemoveChild = Node.prototype.removeChild;
        Node.prototype.removeChild = function(child) {
            // Clean up event listeners
            if (child.nodeType === 1) { // Element node
                const allElements = child.getElementsByTagName('*');
                for (let element of allElements) {
                    if (element._eventListeners) {
                        for (let type in element._eventListeners) {
                            element._eventListeners[type].forEach(listener => {
                                element.removeEventListener(type, listener);
                            });
                        }
                    }
                }
            }
            return originalRemoveChild.call(this, child);
        };
        
        // 2. Clear timers and intervals
        const timers = new Set();
        const originalSetTimeout = window.setTimeout;
        const originalSetInterval = window.setInterval;
        
        window.setTimeout = function() {
            const id = originalSetTimeout.apply(window, arguments);
            timers.add(id);
            return id;
        };
        
        window.setInterval = function() {
            const id = originalSetInterval.apply(window, arguments);
            timers.add(id);
            return id;
        };
        
        // Clear all timers on page unload
        window.addEventListener('beforeunload', () => {
            timers.forEach(id => {
                clearTimeout(id);
                clearInterval(id);
            });
        });
    }

    /**
     * Add data validation
     */
    function addDataValidation() {
        // Add validation to all numeric inputs
        const numericInputs = document.querySelectorAll('input[type="number"]');
        numericInputs.forEach(input => {
            input.addEventListener('input', function() {
                const min = parseFloat(this.min);
                const max = parseFloat(this.max);
                const value = parseFloat(this.value);
                
                if (!isNaN(min) && value < min) {
                    this.classList.add('error');
                    showValidationError(this, `Value must be at least ${min}`);
                } else if (!isNaN(max) && value > max) {
                    this.classList.add('error');
                    showValidationError(this, `Value must be at most ${max}`);
                } else {
                    this.classList.remove('error');
                    clearValidationError(this);
                }
            });
        });
        
        // Add validation for required fields
        const requiredFields = document.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            field.addEventListener('blur', function() {
                if (!this.value.trim()) {
                    this.classList.add('error');
                    showValidationError(this, 'This field is required');
                } else {
                    this.classList.remove('error');
                    clearValidationError(this);
                }
            });
        });
    }

    /**
     * Show validation error
     */
    function showValidationError(element, message) {
        // Remove existing error message
        clearValidationError(element);
        
        // Create error message
        const errorMsg = document.createElement('div');
        errorMsg.className = 'validation-error';
        errorMsg.style.cssText = 'color: #ef4444; font-size: 0.75rem; margin-top: 0.25rem;';
        errorMsg.textContent = message;
        
        // Insert after the element
        element.parentNode.insertBefore(errorMsg, element.nextSibling);
    }

    /**
     * Clear validation error
     */
    function clearValidationError(element) {
        const existingError = element.parentNode.querySelector('.validation-error');
        if (existingError) {
            existingError.remove();
        }
    }

    /**
     * Improve navigation
     */
    function improveNavigation() {
        // Add breadcrumbs
        addBreadcrumbs();
        
        // Add scroll to top button
        // NOTE: This functionality is handled by enhanceScrollingExperience() in js/ui-enhancements.js
        // addScrollToTop(); // COMMENTED OUT: This function call caused an Uncaught ReferenceError as it is not defined here.

        // Improve tab navigation
        improveTabNavigation();
    }

    /**
     * Add breadcrumbs for better navigation
     */
    function addBreadcrumbs() {
        const breadcrumbContainer = document.createElement('div');
        breadcrumbContainer.id = 'breadcrumbs';
        breadcrumbContainer.className = 'breadcrumbs no-print';
        breadcrumbContainer.style.cssText = 'padding: 0.5rem 1rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-size: 0.875rem; color: #6b7280;';
        
        // Update breadcrumbs on tab change
        const updateBreadcrumbs = () => {
            const activeTab = document.querySelector('.tab.active');
            if (activeTab) {
                const tabName = activeTab.textContent;
                breadcrumbContainer.innerHTML = `
                    <span>Home</span>
                    <span style="margin: 0 0.5rem;">›</span>
                    <span style="color: #111827; font-weight: 500;">${tabName}</span>
                `;
            }
        };
        
        // Insert breadcrumbs
        const printArea = document.getElementById('print-area');
        if (printArea && printArea.parentNode) {
            printArea.parentNode.insertBefore(breadcrumbContainer, printArea);
        }
        
        // Listen for tab changes
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('tab')) {
                setTimeout(updateBreadcrumbs, 100);
            }
        });
        
        updateBreadcrumbs();
    }



    /**
     * Improve tab navigation
     */
    function improveTabNavigation() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach((tab, index) => {
            // Add keyboard navigation
            tab.setAttribute('tabindex', '0');
            tab.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.click();
                }
                if (e.key === 'ArrowRight' && tabs[index + 1]) {
                    tabs[index + 1].focus();
                }
                if (e.key === 'ArrowLeft' && tabs[index - 1]) {
                    tabs[index - 1].focus();
                }
            });
        });
    }

    /**
     * Add accessibility features
     */
    function addAccessibilityFeatures() {
        // Add ARIA labels
        addAriaLabels();
        
        // Add focus indicators
        addFocusIndicators();
        
        // Add skip navigation
        addSkipNavigation();
    }

    /**
     * Add ARIA labels
     */
    function addAriaLabels() {
        // Add labels to buttons without text
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            if (!button.textContent.trim() && !button.getAttribute('aria-label')) {
                const icon = button.querySelector('i');
                if (icon) {
                    const className = icon.className;
                    if (className.includes('plus')) button.setAttribute('aria-label', 'Add');
                    if (className.includes('minus')) button.setAttribute('aria-label', 'Remove');
                    if (className.includes('edit')) button.setAttribute('aria-label', 'Edit');
                    if (className.includes('delete')) button.setAttribute('aria-label', 'Delete');
                    if (className.includes('save')) button.setAttribute('aria-label', 'Save');
                    if (className.includes('close')) button.setAttribute('aria-label', 'Close');
                }
            }
        });
        
        // Add labels to form inputs
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (!input.getAttribute('aria-label') && !input.labels?.length) {
                const label = input.placeholder || input.name || input.id;
                if (label) {
                    input.setAttribute('aria-label', label);
                }
            }
        });
    }

    /**
     * Add focus indicators
     */
    function addFocusIndicators() {
        const style = document.createElement('style');
        style.textContent = `
            *:focus {
                outline: 2px solid #4f46e5 !important;
                outline-offset: 2px !important;
            }
            
            button:focus-visible,
            a:focus-visible,
            input:focus-visible,
            select:focus-visible,
            textarea:focus-visible {
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Add skip navigation
     */
    function addSkipNavigation() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.className = 'skip-navigation';
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 0;
            background: #4f46e5;
            color: white;
            padding: 0.5rem 1rem;
            text-decoration: none;
            z-index: 10000;
        `;
        
        skipLink.addEventListener('focus', function() {
            this.style.top = '0';
        });
        
        skipLink.addEventListener('blur', function() {
            this.style.top = '-40px';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // Add main content ID
        const mainContent = document.getElementById('print-area');
        if (mainContent) {
            mainContent.id = 'main-content';
        }
    }

    /**
     * Add auto-save indicator
     */
    function addAutoSaveIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'auto-save-indicator';
        indicator.className = 'no-print';
        indicator.style.cssText = `
            position: fixed;
            top: 1rem;
            right: 1rem;
            padding: 0.5rem 1rem;
            background: #10b981;
            color: white;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            display: none;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        `;
        
        document.body.appendChild(indicator);
        
        // Show indicator on save
        const originalSaveFunction = window.saveSessionData;
        if (typeof originalSaveFunction === 'function') {
            window.saveSessionData = function() {
                const result = originalSaveFunction.apply(this, arguments);
                
                // Show indicator
                indicator.textContent = 'Auto-saved';
                indicator.style.display = 'block';
                
                setTimeout(() => {
                    indicator.style.display = 'none';
                }, 2000);
                
                return result;
            };
        }
    }

    /**
     * Add keyboard shortcuts
     */
    function addKeyboardShortcuts() {
        const shortcuts = {
            'Control+s': function(e) {
                e.preventDefault();
                // Save data
                if (typeof saveSessionData === 'function') {
                    saveSessionData();
                    if (typeof showNotification === 'function') {
                        showNotification('Data saved successfully', 'success', 2000);
                    }
                }
            },
            'Control+p': function(e) {
                e.preventDefault();
                // Print
                window.print();
            },
            'Control+z': function(e) {
                // Undo
                if (typeof undo === 'function') {
                    undo();
                }
            },
            'Control+y': function(e) {
                // Redo
                if (typeof redo === 'function') {
                    redo();
                }
            },
            'Control+/': function(e) {
                e.preventDefault();
                // Show shortcuts help
                showShortcutsHelp();
            },
            'Escape': function(e) {
                // Close modals
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => {
                    if (modal.style.display === 'block') {
                        modal.style.display = 'none';
                    }
                });
            }
        };
        
        document.addEventListener('keydown', function(e) {
            const key = (e.ctrlKey ? 'Control+' : '') + 
                       (e.altKey ? 'Alt+' : '') + 
                       (e.shiftKey ? 'Shift+' : '') + 
                       e.key.toLowerCase();
            
            if (shortcuts[key]) {
                shortcuts[key](e);
            }
        });
    }

    /**
     * Show keyboard shortcuts help
     */
    function showShortcutsHelp() {
        const helpModal = document.createElement('div');
        helpModal.className = 'modal';
        helpModal.style.display = 'block';
        helpModal.style.zIndex = '10002';
        helpModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem;">
                    <h2 style="margin: 0;">Keyboard Shortcuts</h2>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <table style="width: 100%;">
                        <tr><td style="padding: 0.5rem;"><kbd>Ctrl + S</kbd></td><td>Save data</td></tr>
                        <tr><td style="padding: 0.5rem;"><kbd>Ctrl + P</kbd></td><td>Print</td></tr>
                        <tr><td style="padding: 0.5rem;"><kbd>Ctrl + Z</kbd></td><td>Undo</td></tr>
                        <tr><td style="padding: 0.5rem;"><kbd>Ctrl + Y</kbd></td><td>Redo</td></tr>
                        <tr><td style="padding: 0.5rem;"><kbd>Ctrl + /</kbd></td><td>Show this help</td></tr>
                        <tr><td style="padding: 0.5rem;"><kbd>Escape</kbd></td><td>Close modals</td></tr>
                        <tr><td style="padding: 0.5rem;"><kbd>Tab</kbd></td><td>Navigate forward</td></tr>
                        <tr><td style="padding: 0.5rem;"><kbd>Shift + Tab</kbd></td><td>Navigate backward</td></tr>
                    </table>
                </div>
                <div class="modal-footer" style="padding: 1rem; text-align: right;">
                    <button onclick="this.closest('.modal').remove()" class="btn btn-primary" style="padding: 0.5rem 1.5rem; background: #4f46e5; color: white; border: none; border-radius: 0.375rem;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(helpModal);
        
        // Close on click outside
        helpModal.addEventListener('click', function(e) {
            if (e.target === helpModal) {
                helpModal.remove();
            }
        });
    }

    /**
     * Utility: Debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction() {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, arguments);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Utility: Add virtual scrolling to table
     */
    function addVirtualScrolling(table) {
        // Implementation would be complex, but here's a placeholder
        // This would require a library like Clusterize.js or similar
        console.log('Virtual scrolling would be added to table with', table.rows.length, 'rows');
    }

    /**
     * Public API
     */
    window.AppImprovements = {
        init: init,
        config: CONFIG,
        performanceMonitor: PerformanceMonitor,
        getErrors: function() {
            return {
                errors: JSON.parse(localStorage.getItem('app_errors') || '[]'),
                promiseErrors: JSON.parse(localStorage.getItem('app_promise_errors') || '[]')
            };
        },
        clearErrors: function() {
            localStorage.removeItem('app_errors');
            localStorage.removeItem('app_promise_errors');
            if (typeof showNotification === 'function') {
                showNotification('Error logs cleared', 'success', 2000);
            }
        },
        setDebugMode: function(enabled) {
            CONFIG.DEBUG_MODE = enabled;
            window.DEBUG = enabled;
            if (typeof showNotification === 'function') {
                showNotification(`Debug mode ${enabled ? 'enabled' : 'disabled'}`, 'info', 2000);
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