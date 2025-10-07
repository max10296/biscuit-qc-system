/**
 * نظام استمرارية الجلسة وإدارة الحالة
 * يعالج استمرارية البيانات، التراجع/إعادة الإجراء، والتنقل المحسن
 */

(function() {
    'use strict';

    // الإعدادات
    const CONFIG = {
        STORAGE_KEY: 'biscuitQC_sessionData',
        UNDO_STACK_SIZE: 50,
        AUTOSAVE_INTERVAL: 5000, // 5 ثوان
        DEBOUNCE_DELAY: 150 // تقليل التأخير لتحسين الاستجابة
    };

    // إدارة الحالة
    const StateManager = {
        currentState: {},
        undoStack: [],
        redoStack: [],
        isRestoring: false,
        lastSaveTime: null,
        isDirty: false
    };

    // ====================
    // استمرارية الجلسة
    // ====================

    /**
     * يحفظ حالة النموذج الحالية في التخزين المحلي
     */
    function saveSessionData() {
        try {
            // التقاط الحالة الحالية قبل الحفظ
            captureState('Autosave');

            const formData = collectAllFormData();
            const sessionData = {
                timestamp: Date.now(),
                version: '2.1', // تم تحديث الإصدار لتتبع التغييرات
                productId: document.getElementById('product-name')?.value || '',
                formData: formData,
                customVariables: window.customVariablesMap || {}, // استخدام الخريطة العامة
                scrollPosition: {
                    x: window.scrollX,
                    y: window.scrollY
                }
            };

            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(sessionData));
            StateManager.lastSaveTime = Date.now();
            StateManager.isDirty = false;

            showSaveIndicator('saved');
            
            console.log('تم حفظ بيانات الجلسة بنجاح');
            return true;
        } catch (error) {
            console.error('خطأ في حفظ بيانات الجلسة:', error);
            showSaveIndicator('error');
            return false;
        }
    }

    /**
     * يستعيد بيانات الجلسة من التخزين المحلي
     */
    function restoreSessionData() {
        try {
            const savedData = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (!savedData) return false;

            const sessionData = JSON.parse(savedData);
            
            const dataAge = Date.now() - sessionData.timestamp;
            if (dataAge > 24 * 60 * 60 * 1000) {
                console.log('بيانات الجلسة قديمة جدا، يتم مسحها...');
                localStorage.removeItem(CONFIG.STORAGE_KEY);
                return false;
            }

            StateManager.isRestoring = true;

            const productSelect = document.getElementById('product-name');
            
            if (productSelect && sessionData.productId) {
                productSelect.value = sessionData.productId;
                productSelect.dispatchEvent(new Event('change'));
            }

            setTimeout(() => {
                restoreFormData(sessionData.formData);
                
                if (sessionData.customVariables) {
                    window.customVariablesMap = sessionData.customVariables;
                    const variableRows = document.querySelectorAll('#variables-container .variable-row');
                    if(variableRows.length > 0) {
                        variableRows.forEach(row => {
                            const name = row.querySelector('.variable-name')?.value;
                            if (name && sessionData.customVariables[name]) {
                                row.querySelector('.variable-value').value = sessionData.customVariables[name];
                            }
                        });
                    }
                }

                if (sessionData.scrollPosition) {
                    window.scrollTo(sessionData.scrollPosition.x, sessionData.scrollPosition.y);
                }

                StateManager.isRestoring = false;
                showNotification('تم استعادة الجلسة بنجاح', 'success');
            }, 500);

            return true;
        } catch (error) {
            console.error('خطأ في استعادة بيانات الجلسة:', error);
            StateManager.isRestoring = false;
            return false;
        }
    }

    /**
     * يجمع جميع بيانات النموذج من الصفحة
     */
    function collectAllFormData() {
        const formData = {};

        document.querySelectorAll('input, select, textarea').forEach(element => {
            const id = element.id || element.name;
            if (id && !id.includes('modal')) {
                if (element.type === 'radio') {
                    if (element.checked) {
                        formData[id] = element.value;
                    }
                } else if (element.type === 'checkbox') {
                    formData[id] = element.checked;
                } else if (element.value !== '') {
                    formData[id] = element.value;
                }
            }
        });

        return formData;
    }

    /**
     * يستعيد بيانات النموذج من الحالة المحفوظة
     */
    function restoreFormData(formData) {
        if (!formData) return;

        Object.keys(formData).forEach(key => {
            const value = formData[key];
            const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`);

            if (element) {
                if (element.type === 'radio') {
                    const radioInput = document.querySelector(`input[name="${element.name}"][value="${value}"]`);
                    if (radioInput) {
                        radioInput.checked = true;
                    }
                } else if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
                // Dispatch both input and change events for better compatibility
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // ====================
    // نظام التراجع/إعادة الإجراء
    // ====================

    /**
     * يلتقط الحالة الحالية للتراجع/إعادة الإجراء
     */
    function captureState(description = '') {
        if (StateManager.isRestoring) return;
        
        const newFormData = collectAllFormData();
        const lastState = StateManager.undoStack[StateManager.undoStack.length - 1];

        if (lastState && JSON.stringify(lastState.data) === JSON.stringify(newFormData)) {
            return;
        }

        const state = {
            timestamp: Date.now(),
            description: description,
            data: newFormData,
            scrollPosition: {
                x: window.scrollX,
                y: window.scrollY
            }
        };

        StateManager.undoStack.push(state);
        if (StateManager.undoStack.length > CONFIG.UNDO_STACK_SIZE) {
            StateManager.undoStack.shift();
        }

        StateManager.redoStack = [];
        updateUndoRedoButtons();
    }

    /**
     * يقوم بعملية التراجع
     */
    function undo() {
        if (StateManager.undoStack.length <= 1) return;

        const currentState = StateManager.undoStack.pop();
        StateManager.redoStack.push(currentState);
        
        const previousState = StateManager.undoStack[StateManager.undoStack.length - 1];
        if (!previousState) return;

        StateManager.isRestoring = true;
        setTimeout(() => {
            restoreFormData(previousState.data);
            if (previousState.scrollPosition) {
                window.scrollTo(previousState.scrollPosition.x || 0, previousState.scrollPosition.y || 0);
            }
            StateManager.isRestoring = false;
            updateUndoRedoButtons();
            showNotification('تراجع: ' + (previousState.description || 'إجراء سابق'), 'info');
        }, 10);
    }

    /**
     * يقوم بعملية إعادة الإجراء
     */
    function redo() {
        if (StateManager.redoStack.length === 0) return;

        const nextState = StateManager.redoStack.pop();
        if (!nextState) return;

        StateManager.undoStack.push(nextState);

        StateManager.isRestoring = true;
        setTimeout(() => {
            restoreFormData(nextState.data);
            if (nextState.scrollPosition) {
                window.scrollTo(nextState.scrollPosition.x || 0, nextState.scrollPosition.y || 0);
            }
            StateManager.isRestoring = false;
            updateUndoRedoButtons();
            showNotification('تم تطبيق إعادة الإجراء', 'info');
        }, 10);
    }

    /**
     * يحدّث حالة أزرار التراجع/إعادة الإجراء
     */
    function updateUndoRedoButtons() {
        // Removed button updates - using keyboard shortcuts only
    }

    // ====================
    // أدوات الواجهة
    // ====================

    /**
     * يعرض مؤشر الحفظ
     */
    function showSaveIndicator(status) {
        let indicator = document.getElementById('save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'save-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 10px 20px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            document.body.appendChild(indicator);
        }

        const statusConfig = {
            saving: {
                text: 'يتم الحفظ...',
                icon: '⏳',
                color: '#fff',
                bg: '#3b82f6'
            },
            saved: {
                text: 'تم الحفظ',
                icon: '✓',
                color: '#fff',
                bg: '#10b981'
            },
            error: {
                text: 'فشل الحفظ',
                icon: '✗',
                color: '#fff',
                bg: '#ef4444'
            }
        };

        const config = statusConfig[status] || statusConfig.saved;
        indicator.innerHTML = `<span>${config.icon}</span> ${config.text}`;
        indicator.style.color = config.color;
        indicator.style.backgroundColor = config.bg;
        indicator.style.display = 'flex';

        setTimeout(() => {
            indicator.style.display = 'none';
        }, 3000);
    }

    /**
     * يعرض إشعار
     */
    function showNotification(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10001;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;

        const colors = {
            info: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };

        notification.style.backgroundColor = colors[type] || colors.info;
        notification.style.color = '#fff';
        notification.textContent = message;
        
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * ينشئ عناصر التحكم في التراجع/إعادة الإجراء
     */
    function createUndoRedoControls() {
        // Removed UI buttons - using keyboard shortcuts only
    }

    // ====================
    // التهيئة
    // ====================

    /**
     * يمهد نظام الاستمرارية
     */
    function init() {
        createUndoRedoControls();

        // التقاط حالة أولية لإتاحة التراجع
        captureState('Initial State');

        // استعادة بيانات الجلسة عند التحميل
        setTimeout(() => {
            if (restoreSessionData()) {
                console.log('تم استعادة بيانات الجلسة');
            }
        }, 1000);

        setInterval(() => {
            if (StateManager.isDirty && !StateManager.isRestoring) {
                saveSessionData();
            }
        }, CONFIG.AUTOSAVE_INTERVAL);

        document.addEventListener('input', debounce((e) => {
            if (!StateManager.isRestoring) {
                StateManager.isDirty = true;
                captureState(`تم تغيير ${e.target.name || e.target.id || 'حقل'}`);
            }
        }, CONFIG.DEBOUNCE_DELAY));

        document.addEventListener('change', debounce((e) => {
            if (!StateManager.isRestoring) {
                StateManager.isDirty = true;
                captureState(`تم تغيير ${e.target.name || e.target.id || 'حقل'}`);
            }
        }, CONFIG.DEBOUNCE_DELAY));

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    undo();
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    redo();
                } else if (e.key === 's') {
                    e.preventDefault();
                    saveSessionData();
                }
            }
        });

        window.addEventListener('beforeunload', () => {
            if (StateManager.isDirty) {
                saveSessionData();
            }
        });

        console.log('تم تمهيد نظام استمرارية الجلسة');
    }

    // ====================
    // أدوات مساعدة
    // ====================

    /**
     * وظيفة Debounce للحد من معدل استدعاءات الوظائف
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SessionPersistence = {
        save: saveSessionData,
        restore: restoreSessionData,
        undo: undo,
        redo: redo,
        captureState: captureState,
        clearSession: () => {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            StateManager.undoStack = [];
            StateManager.redoStack = [];
            updateUndoRedoButtons();
        }
    };
})();