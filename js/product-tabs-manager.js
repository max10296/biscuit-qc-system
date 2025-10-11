// ============================================================================
// Product Management Tabs Manager with Drag & Drop Support
// ============================================================================

(function () {
    'use strict';

    // Tab configuration with sections
    const TAB_CONFIG = [
        {
            id: 'basic-info',
            label: 'Basic Information',
            icon: 'fas fa-info-circle',
            order: 0,
            sections: [
                'product-id',
                'product-name-modal',
                'product-standard-weight',
                'product-shelf-life',
                'product-cartons-per-pallet',
                'product-packs-per-box',
                'product-boxes-per-carton',
                'product-empty-box-weight',
                'product-empty-carton-weight',
                'product-aql-level'
            ]
        },
        {
            id: 'document-control',
            label: 'Document Control',
            icon: 'fas fa-id-card',
            order: 1,
            sections: [
                'product-doc-code',
                'product-issue-no',
                'product-review-no',
                'product-issue-date',
                'product-review-date'
            ]
        },
        {
            id: 'batch-config',
            label: 'Batch Configuration',
            icon: 'fas fa-barcode',
            order: 2,
            sections: [
                'product-batch-code',
                'product-day-format',
                'product-month-format',
                'batch-preview'
            ]
        },
        {
            id: 'custom-variables',
            label: 'Custom Variables',
            icon: 'fas fa-code',
            order: 3,
            sections: ['variables-container']
        },
        {
            id: 'ai-table',
            label: 'AI Table',
            icon: 'fas fa-table',
            order: 4,
            sections: ['ai-table-container']
        },
        {
            id: 'form-sections',
            label: 'Form Sections',
            icon: 'fas fa-list-alt',
            order: 5,
            sections: ['sections-container']
        },
        {
            id: 'recipe-config',
            label: 'Recipe Configuration',
            icon: 'fas fa-flask',
            order: 6,
            sections: ['recipe-config-container']
        },
        {
            id: 'quality-criteria',
            label: 'Quality Criteria',
            icon: 'fas fa-check-square',
            order: 7,
            sections: ['quality-criteria-config-container']
        },
        {
            id: 'product-notes',
            label: 'Product Notes',
            icon: 'fas fa-file-alt',
            order: 8,
            sections: ['product-notes']
        },
        {
            id: 'signatures-config',
            label: 'Signatures',
            icon: 'fas fa-signature',
            order: 9,
            sections: ['signatures-container']
        }

    ];

    class ProductTabsManager {
        constructor() {
            this.tabs = [...TAB_CONFIG];
            this.activeTab = 'basic-info';
            this.draggedTab = null;
            this.dropTarget = null;
            this.initialized = false;
        }

        // Collect product data from the modal form and normalize it for API
        collectProductData() {
            const getEl = (id) => document.getElementById(id);
            const getValue = (id) => {
                const el = getEl(id);
                return el ? el.value : '';
            };
            const getTrimmed = (id) => getValue(id).trim();
            const getNumber = (id, fallback) => {
                const raw = getValue(id);
                const num = parseFloat(raw);
                return Number.isFinite(num) ? num : fallback;
            };
            const getInteger = (id, fallback) => {
                const raw = getValue(id);
                const num = parseInt(raw, 10);
                return Number.isFinite(num) ? num : fallback;
            };

            const uuid = getTrimmed('product-uuid');
            const name = getTrimmed('product-name-modal');
            const docCode = getTrimmed('product-doc-code');
            const batchCode = getTrimmed('product-batch-code');
            let productId = getTrimmed('product-id') || uuid;

            if (!productId) {
                const baseSource = name || docCode || batchCode || 'PRD';
                const sanitized = baseSource
                    .toUpperCase()
                    .replace(/[^A-Z0-9]+/g, '')
                    .slice(0, 20);
                productId = sanitized || `PRD${Date.now().toString().slice(-6)}`;
            }

            const code = docCode || batchCode || productId;

            const payload = {
                id: uuid || productId,
                product_id: productId,
                name,
                code,
                batch_code: batchCode || code,
                ingredients_type: 'without-cocoa',
                has_cream: false,
                standard_weight: getNumber('product-standard-weight', 185.0),
                shelf_life: getInteger('product-shelf-life', 6),
                cartons_per_pallet: getInteger('product-cartons-per-pallet', 56),
                packs_per_box: getInteger('product-packs-per-box', 6),
                boxes_per_carton: getInteger('product-boxes-per-carton', 14),
                empty_box_weight: getNumber('product-empty-box-weight', 21.0),
                empty_carton_weight: getNumber('product-empty-carton-weight', 680.0),
                aql_level: getTrimmed('product-aql-level') || '1.5',
                day_format: getTrimmed('product-day-format') || 'DD',
                month_format: getTrimmed('product-month-format') || 'letter',
                description: getTrimmed('product-description'),
                notes: getTrimmed('product-notes'),
                issue_no: getTrimmed('product-issue-no'),
                review_no: getTrimmed('product-review-no'),
                issue_date: getTrimmed('product-issue-date'),
                review_date: getTrimmed('product-review-date'),
                customVariables: this._collectCustomVariables(),
                sections: this._collectSections()
            };

            return payload;
        }

        saveProduct() {
            return this.collectProductData();
        }

        _collectCustomVariables() {
            const out = [];
            const container = document.getElementById('variables-container');
            if (!container) return out;
            const rows = container.querySelectorAll('.variable-row, .variable-item, [data-variable-row]');
            if (rows.length) {
                rows.forEach(row => {
                    const name = row.querySelector('[name="variable-name"], .var-name, [data-var-name]')?.value?.trim();
                    const valueStr = row.querySelector('[name="variable-value"], .var-value, [data-var-value]')?.value;
                    const description = row.querySelector('[name="variable-desc"], .var-desc, [data-var-desc]')?.value?.trim();
                    if (name) {
                        const value = valueStr !== undefined && valueStr !== '' ? parseFloat(valueStr) : null;
                        out.push({ name, value, description });
                    }
                });
                return out;
            }
            const inputs = container.querySelectorAll('input, textarea');
            if (inputs.length >= 2) {
                for (let i = 0; i < inputs.length; i += 2) {
                    const name = inputs[i]?.value?.trim();
                    const value = parseFloat(inputs[i + 1]?.value);
                    if (name) out.push({ name, value: Number.isFinite(value) ? value : null });
                }
            }
            return out;
        }

        _collectSections() {
            const out = [];
            const container = document.querySelector('.child-tabs-content');
            if (!container) return out;
            const panels = container.querySelectorAll('[data-section-id], .section-panel');
            panels.forEach((panel, idx) => {
                const section_id = panel.getAttribute('data-section-id') || `section_${idx + 1}`;
                const section_name = panel.getAttribute('data-section-name') || panel.querySelector('.section-title')?.textContent?.trim() || `Section ${idx + 1}`;
                const section_type = panel.getAttribute('data-section-type') || 'quality_control';
                const order_index = idx;
                const parameters = [];
                const paramRows = panel.querySelectorAll('[data-parameter-id], .parameter-row');
                paramRows.forEach((row, pidx) => {
                    const parameter_id = row.getAttribute('data-parameter-id') || `param_${pidx + 1}`;
                    const parameter_name = row.getAttribute('data-parameter-name') || row.querySelector('.param-name')?.textContent?.trim() || `Parameter ${pidx + 1}`;
                    const parameter_type = row.getAttribute('data-parameter-type') || 'text';
                    const default_value = row.querySelector('input, select, textarea')?.value || '';
                    const order_index_p = pidx;
                    const is_required = !!row.querySelector('[required]');
                    parameters.push({
                        parameter_id,
                        parameter_name,
                        parameter_type,
                        default_value,
                        validation_rule: null,
                        calculation_formula: null,
                        order_index: order_index_p,
                        is_required
                    });
                });
                out.push({ section_id, section_name, section_type, order_index, parameters });
            });
            return out;
        }
        init() {
            if (this.initialized) return;

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupTabs());
            } else {
                this.setupTabs();
            }

            this.initialized = true;
        }

        setupTabs() {
            const modal = document.getElementById('product-modal');
            if (!modal) {
                console.warn('Product modal not found, retrying...');
                setTimeout(() => this.setupTabs(), 500);
                return;
            }

            const form = document.getElementById('product-form');
            if (!form) {
                console.warn('Product form not found');
                return;
            }

            // Create tab structure
            this.createTabStructure(form);

            // Load saved tab order from localStorage
            this.loadTabOrder();

            // Initialize first tab
            this.switchToTab(this.activeTab);

            // Setup event listeners
            this.setupEventListeners();
        }

        createTabStructure(form) {
            // Create tab container
            const tabContainer = document.createElement('div');
            tabContainer.className = 'product-tabs-container';
            tabContainer.innerHTML = `
                <div class="tabs-header">
                    <div class="tabs-navigation" id="product-tabs-nav" role="tablist" aria-label="Product configuration tabs"></div>
                    <div class="tabs-actions">
                        <button type="button" class="tab-action-btn" id="reset-tab-order" title="Reset Tab Order">
                            <i class="fas fa-undo"></i>
                        </button>
                    </div>
                </div>
                <div class="tabs-content" id="product-tabs-content"></div>
            `;

            // Insert at the beginning of form
            form.insertBefore(tabContainer, form.firstChild);

            // Move form sections into tab panels
            this.createTabPanels(form);

            // Render tab buttons
            this.renderTabs();
        }

        createTabPanels(form) {
            const contentContainer = document.getElementById('product-tabs-content');

            this.tabs.forEach(tab => {
                const panel = document.createElement('div');
                panel.className = 'tab-panel';
                panel.id = `panel-${tab.id}`;
                panel.setAttribute('data-tab-label', tab.label);
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', `tab-${tab.id}`);
                panel.style.display = 'none';

                // Move relevant sections to this panel
                const sectionContent = this.extractSectionContent(form, tab);
                panel.innerHTML = sectionContent;

                contentContainer.appendChild(panel);
            });

            // Move submit buttons outside tabs
            const submitSection = form.querySelector('.flex.justify-end');
            if (submitSection) {
                contentContainer.parentElement.appendChild(submitSection);
            }

            // After creating tabs, re-initialize event handlers
            setTimeout(() => this.reinitializeEventHandlers(), 100);
        }

        extractSectionContent(form, tab) {
            let content = '';

            switch (tab.id) {


                case 'basic-info':
                    content = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block font-semibold mb-1">Product ID:</label>
                <input type="text" id="product-id" class="input-field">
            </div>
            <div>
                <label class="block font-semibold mb-1">Product Name:</label>
                <input type="text" id="product-name-modal" class="input-field">
            </div>
            <div>
                <label class="block font-semibold mb-1">Standard Weight (g):</label>
                <input type="number" id="product-standard-weight" class="input-field">
            </div>
            <div>
                <label class="block font-semibold mb-1">Shelf Life (months):</label>
                <input type="number" id="product-shelf-life" class="input-field" min="1">
            </div>
            <div>
                <label class="block font-semibold mb-1">Cartons per Pallet:</label>
                <input type="number" id="product-cartons-per-pallet" class="input-field" min="1">
            </div>
            <div>
                <label class="block font-semibold mb-1">Packs per Box:</label>
                <input type="number" id="product-packs-per-box" class="input-field" min="1">
            </div>
            <div>
                <label class="block font-semibold mb-1">Boxes per Carton:</label>
                <input type="number" id="product-boxes-per-carton" class="input-field" min="1">
            </div>
            <div>
                <label class="block font-semibold mb-1">Empty Box Weight (g):</label>
                <input type="number" id="product-empty-box-weight" class="input-field" min="0" step="0.1">
            </div>
            <div>
                <label class="block font-semibold mb-1">Empty Carton Weight (g):</label>
                <input type="number" id="product-empty-carton-weight" class="input-field" min="0" step="0.1">
            </div>
            <div>
                <label class="block font-semibold mb-1">AQL Level:</label>
                <select id="product-aql-level" class="input-field">
                    <option value="0.10%">0.10%</option>
                    <option value="0.15%">0.15%</option>
                    <option value="0.25%">0.25%</option>
                    <option value="0.40%">0.40%</option>
                    <option value="0.65%">0.65%</option>
                    <option value="1.0%" selected>1.0%</option>
                    <option value="1.5%">1.5%</option>
                    <option value="2.5%">2.5%</option>
                    <option value="4.0%">4.0%</option>
                    <option value="6.5%">6.5%</option>
                    <option value="10.0%">10.0%</option>
                </select>
            </div>
        </div>
    `;
                    break;

                case 'document-control':
                    content = `
                        <div class="p-4 bg-amber-50 border border-amber-200 rounded">
                            <h3 class="font-bold text-amber-800 mb-3"><i class="fas fa-id-card mr-2"></i>Controlled Document Header</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block font-semibold mb-1">Document Code (Form No.)</label>
                                    <input type="text" id="product-doc-code" class="input-field" placeholder="e.g., QA-FM-06 B">
                                </div>
                                <div>
                                    <label class="block font-semibold mb-1">Issue No.</label>
                                    <input type="text" id="product-issue-no" class="input-field" placeholder="e.g., 01">
                                </div>
                                <div>
                                    <label class="block font-semibold mb-1">Review No.</label>
                                    <input type="text" id="product-review-no" class="input-field" placeholder="e.g., 01">
                                </div>
                                <div>
                                    <label class="block font-semibold mb-1">Issue Date</label>
                                    <input type="date" id="product-issue-date" class="input-field">
                                </div>
                                <div>
                                    <label class="block font-semibold mb-1">Review Date</label>
                                    <input type="date" id="product-review-date" class="input-field">
                                </div>
                            </div>
                        </div>
                    `;
                    break;

                case 'batch-config':
                    content = `
                        <div class="p-4 bg-blue-50 border border-blue-200 rounded">
                            <h3 class="font-bold text-blue-800 mb-3">
                                <i class="fas fa-barcode mr-2"></i>Batch Number Configuration
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block font-semibold mb-1">Product Code:</label>
                                    <input type="text" id="product-batch-code" class="input-field" placeholder="e.g., BBS" maxlength="5">
                                    <p class="text-xs text-gray-600 mt-1">3-5 character product identifier</p>
                                </div>
                                <div>
                                    <label class="block font-semibold mb-1">Day Number Format:</label>
                                    <select id="product-day-format" class="input-field">
                                        <option value="DD">DD (01-31)</option>
                                        <option value="D">D (1-31)</option>
                                    </select>
                                    <p class="text-xs text-gray-600 mt-1">Day number format in batch</p>
                                </div>
                                <div>
                                    <label class="block font-semibold mb-1">Month Letter Format:</label>
                                    <select id="product-month-format" class="input-field">
                                        <option value="letter" selected>Single Letter (A-L)</option>
                                        <option value="roman">Roman Numerals (I-XII)</option>
                                    </select>
                                    <p class="text-xs text-gray-600 mt-1">Month representation in batch</p>
                                </div>
                            </div>
                            <div class="mt-3 p-2 bg-white border border-gray-200 rounded">
                                <label class="block font-semibold mb-1">Preview:</label>
                                <div id="batch-preview" class="text-lg font-mono text-blue-600">
                                    <span id="preview-code">---</span><span id="preview-day">--</span><span id="preview-month">-</span>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">Example: BBS09I (Product: BBS, Day: 09, Month: I for September)</p>
                            </div>
                        </div>
                    `;
                    break;

                case 'custom-variables':
                    content = `
                        <div class="p-4 bg-purple-50 border border-purple-200 rounded">
                            <div class="flex justify-between items-center mb-3">
                                <h3 class="font-bold text-purple-800">
                                    <i class="fas fa-code mr-2"></i>متغيرات مخصصة (Custom Variables)
                                </h3>
                                <button type="button" id="add-variable-btn" class="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700">
                                    <i class="fas fa-plus mr-1"></i>إضافة متغير
                                </button>
                            </div>
                            <div id="variables-container" class="space-y-2"></div>
                            <div class="text-xs text-gray-600 mt-2">
                                <i class="fas fa-info-circle mr-1"></i>
                                يمكن استخدام هذه المتغيرات في المعادلات الحسابية للمعلمات
                            </div>
                        </div>
                    `;
                    break;

                case 'form-sections':
                    content = `
        <div class="p-2">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-lg text-gray-800">
                    <i class="fas fa-list-alt mr-2 text-blue-600"></i>Form Sections
                </h3>
                <button type="button" id="add-section-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm transition-transform hover:scale-105">
                    <i class="fas fa-plus mr-2"></i>Add New Section
                </button>
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 mb-4">
                <i class="fas fa-info-circle mr-1"></i>
                Here you can add, remove, and reorder the sections that will appear in the quality control form for this product.
            </div>
            <div class="child-tabs-container">
                <div class="child-tabs-nav border-b border-gray-200 mb-4"></div>
                <div class="child-tabs-content"></div>
            </div>
        </div>
    `;
                    break;

                case 'ai-table':
                    content = `
        <div class="p-2">
          <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold text-lg text-gray-800"><i class="fas fa-table mr-2 text-green-600"></i>AI Table Builder</h3>
            <div class="flex items-center gap-2 text-xs">
              <label class="inline-flex items-center gap-1"><input type="checkbox" id="ai-table-debug-toggle" /> Debug</label>
              <button type="button" id="ai-table-clear" class="bg-gray-200 text-gray-800 px-2 py-1 rounded">Clear</button>
              <button type="button" id="ai-table-export" class="bg-purple-600 text-white px-2 py-1 rounded">Export</button>
              <button type="button" id="import-ai-table" class="bg-blue-600 text-white px-2 py-1 rounded">Import</button>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <textarea id="ai-table-input" class="w-full border p-2 rounded h-56 text-xs" placeholder="Paste AI table JSON here..."></textarea>
              <div class="mt-2 p-2 bg-gray-50 border rounded text-xs">
                Example: {\n  \"name\": \"Quality Department Table\",\n  \"type\": \"ai\",\n  \"headerPosition\": \"top\",\n  \"inspectionPeriod\": 60,\n  \"borders\": true,\n  \"headerRows\":[[{\"label\":\"Process Parameters\",\"colspan\":3},{\"label\":\"Inspection Results\",\"colspan\":3},{\"label\":\"Remarks\",\"rowspan\":2}],[{\"label\":\"Parameter\"},{\"label\":\"Target\"},{\"label\":\"Tolerance\"},{\"label\":\"Measured Value\"},{\"label\":\"Status\"},{\"label\":\"Inspector\"}]],\n  \"sections\":[{\"title\":\"Raw Materials\",\"rows\":3}],\n  \"rows\":10,\n  \"columns\":[{\"key\":\"parameter\",\"label\":\"Parameter\",\"type\":\"text\"},{\"key\":\"target\",\"label\":\"Target\",\"type\":\"number\"},{\"key\":\"tolerance\",\"label\":\"Tolerance ±\",\"type\":\"number\"},{\"key\":\"measured_value\",\"label\":\"Measured Value\",\"type\":\"number\"},{\"key\":\"status\",\"label\":\"Status\",\"type\":\"select\",\"options\":[\"OK\",\"NOT OK\"],\"compute\":\"Math.abs(cols.measured_value - cols.target) <= cols.tolerance ? 'OK' : 'NOT OK'\"},{\"key\":\"inspector\",\"label\":\"Inspector\",\"type\":\"text\"},{\"key\":\"remarks\",\"label\":\"Remarks\",\"type\":\"textarea\"}]\n}
              </div>
            </div>
            <div>
              <div class="p-2 bg-white border rounded mb-2">
                <div class="text-xs font-semibold mb-1">Column Order</div>
                <div id="ai-table-columns-order" class="flex flex-wrap gap-1"></div>
              </div>
              <div id="ai-table-preview" class="p-2 bg-white border rounded overflow-auto"></div>
              <div id="ai-table-debug" class="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs" style="display:none;"></div>
            </div>
          </div>
        </div>
    `;
                    break;


                case 'recipe-config':
                    content = `
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="font-bold">Recipe Configuration</h3>
                                <button type="button" id="add-recipe-btn" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                                    <i class="fas fa-plus mr-1"></i>Add Recipe
                                </button>
                            </div>
                            <div id="recipe-config-container" class="space-y-4"></div>
                        </div>
                    `;
                    break;

                case 'quality-criteria':
                    content = `
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="font-bold">Quality Evaluation Criteria & Standards</h3>
                                <button type="button" id="add-quality-criteria-btn" class="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700">
                                    <i class="fas fa-plus mr-1"></i>Add Criteria
                                </button>
                            </div>
                            <div id="quality-criteria-config-container"></div>
                        </div>
                    `;
                    break;

                case 'product-notes':
                    content = `
                        <div>
                            <h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-file-alt mr-2"></i>Product Notes</h3>
                            <textarea id="product-notes" class="input-field w-full" rows="6"
                                placeholder="Add any relevant notes for this product...\nYou can include:\n- Special instructions\n- Quality specifications\n- Production requirements\n- Important reminders"></textarea>
                            <div class="text-xs text-gray-600 mt-2">
                                <i class="fas fa-info-circle mr-1"></i>
                                Notes will be saved with the product configuration and can be referenced during production
                            </div>
                        </div>
                    `;
                    break;
            }

            return content;
        }

        renderTabs() {
            const nav = document.getElementById('product-tabs-nav');
            if (!nav) return;

            nav.innerHTML = '';

            this.tabs.sort((a, b) => a.order - b.order).forEach(tab => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'tab-button';
                button.id = `tab-${tab.id}`;
                button.draggable = true;
                button.dataset.tabId = tab.id;
                button.setAttribute('role', 'tab');
                button.setAttribute('aria-controls', `panel-${tab.id}`);

                button.innerHTML = `
                    <i class="${tab.icon}"></i>
                    <span class="tab-label">${tab.label}</span>
                    <span class="drag-handle">⋮⋮</span>
                `;

                // Add active class if current tab
                const isActive = tab.id === this.activeTab;
                if (isActive) {
                    button.classList.add('active');
                }
                button.setAttribute('aria-selected', isActive ? 'true' : 'false');

                nav.appendChild(button);
            });
        }

        setupEventListeners() {
            // Tab click events
            document.getElementById('product-tabs-nav')?.addEventListener('click', (e) => {
                const button = e.target.closest('.tab-button');
                if (button) {
                    const tabId = button.dataset.tabId;
                    this.switchToTab(tabId);
                }
            });

            // Reset tab order
            document.getElementById('reset-tab-order')?.addEventListener('click', () => {
                this.resetTabOrder();
            });

            // Drag and drop events
            this.setupDragAndDrop();
        }

        setupDragAndDrop() {
            const nav = document.getElementById('product-tabs-nav');
            if (!nav) return;

            nav.addEventListener('dragstart', (e) => {
                const button = e.target.closest('.tab-button');
                if (button) {
                    this.draggedTab = button.dataset.tabId;
                    button.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/html', button.innerHTML);
                }
            });

            nav.addEventListener('dragover', (e) => {
                e.preventDefault();
                const button = e.target.closest('.tab-button');
                if (button && button.dataset.tabId !== this.draggedTab) {
                    const rect = button.getBoundingClientRect();
                    const midpoint = rect.left + rect.width / 2;

                    // Remove previous drop indicators
                    nav.querySelectorAll('.drop-before, .drop-after').forEach(el => {
                        el.classList.remove('drop-before', 'drop-after');
                    });

                    if (e.clientX < midpoint) {
                        button.classList.add('drop-before');
                    } else {
                        button.classList.add('drop-after');
                    }

                    this.dropTarget = button.dataset.tabId;
                }
            });

            nav.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.draggedTab && this.dropTarget) {
                    this.reorderTabs(this.draggedTab, this.dropTarget, e);
                }
                this.cleanupDragState();
            });

            nav.addEventListener('dragend', () => {
                this.cleanupDragState();
            });
        }

        reorderTabs(draggedId, targetId, event) {
            const draggedIndex = this.tabs.findIndex(t => t.id === draggedId);
            const targetIndex = this.tabs.findIndex(t => t.id === targetId);

            if (draggedIndex === -1 || targetIndex === -1) return;

            const targetButton = document.querySelector(`[data-tab-id="${targetId}"]`);
            const rect = targetButton.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            const insertBefore = event.clientX < midpoint;

            // Remove dragged tab
            const [draggedTab] = this.tabs.splice(draggedIndex, 1);

            // Calculate new index
            let newIndex = targetIndex;
            if (draggedIndex < targetIndex && insertBefore) {
                newIndex--;
            } else if (draggedIndex > targetIndex && !insertBefore) {
                newIndex++;
            }

            // Insert at new position
            this.tabs.splice(newIndex, 0, draggedTab);

            // Update order values
            this.tabs.forEach((tab, index) => {
                tab.order = index;
            });

            // Re-render tabs
            this.renderTabs();

            // Save new order
            this.saveTabOrder();
        }

        cleanupDragState() {
            document.querySelectorAll('.dragging, .drop-before, .drop-after').forEach(el => {
                el.classList.remove('dragging', 'drop-before', 'drop-after');
            });
            this.draggedTab = null;
            this.dropTarget = null;
        }

        switchToTab(tabId) {
            // Update active tab
            this.activeTab = tabId;

            // Update button states
            document.querySelectorAll('.tab-button').forEach(button => {
                const isActive = button.dataset.tabId === tabId;
                if (isActive) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
                button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            // Update panel visibility
            document.querySelectorAll('.tab-panel').forEach(panel => {
                if (panel.id === `panel-${tabId}`) {
                    panel.style.display = 'block';
                } else {
                    panel.style.display = 'none';
                }
            });

            // Save active tab
            localStorage.setItem('productActiveTab', tabId);
        }

        saveTabOrder() {
            const order = this.tabs.map(t => ({ id: t.id, order: t.order }));
            localStorage.setItem('productTabOrder', JSON.stringify(order));
        }

        loadTabOrder() {
            const saved = localStorage.getItem('productTabOrder');
            const savedActive = localStorage.getItem('productActiveTab');

            if (saved) {
                try {
                    const order = JSON.parse(saved);
                    order.forEach(item => {
                        const tab = this.tabs.find(t => t.id === item.id);
                        if (tab) {
                            tab.order = item.order;
                        }
                    });
                } catch (e) {
                    console.error('Failed to load tab order:', e);
                }
            }

            if (savedActive && this.tabs.find(t => t.id === savedActive)) {
                this.activeTab = savedActive;
            }
        }

        resetTabOrder() {
            // Reset to original order
            this.tabs = [...TAB_CONFIG];
            this.renderTabs();
            this.saveTabOrder();

            // Show confirmation
            this.showToast('Tab order reset to default');
        }

        showToast(message) {
            const toast = document.createElement('div');
            toast.className = 'tab-toast';
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('show');
            }, 10);

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        reinitializeEventHandlers() {
            // Re-trigger initialization of existing event handlers
            // This ensures compatibility with existing script.js functionality

            // Trigger custom event to notify that tabs are ready
            const event = new CustomEvent('productTabsReady', {
                detail: { manager: this }
            });
            document.dispatchEvent(event);

            // Re-initialize specific handlers if they exist
            if (typeof window.initProductHandlers === 'function') {
                window.initProductHandlers();
            }

            // Re-initialize batch preview handlers
            const batchCode = document.getElementById('product-batch-code');
            const dayFormat = document.getElementById('product-day-format');
            const monthFormat = document.getElementById('product-month-format');

            if (batchCode && dayFormat && monthFormat) {
                const updateBatchPreview = () => {
                    const code = batchCode.value || '---';
                    const day = dayFormat.value === 'DD' ? '09' : '9';
                    const month = monthFormat.value === 'letter' ? 'I' : 'IX';

                    const previewCode = document.getElementById('preview-code');
                    const previewDay = document.getElementById('preview-day');
                    const previewMonth = document.getElementById('preview-month');

                    if (previewCode) previewCode.textContent = code;
                    if (previewDay) previewDay.textContent = day;
                    if (previewMonth) previewMonth.textContent = month;
                };

                batchCode.addEventListener('input', updateBatchPreview);
                dayFormat.addEventListener('change', updateBatchPreview);
                monthFormat.addEventListener('change', updateBatchPreview);

                // Initial update
                updateBatchPreview();
            }

            // Re-initialize add variable button
            const addVariableBtn = document.getElementById('add-variable-btn');
            if (addVariableBtn && !addVariableBtn.hasAttribute('data-initialized')) {
                addVariableBtn.setAttribute('data-initialized', 'true');
                addVariableBtn.addEventListener('click', () => {
                    if (typeof window.addCustomVariable === 'function') {
                        window.addCustomVariable();
                    }
                });
            }

            // Initialize AI Table builder handlers
            this.initAiTableHandlers();

            // Re-initialize add section button
            const addSectionBtn = document.getElementById('add-section-btn');
            if (addSectionBtn && !addSectionBtn.hasAttribute('data-initialized')) {
                addSectionBtn.setAttribute('data-initialized', 'true');
                addSectionBtn.addEventListener('click', () => {
                    try {
                        // Use legacy addSection in js/script.js if available (requires sectionsContainer)
                        if (typeof window.addSection === 'function') {
                            window.addSection();
                            return;
                        }
                        // Fallback: create a minimal section panel inside child tabs
                        const container = document.querySelector('.child-tabs-content');
                        if (!container) return;
                        const panel = document.createElement('div');
                        panel.className = 'section-panel';
                        panel.setAttribute('data-section-id', `section-${Date.now()}`);
                        panel.innerHTML = `<div class="section-title font-semibold mb-2">New Section</div>`;
                        container.appendChild(panel);
                    } catch (e) { console.warn('Failed to add section:', e); }
                });
            }

            // Re-initialize add recipe button
            const addRecipeBtn = document.getElementById('add-recipe-btn');
            if (addRecipeBtn && !addRecipeBtn.hasAttribute('data-initialized')) {
                addRecipeBtn.setAttribute('data-initialized', 'true');
                addRecipeBtn.addEventListener('click', () => {
                    if (typeof window.addRecipeConfig === 'function') {
                        window.addRecipeConfig();
                    }
                });
            }

            // Re-initialize add quality criteria button
            const addQualityBtn = document.getElementById('add-quality-criteria-btn');
            if (addQualityBtn && !addQualityBtn.hasAttribute('data-initialized')) {
                addQualityBtn.setAttribute('data-initialized', 'true');
                addQualityBtn.addEventListener('click', () => {
                    if (typeof window.addQualityCriteria === 'function') {
                        window.addQualityCriteria();
                    }
                });
            }
        }

        initAiTableHandlers(){
            const input = document.getElementById('ai-table-input');
            const preview = document.getElementById('ai-table-preview');
            const debug = document.getElementById('ai-table-debug');
            const debugToggle = document.getElementById('ai-table-debug-toggle');
            const importBtn = document.getElementById('import-ai-table');
            const exportBtn = document.getElementById('ai-table-export');
            const clearBtn = document.getElementById('ai-table-clear');
            const orderEl = document.getElementById('ai-table-columns-order');
            if (!input || !preview) return;

            const setDebug = (msg)=>{ if (debug){ debug.innerText = typeof msg==='string'? msg : JSON.stringify(msg,null,2); } };
            const showDebug = (v)=>{ if (debug) debug.style.display = v?'block':'none'; };
            if (debugToggle){ debugToggle.addEventListener('change', e=> showDebug(e.target.checked)); }

            function tryParse(text){
                const t = String(text||'').trim();
                if (!t) throw new Error('Empty AI table input');
                try{ return JSON.parse(t); }catch(jsonErr){
                    try{
                        const fixed = t.replace(/[“”]/g,'"').replace(/[‘’]/g,"'");
                        const wrapped = fixed.startsWith('{')||fixed.startsWith('(') ? fixed : '('+fixed+')';
                        return new Function('return '+wrapped)();
                    }catch(jsErr){
                        throw new Error('Invalid JSON/JS. JSON: '+jsonErr.message+' | JS: '+jsErr.message);
                    }
                }
            }

            function normalizeAiTable(cfg){
                const out = { ...cfg };
                out.name = String(out.name||'AI Table').trim();
                out.type = 'ai';
                out.headerPosition = out.headerPosition==='bottom'?'bottom':'top';
                out.borders = Boolean(out.borders);
                out.inspectionPeriod = Number.isFinite(+out.inspectionPeriod)? +out.inspectionPeriod : 60;
                out.rows = Number.isFinite(+out.rows)? +out.rows : 0;
                // columns
                out.columns = Array.isArray(out.columns)? out.columns.map((c,i)=>({
                    key: String(c.key||'col'+(i+1)).trim().toLowerCase().replace(/[^a-z0-9_]+/g,'_'),
                    label: c.label||('Column '+(i+1)),
                    type: c.type||'text',
                    options: c.options||[],
                    required: Boolean(c.required),
                    placeholder: c.placeholder||'',
                    pattern: c.pattern||'',
                    min: c.min!=null ? +c.min : undefined,
                    max: c.max!=null ? +c.max : undefined,
                    step: c.step!=null ? +c.step : undefined,
                    decimals: c.decimals!=null ? +c.decimals : undefined,
                    timeSeries: Boolean(c.timeSeries),
                    compute: c.compute, // string allowed
                    conditional: Array.isArray(c.conditional)? c.conditional : []
                })) : [];
                // header rows
                out.headerRows = Array.isArray(out.headerRows)? out.headerRows : [];
                out.sections = Array.isArray(out.sections)? out.sections : [];
                return out;
            }

            function renderColumnsOrder(cfg){
                if (!orderEl) return;
                orderEl.innerHTML = '';
                cfg.columns.forEach(col=>{
                    const b = document.createElement('span');
                    b.className = 'px-2 py-1 border rounded bg-gray-50';
                    b.textContent = col.label;
                    orderEl.appendChild(b);
                });
            }

            function renderTable(cfg){
                try{
                    preview.innerHTML = '';
                    const table = document.createElement('table');
                    table.className = 'w-full text-xs border-collapse';
                    if (cfg.borders) table.style.border = '1px solid #e5e7eb';

                    const thead = document.createElement('thead');
                    // headerRows (multi-row, with colspan/rowspan)
                    (cfg.headerRows||[]).forEach(row=>{
                        const tr = document.createElement('tr');
                        row.forEach(cell=>{
                            const th = document.createElement('th');
                            th.textContent = cell.label || '';
                            if (cfg.borders) th.style.border = '1px solid #e5e7eb';
                            th.style.padding = '6px 8px';
                            if (cell.colspan) th.colSpan = cell.colspan;
                            if (cell.rowspan) th.rowSpan = cell.rowspan;
                            tr.appendChild(th);
                        });
                        thead.appendChild(tr);
                    });
                    if (!cfg.headerRows?.length){
                        const tr = document.createElement('tr');
                        cfg.columns.forEach(c=>{
                            const th = document.createElement('th');
                            th.textContent = c.label;
                            if (cfg.borders) th.style.border = '1px solid #e5e7eb';
                            th.style.padding = '6px 8px';
                            tr.appendChild(th);
                        });
                        thead.appendChild(tr);
                    }

                    // Prepare compilers and conditions
                    const util = {
                        clamp:(x,min,max)=> Math.max(min, Math.min(max, x)),
                        round:(x,dec=3)=> Math.round((+x + Number.EPSILON) * Math.pow(10,dec))/Math.pow(10,dec),
                        sum: arr => arr.reduce((a,b)=>a+(+b||0),0),
                        mean: arr => arr.length ? arr.reduce((a,b)=>a+(+b||0),0)/arr.length : 0,
                        stddev: arr => { const m = util.mean(arr); const v = arr.length ? util.mean(arr.map(x=>Math.pow((+x||0)-m,2))) : 0; return Math.sqrt(v); }
                    };
                    const compilers = {};
                    cfg.columns.forEach(c=>{
                        if (c.compute && typeof c.compute === 'string'){
                            try { compilers[c.key] = new Function('cols','row','util', 'return ('+c.compute+');'); } catch(e){ compilers[c.key] = null; }
                        }
                        if (Array.isArray(c.conditional)){
                            c.__conds = c.conditional.map(cond=>{
                                let fn = null;
                                try { fn = new Function('value','cols','row','util','return ('+cond.when+');'); } catch(e){ fn = null; }
                                return { fn, addClass: cond.addClass, style: cond.style };
                            });
                        } else { c.__conds = []; }
                    });

                    const tbody = document.createElement('tbody');
                    const totalRows = cfg.rows || cfg.sections?.reduce((acc,s)=> acc + (+s.rows||0), 0) || 0;
                    for (let r=0;r<totalRows;r++){
                        const tr = document.createElement('tr');
                        tr.dataset.rowIndex = String(r);
                        cfg.columns.forEach(c=>{
                            const td = document.createElement('td');
                            td.style.padding = '6px 8px';
                            if (cfg.borders) td.style.border = '1px solid #e5e7eb';
                            const input = buildInput(c);
                            input.dataset.key = c.key;
                            if (c.compute){
                                input.readOnly = true;
                                input.classList.add('computed-cell');
                                input.style.backgroundColor = '#e0f2fe';
                            }
                            td.appendChild(input);
                            tr.appendChild(td);
                        });
                        // Row-wide input listener to recompute
                        tr.addEventListener('input', ()=> evaluateRow(tr));
                        // Initial compute
                        evaluateRow(tr);
                        tbody.appendChild(tr);
                    }

                    function evaluateRow(tr){
                        const inputs = tr.querySelectorAll('input, select, textarea');
                        const cols = {};
                        inputs.forEach(inp=>{
                            const key = inp.dataset.key; if (!key) return;
                            let val = (inp.tagName==='SELECT')? inp.value : inp.value;
                            const num = parseFloat(val);
                            cols[key] = isNaN(num) ? val : num;
                        });
                        cfg.columns.forEach(c=>{
                            if (!c.compute || !compilers[c.key]) return;
                            try{
                                const fn = compilers[c.key];
                                const out = fn(cols, tr, util);
                                const target = tr.querySelector(`[data-key="${c.key}"]`);
                                if (!target) return;
                                if (target.tagName==='SELECT'){
                                    target.value = String(out);
                                } else if (target.tagName==='TEXTAREA'){
                                    target.value = String(out);
                                } else {
                                    target.value = String(out);
                                }
                                // Apply conditionals
                                if (c.__conds && c.__conds.length){
                                    c.__conds.forEach(rule=>{
                                        if (!rule.fn) return;
                                        let passed = false;
                                        try { passed = !!rule.fn(out, cols, tr, util); } catch(e){ passed = false; }
                                        if (passed){
                                            if (rule.addClass) target.classList.add(...String(rule.addClass).split(/\s+/));
                                            if (rule.style && typeof rule.style==='object'){
                                                Object.keys(rule.style).forEach(prop=>{ target.style[prop] = rule.style[prop]; });
                                            }
                                        } else {
                                            if (rule.addClass) target.classList.remove(...String(rule.addClass).split(/\s+/));
                                        }
                                    });
                                }
                            }catch(e){ /* swallow row compute errors to keep UI responsive */ }
                        });
                        if (debug && debug.style.display !== 'none'){
                            debug.textContent = 'Row '+tr.dataset.rowIndex+': '+JSON.stringify(cols);
                        }
                    }

                    table.appendChild(thead);
                    table.appendChild(tbody);
                    preview.appendChild(table);
                    setDebug({normalized: cfg});
                    renderColumnsOrder(cfg);
                }catch(e){
                    setDebug('Render error: '+e.message);
                }
            }

            function buildInput(c){
                let el;
                switch((c.type||'text')){
                    case 'number':
                        el = document.createElement('input');
                        el.type = 'number';
                        if (c.min!=null) el.min = c.min;
                        if (c.max!=null) el.max = c.max;
                        if (c.step!=null) el.step = c.step;
                        el.className = 'border rounded px-2 py-1 w-full';
                        break;
                    case 'select':
                        el = document.createElement('select');
                        (c.options||[]).forEach(opt=>{
                            const o = document.createElement('option');
                            o.value = String(opt);
                            o.textContent = String(opt);
                            el.appendChild(o);
                        });
                        el.className = 'border rounded px-2 py-1 w-full';
                        break;
                    case 'textarea':
                        el = document.createElement('textarea');
                        el.rows = 2; el.className = 'border rounded px-2 py-1 w-full';
                        break;
                    default:
                        el = document.createElement('input');
                        el.type = 'text';
                        el.className = 'border rounded px-2 py-1 w-full';
                }
                if (c.placeholder) el.placeholder = c.placeholder;
                if (c.required) el.required = true;
                if (c.pattern) el.pattern = c.pattern;
                return el;
            }

            importBtn?.addEventListener('click', ()=>{
                try{
                    const cfg = normalizeAiTable(tryParse(input.value));
                    renderTable(cfg);
                }catch(e){ setDebug('Import error: '+e.message); showDebug(true); }
            });

            exportBtn?.addEventListener('click', ()=>{
                try{
                    const cfg = normalizeAiTable(tryParse(input.value));
                    const json = JSON.stringify(cfg, null, 2);
                    navigator.clipboard?.writeText(json);
                    setDebug('Exported normalized JSON to clipboard');
                }catch(e){ setDebug('Export error: '+e.message); showDebug(true); }
            });

            clearBtn?.addEventListener('click', ()=>{
                input.value='';
                preview.innerHTML='';
                orderEl && (orderEl.innerHTML='');
                setDebug('Cleared');
            });
        }
    }

    // Initialize when ready
    window.productTabsManager = new ProductTabsManager();
    window.ProductTabsManager = window.productTabsManager;

    // Auto-init on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.productTabsManager.init();
        });
    } else {
        window.productTabsManager.init();
    }

})();