/**
 * AI Table Complete Integration Module
 * Ensures all AI Table features work correctly with the Biscuit QC System
 */

(function() {
    'use strict';

    // Configuration for AI Tables in product sections
    const AI_TABLE_CONFIGS = {
        palletWeight: {
            name: "Pallet Weight Analysis",
            type: "ai",
            borders: true,
            headerRows: [
                [
                    { label: "Carton Details", colspan: 3 },
                    { label: "Weight Measurements", colspan: 3 },
                    { label: "Analysis", colspan: 2 }
                ]
            ],
            rows: 10,
            columns: [
                {
                    key: "cartonNo",
                    label: "Carton #",
                    type: "number",
                    min: 1,
                    step: 1,
                    decimals: 0
                },
                {
                    key: "time",
                    label: "Time",
                    type: "text",
                    placeholder: "HH:MM"
                },
                {
                    key: "location",
                    label: "Location",
                    type: "select",
                    options: ["Top", "Middle", "Bottom"]
                },
                {
                    key: "grossWeight",
                    label: "Gross (kg)",
                    type: "number",
                    min: 0,
                    step: 0.01,
                    decimals: 2
                },
                {
                    key: "tareWeight",
                    label: "Tare (kg)",
                    type: "number",
                    min: 0,
                    step: 0.01,
                    decimals: 2,
                    default: 0.5
                },
                {
                    key: "netWeight",
                    label: "Net (kg)",
                    type: "number",
                    decimals: 2,
                    compute: "cols.grossWeight - cols.tareWeight"
                },
                {
                    key: "variance",
                    label: "Variance %",
                    type: "number",
                    decimals: 2,
                    compute: "((cols.netWeight - 10) / 10) * 100"
                },
                {
                    key: "status",
                    label: "Status",
                    type: "text",
                    compute: "Math.abs(cols.variance) <= 2 ? 'OK' : Math.abs(cols.variance) <= 5 ? 'CHECK' : 'REJECT'",
                    conditional: [
                        {
                            when: "value === 'OK'",
                            addClass: "cf-ok",
                            style: { backgroundColor: "#10b981", color: "white", fontWeight: "bold", textAlign: "center" }
                        },
                        {
                            when: "value === 'CHECK'",
                            addClass: "cf-warning",
                            style: { backgroundColor: "#f59e0b", color: "white", fontWeight: "bold", textAlign: "center" }
                        },
                        {
                            when: "value === 'REJECT'",
                            addClass: "cf-danger",
                            style: { backgroundColor: "#ef4444", color: "white", fontWeight: "bold", textAlign: "center" }
                        }
                    ]
                }
            ]
        },
        qualityParameters: {
            name: "Quality Parameters Check",
            type: "ai",
            borders: true,
            rows: 8,
            columns: [
                {
                    key: "time",
                    label: "Time",
                    type: "text",
                    placeholder: "HH:MM"
                },
                {
                    key: "temperature",
                    label: "Temp (°C)",
                    type: "number",
                    min: 0,
                    max: 300,
                    step: 1,
                    decimals: 0
                },
                {
                    key: "moisture",
                    label: "Moisture %",
                    type: "number",
                    min: 0,
                    max: 100,
                    step: 0.1,
                    decimals: 1
                },
                {
                    key: "thickness",
                    label: "Thickness (mm)",
                    type: "number",
                    min: 0,
                    max: 20,
                    step: 0.1,
                    decimals: 1
                },
                {
                    key: "width",
                    label: "Width (mm)",
                    type: "number",
                    min: 0,
                    max: 100,
                    step: 0.1,
                    decimals: 1
                },
                {
                    key: "length",
                    label: "Length (mm)",
                    type: "number",
                    min: 0,
                    max: 100,
                    step: 0.1,
                    decimals: 1
                },
                {
                    key: "volume",
                    label: "Volume (mm³)",
                    type: "number",
                    decimals: 2,
                    compute: "cols.thickness * cols.width * cols.length"
                },
                {
                    key: "qualityScore",
                    label: "Q-Score",
                    type: "number",
                    decimals: 1,
                    compute: "(100 - Math.abs(cols.moisture - 3) * 10 - Math.abs(cols.temperature - 180) * 0.5)",
                    conditional: [
                        {
                            when: "value >= 90",
                            addClass: "cf-ok",
                            style: { backgroundColor: "#059669", color: "white", fontWeight: "bold" }
                        },
                        {
                            when: "value >= 75 && value < 90",
                            addClass: "cf-warning",
                            style: { backgroundColor: "#d97706", color: "white" }
                        },
                        {
                            when: "value < 75",
                            addClass: "cf-danger",
                            style: { backgroundColor: "#dc2626", color: "white" }
                        }
                    ]
                }
            ]
        }
    };

    // Initialize integration when DOM is ready
    function initialize() {
        console.log('AI Table Integration starting...');
        
        // Ensure AITable is available
        if (!window.AITable) {
            console.error('AITable not found! Waiting...');
            setTimeout(initialize, 500);
            return;
        }

        // Extend AITable with product-specific methods
        window.AITable.renderProductTable = function(configKey, container) {
            const config = AI_TABLE_CONFIGS[configKey];
            if (!config) {
                console.error('AI Table config not found:', configKey);
                return null;
            }
            
            try {
                const table = window.AITable.build(config);
                if (container) {
                    container.innerHTML = '';
                    container.appendChild(table);
                }
                return table;
            } catch (error) {
                console.error('Failed to render AI Table:', error);
                return null;
            }
        };

        // Add method to get all available configs
        window.AITable.getAvailableConfigs = function() {
            return Object.keys(AI_TABLE_CONFIGS).map(key => ({
                key: key,
                name: AI_TABLE_CONFIGS[key].name,
                config: AI_TABLE_CONFIGS[key]
            }));
        };

        // Hook into product section rendering
        hookProductSections();

        // Set up test buttons in settings
        setupTestButtons();

        console.log('AI Table Integration initialized successfully');
    }

    // Hook into product sections to add AI tables
    function hookProductSections() {
        // Listen for custom events
        document.addEventListener('sectionRendered', function(event) {
            const { sectionId, container } = event.detail || {};
            
            // Check if this section should have an AI table
            if (sectionId && sectionId.includes('pallet')) {
                const tableContainer = document.createElement('div');
                tableContainer.className = 'ai-table-container mt-4';
                tableContainer.dataset.aiTableConfig = 'palletWeight';
                container.appendChild(tableContainer);
                
                window.AITable.renderProductTable('palletWeight', tableContainer);
            }
        });

        // Also check for existing containers
        document.querySelectorAll('[data-ai-table-config]').forEach(container => {
            const configKey = container.dataset.aiTableConfig;
            window.AITable.renderProductTable(configKey, container);
        });
    }

    // Set up test buttons in settings
    function setupTestButtons() {
        const settingsContent = document.getElementById('ai-table-settings');
        if (!settingsContent) return;

        // Add quick test buttons
        const testSection = document.createElement('div');
        testSection.className = 'mt-4 p-3 bg-gray-50 border rounded';
        testSection.innerHTML = `
            <h4 class="font-semibold mb-2">Quick Test Tables</h4>
            <div class="flex gap-2 flex-wrap">
                <button class="ai-table-quick-test bg-blue-500 text-white px-3 py-1 rounded text-xs" data-config="palletWeight">
                    Pallet Weight Analysis
                </button>
                <button class="ai-table-quick-test bg-blue-500 text-white px-3 py-1 rounded text-xs" data-config="qualityParameters">
                    Quality Parameters
                </button>
                <button class="ai-table-load-example bg-green-500 text-white px-3 py-1 rounded text-xs">
                    Load Example from File
                </button>
            </div>
            <div id="quick-test-output" class="mt-4"></div>
        `;
        
        settingsContent.appendChild(testSection);

        // Add event listeners
        testSection.querySelectorAll('.ai-table-quick-test').forEach(btn => {
            btn.addEventListener('click', function() {
                const configKey = this.dataset.config;
                const output = document.getElementById('quick-test-output');
                const table = window.AITable.renderProductTable(configKey, output);
                
                if (table) {
                    // Auto-fill with sample data
                    setTimeout(() => fillSampleData(table), 100);
                    
                    if (typeof showNotification === 'function') {
                        showNotification(`${AI_TABLE_CONFIGS[configKey].name} rendered successfully!`, 'success');
                    }
                }
            });
        });

        // Load example button
        const loadExampleBtn = testSection.querySelector('.ai-table-load-example');
        if (loadExampleBtn) {
            loadExampleBtn.addEventListener('click', function() {
                fetch('test-ai-table-config.json')
                    .then(response => response.json())
                    .then(config => {
                        const textarea = document.getElementById('ai-template-input');
                        if (textarea) {
                            textarea.value = JSON.stringify(config, null, 2);
                            if (typeof showNotification === 'function') {
                                showNotification('Example configuration loaded!', 'success');
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Failed to load example:', error);
                        if (typeof showNotification === 'function') {
                            showNotification('Failed to load example configuration', 'error');
                        }
                    });
            });
        }
    }

    // Fill table with sample data for testing
    function fillSampleData(table) {
        if (!table) return;

        const inputs = table.querySelectorAll('input[type="number"], input[type="text"], select');
        inputs.forEach((input, index) => {
            if (input.readOnly) return; // Skip computed fields
            
            if (input.type === 'number') {
                const min = parseFloat(input.min) || 0;
                const max = parseFloat(input.max) || 100;
                const value = min + Math.random() * (max - min);
                const step = parseFloat(input.step) || 1;
                const decimals = step < 1 ? step.toString().split('.')[1].length : 0;
                input.value = value.toFixed(decimals);
            } else if (input.type === 'text' && input.placeholder === 'HH:MM') {
                const hour = 8 + Math.floor(index / 2);
                const minute = (index % 2) * 30;
                input.value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            } else if (input.tagName === 'SELECT') {
                const options = input.options;
                if (options.length > 0) {
                    input.selectedIndex = Math.floor(Math.random() * options.length);
                }
            }
            
            // Trigger input event to update calculations
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Export for debugging
    window.AITableIntegration = {
        configs: AI_TABLE_CONFIGS,
        renderTable: (key, container) => window.AITable?.renderProductTable(key, container),
        fillSampleData: fillSampleData
    };

})();