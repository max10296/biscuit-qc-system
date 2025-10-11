/**
 * Storage Migration Script
 * Handles migration from localStorage to API backend
 */

(function() {
    'use strict';

    // Flag to track migration status
    let migrationCompleted = false;

    // Enhanced product loading with API integration
    window.loadProductsFromAPI = async function() {
        try {
            console.log('Loading products from API...');
            
            // Check if API is available
            const apiAvailable = await window.apiClient.isAPIAvailable();
            console.log('API Available:', apiAvailable);
            
            if (apiAvailable) {
                // Try to load from API first
                const apiProducts = await window.apiClient.getProducts();
                console.log('Products loaded from API:', apiProducts);
                
                if (apiProducts && apiProducts.length > 0) {
                    // Convert API format to the format expected by the frontend
                    const products = {};
                    apiProducts.forEach(product => {
                        products[product.product_id || product.id] = {
                            id: product.product_id || product.id,
                            name: product.name,
                            code: product.code,
                            batch_code: product.batch_code || product.code,
                            ingredients_type: product.ingredients_type,
                            has_cream: product.has_cream,
                            standardWeight: product.standard_weight,
                            shelfLife: product.shelf_life,
                            cartonsPerPallet: product.cartons_per_pallet,
                            packsPerBox: product.packs_per_box,
                            boxesPerCarton: product.boxes_per_carton,
                            emptyBoxWeight: product.empty_box_weight,
                            emptyCartonWeight: product.empty_carton_weight,
                            aqlLevel: product.aql_level,
                            dayFormat: product.day_format,
                            monthFormat: product.month_format,
                            description: product.description,
                            // Add any additional fields from the API response
                            isActive: product.is_active,
                            createdAt: product.created_at,
                            updatedAt: product.updated_at,
                            // Keep original API data for reference
                            _apiData: product
                        };
                    });
                    
                    console.log('Products converted to frontend format:', products);
                    return products;
                } else {
                    console.log('No products found in API, checking localStorage...');
                }
            }
            
            // Fallback to localStorage
            console.log('Using localStorage fallback...');
            return loadProductsFromLocalStorage();
            
        } catch (error) {
            console.error('Error loading products from API:', error);
            console.log('Falling back to localStorage...');
            return loadProductsFromLocalStorage();
        }
    };

    // Enhanced product saving with API integration
    window.saveProductToAPI = async function(productData) {
        try {
            console.log('Saving product to API:', productData);
            
            // Check if API is available
            const apiAvailable = await window.apiClient.isAPIAvailable();
            
            if (apiAvailable) {
                // Convert frontend format to API format
                const apiProductData = {
                    product_id: productData.id,
                    name: productData.name,
                    code: productData.code,
                    batch_code: productData.batch_code || productData.code,
                    ingredients_type: productData.ingredients_type,
                    has_cream: productData.has_cream,
                    standard_weight: productData.standardWeight,
                    shelf_life: productData.shelfLife,
                    cartons_per_pallet: productData.cartonsPerPallet,
                    packs_per_box: productData.packsPerBox,
                    boxes_per_carton: productData.boxesPerCarton,
                    empty_box_weight: productData.emptyBoxWeight,
                    empty_carton_weight: productData.emptyCartonWeight,
                    aql_level: productData.aqlLevel,
                    day_format: productData.dayFormat,
                    month_format: productData.monthFormat,
                    description: productData.description || '',
                    is_active: true
                };
                
                // Determine if this is an update or create
                let result;
                if (productData._apiData && productData._apiData.id) {
                    // Update existing product
                    result = await window.apiClient.updateProduct(productData._apiData.id, apiProductData);
                } else {
                    // Create new product
                    result = await window.apiClient.createProduct(apiProductData);
                }
                
                console.log('Product saved to API successfully:', result);
                
                // Also save to localStorage as backup
                saveProductToLocalStorage(productData);
                
                return result;
            } else {
                console.log('API not available, saving to localStorage only');
                return saveProductToLocalStorage(productData);
            }
            
        } catch (error) {
            console.error('Error saving product to API:', error);
            console.log('Falling back to localStorage...');
            return saveProductToLocalStorage(productData);
        }
    };

    // Load products from localStorage (original function)
    function loadProductsFromLocalStorage() {
        try {
            const savedProducts = localStorage.getItem('productConfigurations');
            const products = savedProducts ? JSON.parse(savedProducts) : null;
            console.log('Products loaded from localStorage:', products);
            
            // Return default products if none found
            if (!products) {
                return getDefaultProducts();
            }
            
            return products;
        } catch (error) {
            console.error('Error loading products from localStorage:', error);
            return getDefaultProducts();
        }
    }

    // Save product to localStorage (original function)
    function saveProductToLocalStorage(productData) {
        try {
            const savedProducts = localStorage.getItem('productConfigurations');
            const products = savedProducts ? JSON.parse(savedProducts) : {};
            
            products[productData.id] = productData;
            localStorage.setItem('productConfigurations', JSON.stringify(products));
            
            console.log('Product saved to localStorage:', productData.id);
            return productData;
        } catch (error) {
            console.error('Error saving product to localStorage:', error);
            throw error;
        }
    }

    // Get default products
    function getDefaultProducts() {
        return {
            'plain-no-cocoa': {
                'id': 'plain-no-cocoa',
                'name': 'Plain Biscuits (No Cocoa)',
                'code': 'BBS',
                'ingredients_type': 'without-cocoa',
                'has_cream': false,
                'standardWeight': 185,
                'shelfLife': 6,
                'cartonsPerPallet': 120,
                'packsPerBox': 12,
                'boxesPerCarton': 6,
                'emptyBoxWeight': 25,
                'emptyCartonWeight': 50,
                'aqlLevel': '1.5',
                'dayFormat': 'DD',
                'monthFormat': 'letter',
                'description': 'Standard plain biscuit without cocoa ingredients',
                'qualityCriteria': [
                    {
                        'id': 'grade-a',
                        'title': 'GRADE A - STANDARD PRODUCT',
                        'icon': 'fas fa-check-circle',
                        'color': 'success'
                    }
                ]
            }
        };
    }

    // Migration function to move data from localStorage to API
    window.migrateToAPI = async function() {
        if (migrationCompleted) {
            console.log('Migration already completed');
            return;
        }
        
        try {
            console.log('Starting migration from localStorage to API...');
            
            // Check if API is available
            const apiAvailable = await window.apiClient.isAPIAvailable();
            if (!apiAvailable) {
                console.log('API not available, skipping migration');
                return;
            }
            
            // Get products from localStorage
            const localProducts = loadProductsFromLocalStorage();
            if (!localProducts || Object.keys(localProducts).length === 0) {
                console.log('No local products to migrate');
                migrationCompleted = true;
                return;
            }
            
            console.log(`Found ${Object.keys(localProducts).length} products to migrate`);
            
            // Migrate each product
            for (const [productId, productData] of Object.entries(localProducts)) {
                try {
                    await saveProductToAPI(productData);
                    console.log(`Migrated product: ${productData.name}`);
                } catch (error) {
                    console.warn(`Failed to migrate product ${productData.name}:`, error);
                }
            }
            
            migrationCompleted = true;
            console.log('Migration completed successfully');
            
            // Show notification to user
            if (typeof showNotification === 'function') {
                showNotification('Products have been synchronized with the database!', 'success', 5000);
            }
            
        } catch (error) {
            console.error('Migration failed:', error);
        }
    };

    // Enhanced initialization that checks API and migrates if needed
    window.initializeProductStorage = async function() {
        try {
            console.log('Initializing product storage...');
            
            // Load products (API first, then localStorage fallback)
            const products = await loadProductsFromAPI();
            
            // If we have localStorage data but API is available, migrate
            const localProducts = loadProductsFromLocalStorage();
            const apiAvailable = await window.apiClient.isAPIAvailable();
            
            if (apiAvailable && localProducts && Object.keys(localProducts).length > 0) {
                // Check if we need to migrate (API has fewer products than localStorage)
                const apiProducts = await window.apiClient.getProducts();
                if (!apiProducts || apiProducts.length < Object.keys(localProducts).length) {
                    console.log('API has fewer products than localStorage, starting migration...');
                    await migrateToAPI();
                }
            }
            
            return products;
            
        } catch (error) {
            console.error('Error initializing product storage:', error);
            return loadProductsFromLocalStorage();
        }
    };

    // Override the global products loading
    window.addEventListener('DOMContentLoaded', function() {
        console.log('Storage migration script loaded');
        
        // Replace the original products loading logic
        if (window.loadProducts) {
            console.log('Overriding original loadProducts function');
            window.originalLoadProducts = window.loadProducts;
            window.loadProducts = window.loadProductsFromAPI;
        }
        
        // Initialize after a short delay to ensure other scripts are loaded
        setTimeout(() => {
            if (typeof window.initializeProductStorage === 'function') {
                window.initializeProductStorage().then(() => {
                    console.log('Product storage initialization completed');
                    
                    // Trigger UI updates if functions exist
                    if (typeof window.renderProductsTable === 'function') {
                        window.renderProductsTable();
                    }
                    if (typeof window.populateProductDropdown === 'function') {
                        window.populateProductDropdown();
                    }
                }).catch(error => {
                    console.error('Product storage initialization failed:', error);
                });
            }
        }, 1000);
    });

    // Add API status indicator
    function addAPIStatusIndicator() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'api-status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            color: white;
            font-weight: bold;
            opacity: 0.9;
            transition: all 0.3s ease;
        `;
        
        // Add to document
        document.body.appendChild(statusDiv);
        
        // Update status
        updateAPIStatus();
        
        // Check status every 30 seconds
        setInterval(updateAPIStatus, 30000);
    }

    async function updateAPIStatus() {
        const statusDiv = document.getElementById('api-status');
        if (!statusDiv) return;
        
        try {
            const isOnline = await window.apiClient.isAPIAvailable();
            if (isOnline) {
                statusDiv.textContent = '🟢 API Connected';
                statusDiv.style.backgroundColor = '#10b981';
            } else {
                statusDiv.textContent = '🔴 API Offline (Using Local Storage)';
                statusDiv.style.backgroundColor = '#ef4444';
            }
        } catch (error) {
            statusDiv.textContent = '🟡 API Status Unknown';
            statusDiv.style.backgroundColor = '#f59e0b';
        }
    }

    // Add status indicator when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addAPIStatusIndicator);
    } else {
        addAPIStatusIndicator();
    }

    console.log('Storage migration script initialized');
})();