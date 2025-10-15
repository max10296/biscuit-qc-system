/**
 * Signature Management System
 * Handles custom signature configuration for products
 */

(function() {
    'use strict';

    // Default signature configuration
    const DEFAULT_SIGNATURES = [
        { id: 'sig1', label: 'Quality Engineer', visible: true, order: 1, showName: true, showDate: true },
        { id: 'sig2', label: 'Production Supervisor', visible: true, order: 2, showName: true, showDate: true },
        { id: 'sig3', label: 'Quality Manager', visible: true, order: 3, showName: true, showDate: true }
    ];

    // Storage key for signatures
    const STORAGE_PREFIX = 'product_signatures_';

    /**
     * Initialize signature management
     */
    function init() {
        setupSignatureSection();
        loadSignatures();
        attachEventListeners();
    }

    /**
     * Setup signature configuration section in product modal
     */
    function setupSignatureSection() {
        // Find or create signature container
        let container = document.getElementById('signatures-container');
        if (!container) {
            // Create container if it doesn't exist
            container = document.createElement('div');
            container.id = 'signatures-container';
            container.className = 'signature-config-section';
            
            // Add to product modal if it exists
            const productModal = document.getElementById('product-modal');
            if (productModal) {
                // Prefer the new product-tabs-manager panel id
                const signaturesPanel = document.getElementById('panel-signatures-config');
                const legacyTabContent = productModal.querySelector('.tab-content[data-tab="signatures-config"]');
                if (signaturesPanel) {
                    signaturesPanel.appendChild(container);
                } else if (legacyTabContent) {
                    legacyTabContent.appendChild(container);
                } else {
                    // Try to create tab content if a legacy tab-system exists
                    createSignatureTab();
                    const createdTab = productModal.querySelector('.tab-content[data-tab="signatures-config"]');
                    if (createdTab) {
                        createdTab.appendChild(container);
                    } else {
                        // Fallback: append inside product form if tabs system is not present
                        const productForm = productModal.querySelector('#product-form');
                        if (productForm) {
                            const wrapper = document.createElement('div');
                            wrapper.className = 'mt-4 p-3 bg-white border rounded';
                            const heading = document.createElement('h3');
                            heading.className = 'text-lg font-bold mb-3';
                            heading.innerHTML = '<i class="fas fa-signature mr-2"></i> Signatures Configuration';
                            wrapper.appendChild(heading);
                            wrapper.appendChild(container);
                            productForm.insertBefore(wrapper, productForm.querySelector('.flex.justify-end') || productForm.lastChild);
                        } else {
                            // As a last resort, append to modal content
                            const modalContent = productModal.querySelector('.modal-content') || productModal;
                            modalContent.appendChild(container);
                        }
                    }
                }
            }
        }

        // Build signature UI
        buildSignatureUI(container);
    }

    /**
     * Create signature tab if missing
     */
    function createSignatureTab() {
        const tabSystem = document.querySelector('.tab-system');
        if (!tabSystem) return;

        // Create tab content
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        tabContent.setAttribute('data-tab', 'signatures-config');
        tabContent.style.display = 'none';

        const container = document.createElement('div');
        container.id = 'signatures-container';
        container.className = 'signature-config-section';
        
        tabContent.appendChild(container);
        
        const tabContents = tabSystem.querySelector('.tab-contents');
        if (tabContents) {
            tabContents.appendChild(tabContent);
        }
    }

    /**
     * Build signature configuration UI
     */
    function buildSignatureUI(container) {
        container.innerHTML = `
            <div class="section-header">
                <h3><i class="fas fa-signature"></i> Signature Configuration</h3>
                <button type="button" id="add-signature-btn" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Add Signature
                </button>
            </div>
            <div class="signatures-list" id="signatures-list">
                <!-- Signatures will be added here -->
            </div>
            <div class="signature-preview-section">
                <h4>Preview</h4>
                <div id="signature-preview" class="signature-preview">
                    <!-- Preview will be shown here -->
                </div>
            </div>
        `;

        // Add styles if not already present
        addSignatureStyles();
    }

    /**
     * Add signature management styles
     */
    function addSignatureStyles() {
        if (document.getElementById('signature-management-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'signature-management-styles';
        styles.textContent = `
            .signature-config-section {
                padding: 20px;
            }

            .signature-config-section .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #e5e7eb;
            }

            .signatures-list {
                margin-bottom: 30px;
                min-height: 100px;
            }

            .signature-item {
                display: grid;
                grid-template-columns: 40px 1fr 100px auto;
                gap: 15px;
                align-items: center;
                padding: 12px;
                margin-bottom: 10px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                transition: all 0.3s ease;
            }

            .signature-item:hover {
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }

            .signature-item.dragging {
                opacity: 0.5;
                transform: scale(0.98);
            }

            .signature-drag-handle {
                cursor: move;
                color: #9ca3af;
                font-size: 20px;
                text-align: center;
            }

            .signature-drag-handle:hover {
                color: #6b7280;
            }

            .signature-label-input {
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
            }

            .signature-label-input:focus {
                outline: none;
                border-color: #4f46e5;
                box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
            }

            .signature-visibility {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .visibility-toggle {
                width: 50px;
                height: 24px;
                background: #d1d5db;
                border-radius: 12px;
                position: relative;
                cursor: pointer;
                transition: background 0.3s;
            }

            .visibility-toggle.active {
                background: #10b981;
            }

            .visibility-toggle::after {
                content: '';
                position: absolute;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: white;
                top: 2px;
                left: 2px;
                transition: transform 0.3s;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }

            .visibility-toggle.active::after {
                transform: translateX(26px);
            }

            .signature-actions {
                display: flex;
                gap: 8px;
            }

            .signature-preview {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                padding: 20px;
                background: #f9fafb;
                border: 2px dashed #d1d5db;
                border-radius: 8px;
                min-height: 150px;
            }

            .signature-preview-item {
                text-align: center;
                padding: 10px;
            }

            .signature-line {
                border-bottom: 2px solid #374151;
                height: 40px;
                margin-bottom: 8px;
            }

            .signature-label-text {
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Load signatures from storage or use defaults
     */
    function loadSignatures() {
        const productId = getCurrentProductId();
        const storageKey = STORAGE_PREFIX + productId;
        
        let signatures;
        try {
            const stored = localStorage.getItem(storageKey);
            signatures = stored ? JSON.parse(stored) : [...DEFAULT_SIGNATURES];
        } catch (e) {
            signatures = [...DEFAULT_SIGNATURES];
        }

        renderSignatures(signatures);
    }

    /**
     * Save signatures to storage
     */
    function saveSignatures(signatures) {
        const productId = getCurrentProductId();
        const storageKey = STORAGE_PREFIX + productId;
        
        try {
            localStorage.setItem(storageKey, JSON.stringify(signatures));
            
            // Also save to product data if available
            if (window.productsData && window.selectedProduct) {
                window.selectedProduct.signatures = signatures;
                saveProductsToStorage();
            }
            
            // Notify listeners
            try {
                window.dispatchEvent(new CustomEvent('signatures-updated', { detail: { productId } }));
            } catch(_){ }
            
            showNotification('Signatures saved successfully', 'success');
        } catch (e) {
            console.error('Error saving signatures:', e);
            showNotification('Error saving signatures', 'error');
        }
    }

    /**
     * Render signatures list
     */
    function renderSignatures(signatures) {
        const listContainer = document.getElementById('signatures-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        
        signatures.sort((a, b) => a.order - b.order);
        
        signatures.forEach((sig, index) => {
            const item = createSignatureItem(sig, index);
            listContainer.appendChild(item);
        });

        // Update preview
        updateSignaturePreview(signatures);
        
        // Enable drag and drop
        enableDragAndDrop();
    }

    /**
     * Create a signature item element
     */
    function createSignatureItem(signature, index) {
        const item = document.createElement('div');
        item.className = 'signature-item';
        item.draggable = true;
        item.dataset.signatureId = signature.id;
        item.dataset.order = index;

        item.innerHTML = `
            <div class="signature-drag-handle">
                <i class="fas fa-grip-vertical"></i>
            </div>
            <input type="text" 
                   class="signature-label-input" 
                   value="${signature.label || ''}" 
                   placeholder="Enter signature label..."
                   data-signature-id="${signature.id}">
            <div class="signature-visibility">
                <label>Visible:</label>
                <div class="visibility-toggle ${signature.visible ? 'active' : ''}" 
                     data-signature-id="${signature.id}"></div>
            </div>
            <div class="signature-options" style="display:flex; gap:10px; align-items:center;">
                <label style="display:flex; align-items:center; gap:6px; font-size:12px;">
                    <input type="checkbox" class="sig-name-checkbox" data-signature-id="${signature.id}" ${signature.showName !== false ? 'checked' : ''}>
                    Show Name
                </label>
                <label style="display:flex; align-items:center; gap:6px; font-size:12px;">
                    <input type="checkbox" class="sig-date-checkbox" data-signature-id="${signature.id}" ${signature.showDate !== false ? 'checked' : ''}>
                    Show Date
                </label>
            </div>
            <div class="signature-actions">
                <button type="button" class="btn btn-sm btn-danger remove-signature" 
                        data-signature-id="${signature.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        return item;
    }

    /**
     * Update signature preview
     */
    function updateSignaturePreview(signatures) {
        const preview = document.getElementById('signature-preview');
        if (!preview) return;

        preview.innerHTML = '';
        
        const visibleSigs = signatures.filter(s => s.visible);
        
        if (visibleSigs.length === 0) {
            preview.innerHTML = '<div style="text-align: center; color: #9ca3af;">No visible signatures</div>';
            return;
        }

        visibleSigs.forEach(sig => {
            const previewItem = document.createElement('div');
            previewItem.className = 'signature-preview-item';
            previewItem.innerHTML = `
                <div class="signature-line"></div>
                <div class="signature-label-text">${sig.label || 'Unnamed'}</div>
            `;
            preview.appendChild(previewItem);
        });
    }

    /**
     * Enable drag and drop for signature reordering
     */
    function enableDragAndDrop() {
        let draggedElement = null;

        document.querySelectorAll('.signature-item').forEach(item => {
            item.addEventListener('dragstart', function(e) {
                draggedElement = this;
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', this.innerHTML);
            });

            item.addEventListener('dragend', function() {
                this.classList.remove('dragging');
            });

            item.addEventListener('dragover', function(e) {
                if (e.preventDefault) e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const afterElement = getDragAfterElement(this.parentElement, e.clientY);
                if (afterElement == null) {
                    this.parentElement.appendChild(draggedElement);
                } else {
                    this.parentElement.insertBefore(draggedElement, afterElement);
                }
                
                return false;
            });
        });
    }

    /**
     * Get element to insert dragged item after
     */
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.signature-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Attach event listeners
     */
    function attachEventListeners() {
        // Add signature button
        document.addEventListener('click', function(e) {
            if (e.target.closest('#add-signature-btn')) {
                addNewSignature();
            }
            
            if (e.target.closest('.remove-signature')) {
                const sigId = e.target.closest('.remove-signature').dataset.signatureId;
                removeSignature(sigId);
            }
            
            if (e.target.closest('.visibility-toggle')) {
                const toggle = e.target.closest('.visibility-toggle');
                const sigId = toggle.dataset.signatureId;
                toggleSignatureVisibility(sigId, toggle);
            }
        });

        // Option checkboxes (name/date)
        document.addEventListener('change', function(e){
            if (e.target.classList.contains('sig-name-checkbox') || e.target.classList.contains('sig-date-checkbox')){
                // Save state
                const signatures = getCurrentSignatures();
                updateSignaturePreview(signatures);
                saveSignatures(signatures);
            }
        });

        // Label input changes
        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('signature-label-input')) {
                const sigId = e.target.dataset.signatureId;
                updateSignatureLabel(sigId, e.target.value);
            }
        });
    }

    /**
     * Add new signature
     */
    function addNewSignature() {
        const signatures = getCurrentSignatures();
        const newSig = {
            id: 'sig_' + Date.now(),
            label: 'New Signature',
            visible: true,
            order: signatures.length + 1,
            showName: true,
            showDate: true
        };
        
        signatures.push(newSig);
        renderSignatures(signatures);
        saveSignatures(signatures);
    }

    /**
     * Remove signature
     */
    function removeSignature(sigId) {
        if (!confirm('Are you sure you want to remove this signature?')) return;
        
        const signatures = getCurrentSignatures();
        const index = signatures.findIndex(s => s.id === sigId);
        
        if (index > -1) {
            signatures.splice(index, 1);
            // Reorder remaining signatures
            signatures.forEach((sig, i) => {
                sig.order = i + 1;
            });
            renderSignatures(signatures);
            saveSignatures(signatures);
        }
    }

    /**
     * Toggle signature visibility
     */
    function toggleSignatureVisibility(sigId, toggleElement) {
        const signatures = getCurrentSignatures();
        const signature = signatures.find(s => s.id === sigId);
        
        if (signature) {
            signature.visible = !signature.visible;
            toggleElement.classList.toggle('active');
            updateSignaturePreview(signatures);
            saveSignatures(signatures);
        }
    }

    /**
     * Update signature label
     */
    function updateSignatureLabel(sigId, newLabel) {
        const signatures = getCurrentSignatures();
        const signature = signatures.find(s => s.id === sigId);
        
        if (signature) {
            signature.label = newLabel;
            updateSignaturePreview(signatures);
            // Debounce save
            clearTimeout(window.signatureSaveTimeout);
            window.signatureSaveTimeout = setTimeout(() => {
                saveSignatures(signatures);
            }, 500);
        }
    }

    /**
     * Get current signatures from UI
     */
    function getCurrentSignatures() {
        const signatures = [];
        document.querySelectorAll('.signature-item').forEach((item, index) => {
            const sigId = item.dataset.signatureId;
            const label = item.querySelector('.signature-label-input').value;
            const visible = item.querySelector('.visibility-toggle').classList.contains('active');
            const showName = !!item.querySelector('.sig-name-checkbox')?.checked;
            const showDate = !!item.querySelector('.sig-date-checkbox')?.checked;
            
            signatures.push({
                id: sigId,
                label: label,
                visible: visible,
                order: index + 1,
                showName: showName,
                showDate: showDate
            });
        });
        return signatures;
    }

    /**
     * Get current product ID
     */
    function getCurrentProductId() {
        const productSelect = document.getElementById('product-name');
        return productSelect ? productSelect.value : 'default';
    }

    /**
     * Save products data to storage
     */
    function saveProductsToStorage() {
        if (window.productsData) {
            try {
                localStorage.setItem('productsData', JSON.stringify(window.productsData));
            } catch (e) {
                console.error('Error saving products data:', e);
            }
        }
    }

    /**
     * Show notification
     */
    function showNotification(message, type) {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /**
     * Get product signatures for printing/display
     */
    window.getProductSignatures = function() {
        const productId = getCurrentProductId();
        const storageKey = STORAGE_PREFIX + productId;
        
        try {
            const stored = localStorage.getItem(storageKey);
            const signatures = stored ? JSON.parse(stored) : [...DEFAULT_SIGNATURES];
            return signatures.filter(s => s.visible).sort((a, b) => a.order - b.order);
        } catch (e) {
            return DEFAULT_SIGNATURES.filter(s => s.visible);
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for global access
    window.SignatureManager = {
        init: init,
        loadSignatures: loadSignatures,
        saveSignatures: saveSignatures,
        getSignatures: getProductSignatures
    };

// Ensure we attach to the correct tab panel once ProductTabsManager finishes building
// This handles the case where our init ran before tabs were created
// and moves the signatures UI into the dedicated Signatures tab panel.
document.addEventListener('productTabsReady', function(){
    try {
        const panel = document.getElementById('panel-signatures-config');
        const container = document.getElementById('signatures-container');
        if (panel && container && panel !== container.parentElement) {
            panel.appendChild(container);
        }
    } catch(e) { /* no-op */ }
});

})();