/**
 * AI Table Integration Fix
 * This module ensures AI Table calculations work properly in the product tabs
 */

(function() {
    'use strict';

    // Wait for AI Table to be available
    function waitForAITable(callback) {
        if (window.AITable && window.AITable.build) {
            callback();
        } else {
            setTimeout(() => waitForAITable(callback), 100);
        }
    }

    // Initialize AI Table integration
    function initAITableIntegration() {
        console.log('AI Table Integration initialized');

        // Extend AITable with additional utilities
        if (window.AITable && !window.AITable.extended) {
            window.AITable.extended = true;

            // Add more utility functions
            const originalUtil = window.AITable.util || {};
            window.AITable.util = {
                ...originalUtil,
                // Statistical functions
                median: (arr) => {
                    const sorted = arr.slice().sort((a, b) => a - b);
                    const mid = Math.floor(sorted.length / 2);
                    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                },
                variance: (arr) => {
                    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
                    return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
                },
                stddev: (arr) => {
                    return Math.sqrt(window.AITable.util.variance(arr));
                },
                // Percentage calculations
                percentage: (value, total) => (value / total) * 100,
                percentChange: (oldVal, newVal) => ((newVal - oldVal) / oldVal) * 100,
                // Range checks
                inRange: (value, min, max) => value >= min && value <= max,
                outOfRange: (value, min, max) => value < min || value > max,
                // Formatting
                formatNumber: (value, decimals = 2) => {
                    const num = parseFloat(value);
                    return isNaN(num) ? '' : num.toFixed(decimals);
                },
                // Validation
                isValid: (value) => value !== null && value !== undefined && value !== '' && !isNaN(value),
                // Array operations
                count: (arr) => arr.length,
                countValid: (arr) => arr.filter(v => !isNaN(parseFloat(v))).length,
                first: (arr) => arr[0],
                last: (arr) => arr[arr.length - 1]
            };

            // Add a method to create calculation tables
            window.AITable.createCalculationTable = function(config) {
                // Ensure proper defaults
                const defaultConfig = {
                    type: 'ai',
                    borders: true,
                    headerPosition: 'top',
                    inspectionPeriod: 60,
                    rows: config.rows || 10
                };

                // Merge with provided config
                const finalConfig = { ...defaultConfig, ...config };

                // Build and return the table
                return window.AITable.build(finalConfig);
            };
        }

        // Hook into product tabs to inject AI tables
        hookIntoProductTabs();

        // Set up demo/test functionality
        setupTestFunctionality();
    }

    // Hook into product tabs system
    function hookIntoProductTabs() {
        // Listen for product tab render events
        document.addEventListener('productTabRendered', function(event) {
            const { tabId, container } = event.detail || {};
            if (!container) return;

            // Check if this tab should have AI tables
            const aiTableContainers = container.querySelectorAll('[data-ai-table]');
            aiTableContainers.forEach(container => {
                const configId = container.dataset.aiTable;
                const config = getAITableConfig(configId);
                if (config) {
                    renderAITableInContainer(container, config);
                }
            });
        });

        // Also check for existing containers
        document.querySelectorAll('[data-ai-table]').forEach(container => {
            const configId = container.dataset.aiTable;
            const config = getAITableConfig(configId);
            if (config) {
                renderAITableInContainer(container, config);
            }
        });
    }

    // Render AI table in a specific container
    function renderAITableInContainer(container, config) {
        try {
            container.innerHTML = '';
            const table = window.AITable.createCalculationTable(config);
            container.appendChild(table);
            console.log('AI Table rendered successfully:', config.name);
        } catch (error) {
            console.error('Failed to render AI Table:', error);
            container.innerHTML = '<div class="error-message">Failed to render calculation table</div>';
        }
    }

    // Get AI table configuration by ID
    function getAITableConfig(configId) {
        // This would normally load from storage or API
        // For now, return sample configurations
        const configs = {
            'weight-calculation': {
                name: 'Weight Calculation Table',
                type: 'ai',
                headerPosition: 'top',
                inspectionPeriod: 60,
                borders: true,
                headerRows: [
                    [
                        { label: 'Measurements', colspan: 3 },
                        { label: 'Calculations', colspan: 2 }
                    ]
                ],
                rows: 5,
                columns: [
                    {
                        key: 'sample',
                        label: 'Sample',
                        type: 'text',
                        placeholder: 'Sample ID'
                    },
                    {
                        key: 'gross',
                        label: 'Gross Weight',
                        type: 'number',
                        min: 0,
                        step: 0.1,
                        decimals: 1
                    },
                    {
                        key: 'tare',
                        label: 'Tare Weight',
                        type: 'number',
                        min: 0,
                        step: 0.1,
                        decimals: 1
                    },
                    {
                        key: 'net',
                        label: 'Net Weight',
                        type: 'number',
                        decimals: 1,
                        compute: 'cols.gross - cols.tare'
                    },
                    {
                        key: 'deviation',
                        label: 'Deviation %',
                        type: 'number',
                        decimals: 2,
                        compute: '((cols.net - 100) / 100) * 100',
                        conditional: [
                            {
                                when: 'Math.abs(value) > 10',
                                addClass: 'cf-danger'
                            },
                            {
                                when: 'Math.abs(value) <= 5',
                                addClass: 'cf-ok'
                            }
                        ]
                    }
                ]
            },
            'quality-metrics': {
                name: 'Quality Metrics Table',
                type: 'ai',
                rows: 10,
                columns: [
                    {
                        key: 'parameter',
                        label: 'Parameter',
                        type: 'text'
                    },
                    {
                        key: 'value',
                        label: 'Value',
                        type: 'number',
                        decimals: 2
                    },
                    {
                        key: 'min',
                        label: 'Min Spec',
                        type: 'number',
                        decimals: 2
                    },
                    {
                        key: 'max',
                        label: 'Max Spec',
                        type: 'number',
                        decimals: 2
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        type: 'text',
                        compute: 'util.inRange(cols.value, cols.min, cols.max) ? "PASS" : "FAIL"',
                        conditional: [
                            {
                                when: 'value === "PASS"',
                                addClass: 'cf-ok',
                                style: { color: 'green', fontWeight: 'bold' }
                            },
                            {
                                when: 'value === "FAIL"',
                                addClass: 'cf-danger',
                                style: { color: 'red', fontWeight: 'bold' }
                            }
                        ]
                    }
                ]
            }
        };

        return configs[configId] || null;
    }

    // Set up test functionality
    function setupTestFunctionality() {
        // Add test button if in settings tab
        const settingsTab = document.querySelector('#settings-content');
        if (!settingsTab) return;

        const testSection = document.createElement('div');
        testSection.className = 'test-ai-table-section';
        testSection.innerHTML = `
            <div class="section-card" style="margin-top: 20px;">
                <h3 class="section-title">AI Table Test</h3>
                <button id="test-ai-table-btn" class="btn btn-primary">Test AI Table Calculations</button>
                <div id="test-ai-table-output" style="margin-top: 20px;"></div>
            </div>
        `;

        const aiTableSection = settingsTab.querySelector('#ai-table-section');
        if (aiTableSection) {
            aiTableSection.appendChild(testSection);
        } else {
            settingsTab.appendChild(testSection);
        }

        // Add event listener to test button
        const testBtn = document.getElementById('test-ai-table-btn');
        const output = document.getElementById('test-ai-table-output');

        if (testBtn && output) {
            testBtn.addEventListener('click', () => {
                output.innerHTML = '';
                
                // Load test configuration
                fetch('test-ai-table-config.json')
                    .then(response => response.json())
                    .then(config => {
                        const table = window.AITable.createCalculationTable(config);
                        output.appendChild(table);
                        
                        // Add some test data
                        setTimeout(() => {
                            const inputs = table.querySelectorAll('input[data-key="grossWeight"]');
                            const tareInputs = table.querySelectorAll('input[data-key="tareWeight"]');
                            const sampleInputs = table.querySelectorAll('input[data-key="sampleId"]');
                            
                            inputs.forEach((input, index) => {
                                if (sampleInputs[index]) {
                                    sampleInputs[index].value = `Sample-${index + 1}`;
                                }
                                input.value = (100 + Math.random() * 20).toFixed(1);
                                if (tareInputs[index]) {
                                    tareInputs[index].value = (10 + Math.random() * 2).toFixed(1);
                                }
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                            });
                        }, 100);

                        if (typeof showNotification === 'function') {
                            showNotification('AI Table test rendered successfully!', 'success');
                        }
                    })
                    .catch(error => {
                        console.error('Failed to load test config:', error);
                        output.innerHTML = '<div class="error">Failed to load test configuration</div>';
                        
                        // Use inline config as fallback
                        const fallbackConfig = getAITableConfig('weight-calculation');
                        const table = window.AITable.createCalculationTable(fallbackConfig);
                        output.appendChild(table);
                    });
            });
        }
    }

    // Initialize when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            waitForAITable(initAITableIntegration);
        });
    } else {
        waitForAITable(initAITableIntegration);
    }

    // Export for debugging
    window.AITableFix = {
        init: initAITableIntegration,
        renderTable: renderAITableInContainer,
        getConfig: getAITableConfig
    };
})();