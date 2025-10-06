/**
 * Product Database Synchronization Module
 * Handles all product CRUD operations with the database
 */

const ProductSync = {
    apiBase: '/api',
    
    /**
     * Load all products from database
     */
    async loadProducts() {
        try {
            const response = await fetch(`${this.apiBase}/products?limit=1000`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            const products = {};
            
            // Convert database format to frontend format
            for (const product of result.data || []) {
                products[product.product_id] = this.convertFromDatabase(product);
            }
            
            return products;
        } catch (error) {
            console.error('Failed to load products from database:', error);
            throw error;
        }
    },
    
    /**
     * Load single product with full details
     */
    async loadProduct(productId) {
        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return this.convertFromDatabase(result);
        } catch (error) {
            console.error('Failed to load product from database:', error);
            throw error;
        }
    },
    
    /**
     * Save product to database (create or update)
     */
    async saveProduct(productData) {
        try {
            // Determine if this is a new product or update
            const isNew = !productData.db_id;
            const url = isNew 
                ? `${this.apiBase}/products` 
                : `${this.apiBase}/products/${productData.db_id}`;
            
            const method = isNew ? 'POST' : 'PUT';
            
            // Convert frontend format to database format
            const dbData = this.convertToDatabase(productData);
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dbData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            
            // Return the saved product with database ID
            const savedProduct = result.data;
            if (savedProduct && savedProduct.product) {
                return this.convertFromDatabase(savedProduct);
            }
            
            return result.data;
        } catch (error) {
            console.error('Failed to save product to database:', error);
            throw error;
        }
    },
    
    /**
     * Delete product from database
     */
    async deleteProduct(productId) {
        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to delete product from database:', error);
            throw error;
        }
    },
    
    /**
     * Convert database format to frontend format
     */
    convertFromDatabase(dbProduct) {
        // Handle both direct product object and nested configuration
        const product = dbProduct.product || dbProduct;
        
        const frontendProduct = {
            db_id: product.id, // Store database UUID
            id: product.product_id,
            name: product.name,
            code: product.code,
            batchCode: product.batch_code,
            standardWeight: parseFloat(product.standard_weight) || 185.0,
            shelfLife: parseInt(product.shelf_life) || 6,
            cartonsPerPallet: parseInt(product.cartons_per_pallet) || 56,
            packsPerBox: parseInt(product.packs_per_box) || 6,
            boxesPerCarton: parseInt(product.boxes_per_carton) || 14,
            emptyBoxWeight: parseFloat(product.empty_box_weight) || 21.0,
            emptyCartonWeight: parseFloat(product.empty_carton_weight) || 680.0,
            aqlLevel: product.aql_level || '1.5',
            dayFormat: product.day_format || 'DD',
            monthFormat: product.month_format || 'letter',
            docCode: product.doc_code || '',
            issueNo: product.issue_no || '',
            reviewNo: product.review_no || '',
            issueDate: product.issue_date || '',
            reviewDate: product.review_date || '',
            ingredientsType: product.ingredients_type || 'without-cocoa',
            hasCream: product.has_cream || false,
            description: product.description || '',
            notes: product.notes || '',
            isActive: product.is_active !== false,
            customVariables: [],
            sections: {}
        };
        
        // Convert custom variables
        if (dbProduct.customVariables || dbProduct.custom_variables) {
            const vars = dbProduct.customVariables || dbProduct.custom_variables;
            frontendProduct.customVariables = vars.map(v => ({
                name: v.name,
                value: v.value,
                description: v.description
            }));
        }
        
        // Convert sections and parameters
        if (dbProduct.sections) {
            for (const section of dbProduct.sections) {
                const sectionData = section.section || section;
                const sectionId = sectionData.section_id || sectionData.id;
                
                frontendProduct.sections[sectionId] = {
                    name: sectionData.section_name || sectionData.name,
                    icon: 'fas fa-cog',
                    type: sectionData.section_type || 'quality_control',
                    tables: []
                };
                
                // Convert parameters to tables format
                if (section.parameters && section.parameters.length > 0) {
                    const parametersTable = {
                        id: `${sectionId}_params`,
                        name: 'Parameters',
                        type: 'parameters',
                        parameters: []
                    };
                    
                    for (const param of section.parameters) {
                        const paramData = {
                            name: param.parameter_name || param.name,
                            limits: param.limits || '',
                            type: param.parameter_type || param.type || 'text',
                            units: param.units || '',
                            decimals: param.decimals || 0,
                            dualInput: param.dual_input || false,
                            isCalculated: param.is_calculated || false
                        };
                        
                        // Parse validation rules for min/max
                        if (param.validation_rule) {
                            try {
                                const rules = typeof param.validation_rule === 'string' 
                                    ? JSON.parse(param.validation_rule) 
                                    : param.validation_rule;
                                if (rules.min !== undefined) paramData.min = rules.min;
                                if (rules.max !== undefined) paramData.max = rules.max;
                                if (rules.limits) paramData.limits = rules.limits;
                            } catch (e) {
                                console.warn('Failed to parse validation rule:', e);
                            }
                        }
                        
                        // Parse calculation formula
                        if (param.calculation_formula) {
                            try {
                                paramData.calculation = typeof param.calculation_formula === 'string'
                                    ? JSON.parse(param.calculation_formula)
                                    : param.calculation_formula;
                                paramData.calcMode = 'builder';
                            } catch (e) {
                                console.warn('Failed to parse calculation formula:', e);
                            }
                        }
                        
                        parametersTable.parameters.push(paramData);
                    }
                    
                    frontendProduct.sections[sectionId].tables.push(parametersTable);
                }
            }
        }
        
        return frontendProduct;
    },
    
    /**
     * Convert frontend format to database format
     */
    convertToDatabase(frontendProduct) {
        const dbProduct = {
            product_id: frontendProduct.id,
            name: frontendProduct.name,
            code: frontendProduct.code || frontendProduct.id,
            batch_code: frontendProduct.batchCode || '',
            ingredients_type: frontendProduct.ingredientsType || 'without-cocoa',
            has_cream: frontendProduct.hasCream || false,
            standard_weight: frontendProduct.standardWeight || 185.0,
            shelf_life: frontendProduct.shelfLife || 6,
            cartons_per_pallet: frontendProduct.cartonsPerPallet || 56,
            packs_per_box: frontendProduct.packsPerBox || 6,
            boxes_per_carton: frontendProduct.boxesPerCarton || 14,
            empty_box_weight: frontendProduct.emptyBoxWeight || 21.0,
            empty_carton_weight: frontendProduct.emptyCartonWeight || 680.0,
            aql_level: frontendProduct.aqlLevel || '1.5',
            day_format: frontendProduct.dayFormat || 'DD',
            month_format: frontendProduct.monthFormat || 'letter',
            doc_code: frontendProduct.docCode || '',
            issue_no: frontendProduct.issueNo || '',
            review_no: frontendProduct.reviewNo || '',
            issue_date: frontendProduct.issueDate || null,
            review_date: frontendProduct.reviewDate || null,
            description: frontendProduct.description || '',
            notes: frontendProduct.notes || '',
            is_active: frontendProduct.isActive !== false,
            customVariables: frontendProduct.customVariables || [],
            sections: []
        };
        
        // Include database ID if updating
        if (frontendProduct.db_id) {
            dbProduct.id = frontendProduct.db_id;
        }
        
        // Convert sections
        if (frontendProduct.sections) {
            let orderIndex = 0;
            for (const [sectionId, sectionData] of Object.entries(frontendProduct.sections)) {
                const dbSection = {
                    section_id: sectionId,
                    section_name: sectionData.name,
                    section_type: sectionData.type || 'quality_control',
                    order_index: orderIndex++,
                    tables: []
                };
                
                // Convert tables
                if (sectionData.tables) {
                    for (const table of sectionData.tables) {
                        const dbTable = {
                            id: table.id,
                            name: table.name,
                            type: table.type,
                            parameters: []
                        };
                        
                        // Convert parameters
                        if (table.parameters) {
                            for (const param of table.parameters) {
                                const dbParam = {
                                    id: param.id || param.name,
                                    name: param.name,
                                    type: param.type || 'text',
                                    limits: param.limits,
                                    units: param.units,
                                    decimals: param.decimals,
                                    min: param.min,
                                    max: param.max,
                                    dualInput: param.dualInput,
                                    isCalculated: param.isCalculated,
                                    calculation: param.calculation,
                                    calcMode: param.calcMode,
                                    templateId: param.templateId,
                                    templateMapping: param.templateMapping
                                };
                                
                                dbTable.parameters.push(dbParam);
                            }
                        }
                        
                        // Copy other table properties
                        Object.assign(dbTable, {
                            hasAvg: table.hasAvg,
                            hasStd: table.hasStd,
                            hasTare1: table.hasTare1,
                            hasTare2: table.hasTare2,
                            inspectionPeriod: table.inspectionPeriod,
                            sampleRows: table.sampleRows,
                            samplePrefix: table.samplePrefix,
                            hasRejectionCriteria: table.hasRejectionCriteria,
                            customRows: table.customRows,
                            allowAddRows: table.allowAddRows,
                            customColumns: table.customColumns
                        });
                        
                        dbSection.tables.push(dbTable);
                    }
                }
                
                dbProduct.sections.push(dbSection);
            }
        }
        
        return dbProduct;
    },
    
    /**
     * Search products in database
     */
    async searchProducts(searchTerm) {
        try {
            const response = await fetch(`${this.apiBase}/products?search=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            return result.data || [];
        } catch (error) {
            console.error('Failed to search products:', error);
            throw error;
        }
    }
};

// Export for use in main script
window.ProductSync = ProductSync;