/**
 * Unified Product Management System
 * Integrates all product management functionality
 */

(function() {
    'use strict';

    // Product Management System Configuration
    const ProductManagement = {
        products: [],
        currentProduct: null,
        isInitialized: false,

        // Initialize the system
        init: function() {
            if (this.isInitialized) return;
            
            console.log('Initializing Product Management System...');
            
            // Load products from localStorage
            this.loadProducts();
            
            // Initialize UI elements
            this.initializeUI();
            
            // Set up event listeners
            this.attachEventListeners();
            
            // Initialize related modules
            this.initializeModules();
            
            this.isInitialized = true;
            console.log('Product Management System initialized successfully');
        },

        // Load products from localStorage
        loadProducts: function() {
            try {
                const storedProducts = localStorage.getItem('biscuitQC_products');
                if (storedProducts) {
                    this.products = JSON.parse(storedProducts);
                    console.log(`Loaded ${this.products.length} products from storage`);
                } else {
                    // Initialize with default products if none exist
                    this.initializeDefaultProducts();
                }
            } catch (error) {
                console.error('Error loading products:', error);
                this.products = [];
            }
        },

        // Save products to localStorage
        saveProducts: function() {
            try {
                localStorage.setItem('biscuitQC_products', JSON.stringify(this.products));
                console.log('Products saved to storage');
            } catch (error) {
                console.error('Error saving products:', error);
            }
        },

        // Initialize default products
        initializeDefaultProducts: function() {
            this.products = [
                {
                    id: 'BISC001',
                    name: 'Chocolate Chip Cookies',
                    standardWeight: 150,
                    shelfLife: 6,
                    cartonsPerPallet: 48,
                    packsPerBox: 12,
                    boxesPerCarton: 24,
                    emptyBoxWeight: 50,
                    emptyCartonWeight: 200,
                    aqlLevel: '2.5',
                    batchCodeFormat: 'YYMMDD-{SHIFT}-{LINE}',
                    sections: [],
                    notes: '',
                    documentControl: {
                        issueDate: new Date().toISOString().split('T')[0],
                        reviewDate: new Date().toISOString().split('T')[0],
                        documentCode: 'QC-FM-001',
                        issueNumber: '01',
                        reviewNumber: '00'
                    }
                },
                {
                    id: 'BISC002',
                    name: 'Vanilla Wafers',
                    standardWeight: 120,
                    shelfLife: 8,
                    cartonsPerPallet: 60,
                    packsPerBox: 10,
                    boxesPerCarton: 20,
                    emptyBoxWeight: 40,
                    emptyCartonWeight: 180,
                    aqlLevel: '2.5',
                    batchCodeFormat: 'YYMMDD-{SHIFT}-{LINE}',
                    sections: [],
                    notes: '',
                    documentControl: {
                        issueDate: new Date().toISOString().split('T')[0],
                        reviewDate: new Date().toISOString().split('T')[0],
                        documentCode: 'QC-FM-002',
                        issueNumber: '01',
                        reviewNumber: '00'
                    }
                }
            ];
            this.saveProducts();
        },

        // Initialize UI elements
        initializeUI: function() {
            // Update product dropdown
            this.updateProductDropdown();
            
            // Update products table
            this.updateProductsTable();
            
            // Initialize modal if it exists
            const modal = document.getElementById('product-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        },

        // Update product dropdown
        updateProductDropdown: function() {
            const dropdown = document.getElementById('product-name');
            if (!dropdown) return;
            
            // Clear existing options
            dropdown.innerHTML = '<option value="">Select a Product</option>';
            
            // Add products
            this.products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = product.name;
                dropdown.appendChild(option);
            });
        },

        // Update products table
        updateProductsTable: function() {
            const tableBody = document.getElementById('products-table-body');
            if (!tableBody) return;
            
            // Clear existing rows
            tableBody.innerHTML = '';
            
            // Add product rows
            this.products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.name}</td>
                    <td>${product.standardWeight || '-'}</td>
                    <td>${product.shelfLife || '-'}</td>
                    <td>${product.cartonsPerPallet || '-'}</td>
                    <td>${product.sections ? product.sections.length : 0}</td>
                    <td>${product.batchCodeFormat || '-'}</td>
                    <td>
                        <button class="edit-product-btn bg-blue-500 text-white px-2 py-1 rounded text-xs" data-id="${product.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="delete-product-btn bg-red-500 text-white px-2 py-1 rounded text-xs ml-1" data-id="${product.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        },

        // Attach event listeners
        attachEventListeners: function() {
            const self = this;
            
            // Add Product button
            const addBtn = document.getElementById('add-product-btn');
            if (addBtn) {
                addBtn.addEventListener('click', () => this.showAddProductModal());
            }
            
            // Product dropdown change
            const dropdown = document.getElementById('product-name');
            if (dropdown) {
                dropdown.addEventListener('change', (e) => this.selectProduct(e.target.value));
            }
            
            // Import/Export buttons
            const importBtn = document.getElementById('import-products-btn');
            if (importBtn) {
                importBtn.addEventListener('click', () => this.importProducts());
            }
            
            const exportBtn = document.getElementById('export-products-btn');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.exportProducts());
            }
            
            // Product search
            const searchInput = document.getElementById('product-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.searchProducts(e.target.value));
            }
            
            // Modal close button
            const closeBtn = document.querySelector('#product-modal .close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }
            
            // Cancel button in modal
            const cancelBtn = document.getElementById('cancel-product-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.closeModal());
            }
            
            // Product form submission
            const productForm = document.getElementById('product-form');
            if (productForm) {
                productForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveProductFromForm();
                });
            }
            
            // Delegate event listeners for dynamic buttons
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('edit-product-btn') || 
                    e.target.parentElement?.classList.contains('edit-product-btn')) {
                    const btn = e.target.classList.contains('edit-product-btn') ? 
                                e.target : e.target.parentElement;
                    const productId = btn.getAttribute('data-id');
                    this.showEditProductModal(productId);
                }
                
                if (e.target.classList.contains('delete-product-btn') || 
                    e.target.parentElement?.classList.contains('delete-product-btn')) {
                    const btn = e.target.classList.contains('delete-product-btn') ? 
                                e.target : e.target.parentElement;
                    const productId = btn.getAttribute('data-id');
                    this.deleteProduct(productId);
                }
            });
        },

        // Initialize related modules
        initializeModules: function() {
            // Initialize ProductTabsManager if available
            if (window.ProductTabsManager && typeof window.ProductTabsManager.init === 'function') {
                window.ProductTabsManager.init();
            }
            
            // Initialize SignatureManagement if available
            if (window.SignatureManagement && typeof window.SignatureManagement.init === 'function') {
                window.SignatureManagement.init();
            }
        },

        // Select a product
        selectProduct: function(productId) {
            if (!productId) {
                this.currentProduct = null;
                return;
            }
            
            this.currentProduct = this.products.find(p => p.id === productId);
            if (this.currentProduct) {
                console.log('Selected product:', this.currentProduct.name);
                
                // Update batch number
                this.updateBatchNumber();
                
                // Update document control info
                this.updateDocumentControl();
                
                // Trigger product change event
                this.triggerProductChange();
            }
        },

        // Update batch number
        updateBatchNumber: function() {
            if (!this.currentProduct) return;
            
            const batchInput = document.getElementById('batch-number');
            if (batchInput) {
                const date = new Date();
                const dateStr = date.toISOString().split('T')[0].replace(/-/g, '').slice(2);
                const shift = document.getElementById('shift')?.value || 'A';
                const line = '01'; // Default line number
                
                let batchCode = this.currentProduct.batchCodeFormat || 'YYMMDD-{SHIFT}-{LINE}';
                batchCode = batchCode.replace('YYMMDD', dateStr);
                batchCode = batchCode.replace('{SHIFT}', shift);
                batchCode = batchCode.replace('{LINE}', line);
                
                batchInput.value = batchCode;
            }
        },

        // Update document control information
        updateDocumentControl: function() {
            if (!this.currentProduct || !this.currentProduct.documentControl) return;
            
            const docControl = this.currentProduct.documentControl;
            
            // Update header document control
            const updateElement = (id, value) => {
                const elem = document.getElementById(id);
                if (elem) elem.textContent = value || '-';
            };
            
            updateElement('doc-issue-date', docControl.issueDate);
            updateElement('doc-review-date', docControl.reviewDate);
            updateElement('doc-code', docControl.documentCode);
            updateElement('doc-issue-no', docControl.issueNumber);
            updateElement('doc-review-no', docControl.reviewNumber);
            
            // Update footer
            updateElement('doc-code-footer', docControl.documentCode);
            updateElement('doc-issue-no-footer', docControl.issueNumber);
            updateElement('doc-review-no-footer', docControl.reviewNumber);
        },

        // Trigger product change event
        triggerProductChange: function() {
            const event = new CustomEvent('productChanged', {
                detail: { product: this.currentProduct }
            });
            document.dispatchEvent(event);
        },

        // Show add product modal
        showAddProductModal: function() {
            const modal = document.getElementById('product-modal');
            const modalTitle = document.getElementById('modal-title');
            
            if (modal && modalTitle) {
                modalTitle.textContent = 'Add New Product';
                this.clearProductForm();
                modal.style.display = 'block';
                
                // Initialize tabs if ProductTabsManager is available
                if (window.ProductTabsManager && typeof window.ProductTabsManager.initializeModal === 'function') {
                    window.ProductTabsManager.initializeModal();
                }
            }
        },

        // Show edit product modal
        showEditProductModal: function(productId) {
            const product = this.products.find(p => p.id === productId);
            if (!product) return;
            
            const modal = document.getElementById('product-modal');
            const modalTitle = document.getElementById('modal-title');
            
            if (modal && modalTitle) {
                modalTitle.textContent = 'Edit Product';
                this.loadProductToForm(product);
                modal.style.display = 'block';
                
                // Initialize tabs if ProductTabsManager is available
                if (window.ProductTabsManager && typeof window.ProductTabsManager.initializeModal === 'function') {
                    window.ProductTabsManager.initializeModal(product);
                }
            }
        },

        // Close modal
        closeModal: function() {
            const modal = document.getElementById('product-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        },

        // Clear product form
        clearProductForm: function() {
            const form = document.getElementById('product-form');
            if (form) {
                form.reset();
            }
        },

        // Load product to form
        loadProductToForm: function(product) {
            // This will be handled by ProductTabsManager if available
            if (window.ProductTabsManager && typeof window.ProductTabsManager.loadProduct === 'function') {
                window.ProductTabsManager.loadProduct(product);
            }
        },

        // Save product from form
        saveProductFromForm: function() {
            // This will be handled by ProductTabsManager if available
            if (window.ProductTabsManager && typeof window.ProductTabsManager.saveProduct === 'function') {
                const productData = window.ProductTabsManager.saveProduct();
                if (productData) {
                    this.saveProduct(productData);
                }
            }
        },

        // Save product
        saveProduct: function(productData) {
            const existingIndex = this.products.findIndex(p => p.id === productData.id);
            
            if (existingIndex >= 0) {
                // Update existing product
                this.products[existingIndex] = productData;
                this.showNotification('Product updated successfully', 'success');
            } else {
                // Add new product
                this.products.push(productData);
                this.showNotification('Product added successfully', 'success');
            }
            
            this.saveProducts();
            this.updateProductDropdown();
            this.updateProductsTable();
            this.closeModal();
        },

        // Delete product
        deleteProduct: function(productId) {
            if (!confirm('Are you sure you want to delete this product?')) return;
            
            const index = this.products.findIndex(p => p.id === productId);
            if (index >= 0) {
                this.products.splice(index, 1);
                this.saveProducts();
                this.updateProductDropdown();
                this.updateProductsTable();
                this.showNotification('Product deleted successfully', 'success');
            }
        },

        // Search products
        searchProducts: function(query) {
            const tableBody = document.getElementById('products-table-body');
            if (!tableBody) return;
            
            const rows = tableBody.querySelectorAll('tr');
            const searchTerm = query.toLowerCase();
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        },

        // Import products
        importProducts: function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (Array.isArray(data)) {
                            this.products = data;
                            this.saveProducts();
                            this.updateProductDropdown();
                            this.updateProductsTable();
                            this.showNotification('Products imported successfully', 'success');
                        } else {
                            this.showNotification('Invalid file format', 'error');
                        }
                    } catch (error) {
                        console.error('Import error:', error);
                        this.showNotification('Failed to import products', 'error');
                    }
                };
                reader.readAsText(file);
            });
            
            input.click();
        },

        // Export products
        exportProducts: function() {
            const dataStr = JSON.stringify(this.products, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = 'biscuit-qc-products.json';
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            this.showNotification('Products exported successfully', 'success');
        },

        // Show notification
        showNotification: function(message, type) {
            const notification = document.getElementById('notification');
            if (!notification) return;
            
            notification.textContent = message;
            notification.className = 'notification show ' + type;
            
            setTimeout(() => {
                notification.className = 'notification';
            }, 3000);
        },

        // Public API
        getProducts: function() {
            return this.products;
        },

        getCurrentProduct: function() {
            return this.currentProduct;
        },

        getProductById: function(productId) {
            return this.products.find(p => p.id === productId);
        }
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ProductManagement.init());
    } else {
        ProductManagement.init();
    }

    // Expose to global scope
    window.ProductManagement = ProductManagement;

    console.log('Product management system loaded');
})();