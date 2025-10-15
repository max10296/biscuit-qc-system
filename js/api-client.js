/**
 * API Client for Biscuit Quality Control System
 * Handles all API communications with the backend PostgreSQL database
 * Replaces localStorage operations with HTTP API calls
 */

class APIClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async request(method, endpoint, data = null) {
        const url = `${this.baseUrl}/api${endpoint}`;
        const options = {
            method,
            headers: this.headers,
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error(`API Request failed: ${method} ${url}`, error);
            throw error;
        }
    }

    // Products API
    async getProducts() {
        return this.request('GET', '/products');
    }

    async getProduct(id) {
        return this.request('GET', `/products/${id}`);
    }

    async createProduct(product) {
        // Ensure required fields are present and validate data before sending
        const productData = {
            ...product,
            product_id: product.product_id || product.id || '',
            name: product.name || '',
            code: product.code || product.batch_code || '',
            batch_code: product.batch_code || product.code || '',
            ingredients_type: product.ingredients_type ?? 'without-cocoa',
            has_cream: product.has_cream ?? false,
            standard_weight: product.standard_weight !== undefined ? parseFloat(product.standard_weight) : (product.standardWeight !== undefined ? parseFloat(product.standardWeight) : 185.0),
            shelf_life: product.shelf_life !== undefined ? parseInt(product.shelf_life) : (product.shelfLife !== undefined ? parseInt(product.shelfLife) : 6),
            cartons_per_pallet: product.cartons_per_pallet !== undefined ? parseInt(product.cartons_per_pallet) : (product.cartonsPerPallet !== undefined ? parseInt(product.cartonsPerPallet) : 56),
            packs_per_box: product.packs_per_box !== undefined ? parseInt(product.packs_per_box) : (product.packsPerBox !== undefined ? parseInt(product.packsPerBox) : 6),
            boxes_per_carton: product.boxes_per_carton !== undefined ? parseInt(product.boxes_per_carton) : (product.boxesPerCarton !== undefined ? parseInt(product.boxesPerCarton) : 14),
            empty_box_weight: product.empty_box_weight !== undefined ? parseFloat(product.empty_box_weight) : (product.emptyBoxWeight !== undefined ? parseFloat(product.emptyBoxWeight) : 21.0),
            empty_carton_weight: product.empty_carton_weight !== undefined ? parseFloat(product.empty_carton_weight) : (product.emptyCartonWeight !== undefined ? parseFloat(product.emptyCartonWeight) : 680.0),
            aql_level: product.aql_level || product.aqlLevel || '1.5',
            day_format: product.day_format || product.dayFormat || 'DD',
            month_format: product.month_format || product.monthFormat || 'letter',
            description: product.description || '',
            notes: product.notes || '',
            customVariables: product.customVariables || [],
            sections: product.sections || []
        };

        console.log('API Client: Sending product data:', productData);
        return this.request('POST', '/products', productData);
    }

    async updateProduct(id, product) {
        return this.request('PUT', `/products/${id}`, product);
    }

    async deleteProduct(id) {
        return this.request('DELETE', `/products/${id}`);
    }

    // Reports API
    async getReports(filters = {}) {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
                params.append(key, filters[key]);
            }
        });
        const queryString = params.toString();
        const endpoint = queryString ? `/reports?${queryString}` : '/reports';
        return this.request('GET', endpoint);
    }

    async getReport(id) {
        return this.request('GET', `/reports/${id}`);
    }

    async createReport(report) {
        return this.request('POST', '/reports', report);
    }

    async updateReport(id, report) {
        return this.request('PUT', `/reports/${id}`, report);
    }

    async deleteReport(id) {
        return this.request('DELETE', `/reports/${id}`);
    }

    // Settings API
    async getSettings() {
        return this.request('GET', '/settings');
    }

    async getSetting(key) {
        return this.request('GET', `/settings/${key}`);
    }

    async setSetting(key, value) {
        return this.request('POST', '/settings', { key, value });
    }

    async updateSetting(key, value) {
        return this.request('PUT', `/settings/${key}`, { value });
    }

    async deleteSetting(key) {
        return this.request('DELETE', `/settings/${key}`);
    }

    // Sessions API
    async getSessions() {
        return this.request('GET', '/sessions');
    }

    async getSession(id) {
        return this.request('GET', `/sessions/${id}`);
    }

    async createSession(session) {
        return this.request('POST', '/sessions', session);
    }

    async updateSession(id, session) {
        return this.request('PUT', `/sessions/${id}`, session);
    }

    async deleteSession(id) {
        return this.request('DELETE', `/sessions/${id}`);
    }

    // Signatures API
    async getSignatures() {
        return this.request('GET', '/signatures');
    }

    async getSignature(id) {
        return this.request('GET', `/signatures/${id}`);
    }

    async createSignature(signature) {
        return this.request('POST', '/signatures', signature);
    }

    async updateSignature(id, signature) {
        return this.request('PUT', `/signatures/${id}`, signature);
    }

    async deleteSignature(id) {
        return this.request('DELETE', `/signatures/${id}`);
    }

    // Statistics API
    async getStatistics() {
        return this.request('GET', '/statistics');
    }

    // Health check
    async healthCheck() {
        return this.request('GET', '/health');
    }

    // Utility methods for backward compatibility with localStorage patterns
    
    /**
     * Get data with localStorage-like interface for easier migration
     */
    async getLocalData(tableName) {
        switch (tableName) {
            case 'products':
            case 'productsLocal':
                return this.getProducts();
            case 'reports':
            case 'reportsLocal':
                return this.getReports();
            case 'settings':
            case 'settingsLocal':
                return this.getSettings();
            case 'sessions':
            case 'sessionsLocal':
                return this.getSessions();
            case 'signatures':
            case 'signaturesLocal':
                return this.getSignatures();
            default:
                throw new Error(`Unknown table: ${tableName}`);
        }
    }

    /**
     * Save data with localStorage-like interface for easier migration
     */
    async saveLocalData(tableName, data) {
        switch (tableName) {
            case 'products':
            case 'productsLocal':
                if (data.id) {
                    return this.updateProduct(data.id, data);
                } else {
                    return this.createProduct(data);
                }
            case 'reports':
            case 'reportsLocal':
                if (data.id) {
                    return this.updateReport(data.id, data);
                } else {
                    return this.createReport(data);
                }
            case 'settings':
            case 'settingsLocal':
                return this.setSetting(data.key, data.value);
            case 'sessions':
            case 'sessionsLocal':
                if (data.id) {
                    return this.updateSession(data.id, data);
                } else {
                    return this.createSession(data);
                }
            case 'signatures':
            case 'signaturesLocal':
                if (data.id) {
                    return this.updateSignature(data.id, data);
                } else {
                    return this.createSignature(data);
                }
            default:
                throw new Error(`Unknown table: ${tableName}`);
        }
    }
}

// Create global instance
window.apiClient = new APIClient();

// Backward compatibility functions for existing code
window.apiGet = (tableName) => window.apiClient.getLocalData(tableName);
window.apiSave = (tableName, data) => window.apiClient.saveLocalData(tableName, data);
window.apiDelete = async (tableName, id) => {
    switch (tableName) {
        case 'products':
        case 'productsLocal':
            return window.apiClient.deleteProduct(id);
        case 'reports':
        case 'reportsLocal':
            return window.apiClient.deleteReport(id);
        case 'sessions':
        case 'sessionsLocal':
            return window.apiClient.deleteSession(id);
        case 'signatures':
        case 'signaturesLocal':
            return window.apiClient.deleteSignature(id);
        default:
            throw new Error(`Unknown table: ${tableName}`);
    }
};

console.log('API Client initialized successfully');