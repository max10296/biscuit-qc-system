/**
 * Enhanced Time-Based Navigation and Column Highlighting System
 * * Features:
 * - Synchronized column shading between headers and body cells
 * - Auto-scroll to active time column
 * - Visual indicators for current inspection time
 * - Real-time updates every minute
 * - Responsive to shift duration and start time changes
 * - Support for multiple tables on the same page
 */

(function(){
  'use strict';

  // Configuration
  const CONFIG = {
    CLASS_ACTIVE: 'time-slot-active',
    CLASS_UPCOMING: 'time-slot-upcoming',
    CLASS_PAST: 'time-slot-past',
    CLASS_LOCKED: 'time-slot-locked',
    CLASS_COMPLETE: 'time-slot-complete',
    CLASS_INCOMPLETE: 'time-slot-incomplete',
    TIME_REGEX: /^([01]?\d|2[0-3]):[0-5]\d$/,
    LOCK_STORAGE_KEY: 'qc_inspection_lock_window',
    UPDATE_INTERVAL: 60000, // Update every minute
    SCROLL_DELAY: 300, // Delay before auto-scrolling
    AUTO_SCROLL: true, // Enable auto-scroll to active column
    PAST_THRESHOLD: 30, // Minutes past a time slot to consider it "past"
    DEBUG: false // Set to true for debugging
  };

  const REQUIRED_DATA_KEYS = ['required', 'mandatory', 'critical', 'mustFill', 'must-fill', 'requiredField', 'isRequired'];
  const OPTIONAL_DATA_KEYS = ['optional', 'notRequired', 'isOptional'];
  const REQUIRED_CLASS_NAMES = ['required', 'required-field', 'field-required', 'is-required', 'mandatory', 'must-fill'];
  const OPTIONAL_CLASS_NAMES = ['optional', 'field-optional', 'is-optional'];
  const PLACEHOLDER_TEXT_PATTERN = /^(?:-|--|—|n\/a|n\.a\.|na|pending|tbd|none)$/i;
  const PLACEHOLDER_VALUE_PATTERN = /^(?:select|choose|choose option|pending|n\/a|na|--|-|tbd|none)$/i;

  function normalizeFlagValue(value){
    if (value === undefined || value === null) return null;
    const str = String(value).trim();
    if (str === '') return true;
    const normalized = str.toLowerCase();
    if (['true', '1', 'yes', 'y', 'required', 'mandatory'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'optional'].includes(normalized)) return false;
    return null;
  }
  function findCurrentInspectionIndex(times, nowMinutes) {
    if (!times || times.length === 0) {
      return -1;
    }

    const timeInMinutes = times.map(parseTimeToMinutes).filter(t => t !== null);
    if (timeInMinutes.length === 0) {
      return -1;
    }

    let latestPastIndex = -1;
    let minDiff = Infinity;

    // Find the most recent past time slot, considering wrap-around midnight
    for (let i = 0; i < timeInMinutes.length; i++) {
        const time = timeInMinutes[i];
        let diff = nowMinutes - time;
        if (diff < 0) {
            diff += 1440; // It's from the previous day
        }
        if (diff < minDiff) {
            minDiff = diff;
            latestPastIndex = i;
        }
    }

    return latestPastIndex;
  }

  function hasDataFlag(node, keys){
    if (!node || !keys) return null;
    for (const key of keys){
      if (node.dataset && Object.prototype.hasOwnProperty.call(node.dataset, key)){
        const result = normalizeFlagValue(node.dataset[key]);
        if (result !== null) return result;
      }
      if (node.hasAttribute && node.hasAttribute(`data-${key}`)){
        const result = normalizeFlagValue(node.getAttribute(`data-${key}`));
        if (result !== null) return result;
      }
    }
    return null;
  }

  function hasClassFlag(node, classNames){
    if (!node || !node.classList) return false;
    return classNames.some(cls => node.classList.contains(cls));
  }

  function isNodeMarkedOptional(node){
    if (!node) return false;
    const optionalFlag = hasDataFlag(node, OPTIONAL_DATA_KEYS);
    if (optionalFlag !== null) return optionalFlag;
    const requiredFlag = hasDataFlag(node, REQUIRED_DATA_KEYS);
    if (requiredFlag === false) return true;
    if (hasClassFlag(node, OPTIONAL_CLASS_NAMES)) return true;
    return false;
  }

  function isNodeMarkedRequired(node){
    if (!node || isNodeMarkedOptional(node)) return false;
    if (node.hasAttribute && node.hasAttribute('required') && node.getAttribute('required') !== 'false') return true;
    if (node.getAttribute && node.getAttribute('aria-required') === 'true') return true;
    const requiredFlag = hasDataFlag(node, REQUIRED_DATA_KEYS);
    if (requiredFlag === true) return true;
    if (node.hasAttribute && node.hasAttribute('data-required')){
      const attrResult = normalizeFlagValue(node.getAttribute('data-required'));
      if (attrResult === true) return true;
      if (attrResult === false) return false;
    }
    if (hasClassFlag(node, REQUIRED_CLASS_NAMES)) return true;
    return false;
  }

  function getTextValue(node){
    if (!node) return '';
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function hasMeaningfulValue(element){
    if (!element) return false;
    
    if (element.isContentEditable) {
        const text = getTextValue(element);
        return !!text && !PLACEHOLDER_TEXT_PATTERN.test(text);
    }
    
    if (element.type === 'hidden') return false;
    if (element.type === 'checkbox' || element.type === 'radio') {
      return !!element.checked;
    }
    if (element.type === 'file') {
      return !!(element.files && element.files.length);
    }
    if (element.tagName === 'SELECT') {
      const value = element.value;
      if (value === null || value === undefined) return false;
      const normalized = String(value).trim().toLowerCase();
      if (!normalized) return false;
      if (element.dataset && element.dataset.placeholderValue && normalized === element.dataset.placeholderValue.trim().toLowerCase()) {
        return false;
      }
      const placeholderAttr = element.getAttribute('data-placeholder');
      if (placeholderAttr && normalized === placeholderAttr.trim().toLowerCase()) {
        return false;
      }
      if (PLACEHOLDER_VALUE_PATTERN.test(normalized)) return false;
      return true;
    }
    const rawValue = element.value;
    if (rawValue === null || rawValue === undefined) return false;
    const value = String(rawValue).trim();
    if (!value) return false;
    const normalized = value.toLowerCase();
    if (element.dataset && element.dataset.placeholderValue && normalized === element.dataset.placeholderValue.trim().toLowerCase()) {
      return false;
    }
    const placeholderAttr = element.getAttribute && element.getAttribute('data-placeholder');
    if (placeholderAttr && normalized === placeholderAttr.trim().toLowerCase()) {
      return false;
    }
    if (PLACEHOLDER_VALUE_PATTERN.test(normalized)) return false;
    return true;
  }

  function debounce(fn, delay = 150){
    let timer = null;
    return function(...args){
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  const scheduleHighlightRefresh = debounce(() => updateAllHighlights(true), 180);

  function setSlotAriaLabel(element, label){
    if (!element || !(element instanceof Element)) return;
    if (typeof label === 'string' && label.trim().length){
      element.setAttribute('aria-label', label.trim());
      element.setAttribute('data-slot-aria', 'true');
    } else if (element.getAttribute && element.getAttribute('data-slot-aria') === 'true'){
      element.removeAttribute('aria-label');
      element.removeAttribute('data-slot-aria');
    }
  }

  function handleInteractiveMutation(event){
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches || !(target.matches('input, textarea, select') || target.isContentEditable)) return;
    if (!target.closest('table[data-table-id]')) return;
    if (target.closest('[data-skip-time-slot-indicator="true"]')) return;
    scheduleHighlightRefresh();
  }

  // State management
  const state = {
    tables: new Map(), // table element -> table info
    scanTimer: null,
    scrollTimer: null
  };

  /**
   * Build metadata for table headers, including absolute column positions
   */
  function buildHeaderMetadata(table){
    const rows = Array.from((table.tHead && table.tHead.rows) ? table.tHead.rows : []);
    const occupancy = [];
    const columnPositions = new Map();
    const columnHeaders = new Map();

    rows.forEach((row, rowIndex) => {
      let columnPointer = 0;
      Array.from(row.cells).forEach(cell => {
        columnPointer = findNextFreeColumn(occupancy, rowIndex, columnPointer);

        const colSpan = Math.max(1, cell.colSpan || 1);
        const rowSpan = Math.max(1, cell.rowSpan || 1);

        columnPositions.set(cell, columnPointer);

        for (let colOffset = 0; colOffset < colSpan; colOffset++){
          const absoluteColumn = columnPointer + colOffset;

          if (!columnHeaders.has(absoluteColumn)){
            columnHeaders.set(absoluteColumn, new Set());
          }
          columnHeaders.get(absoluteColumn).add(cell);

          for (let rowOffset = 0; rowOffset < rowSpan; rowOffset++){
            const targetRow = rowIndex + rowOffset;
            occupancy[targetRow] = occupancy[targetRow] || [];
            occupancy[targetRow][absoluteColumn] = true;
          }
        }

        columnPointer += colSpan;
      });
    });

    const headersByColumn = new Map();
    columnHeaders.forEach((set, columnIndex) => {
      headersByColumn.set(columnIndex, Array.from(set));
    });

    return { positions: columnPositions, headersByColumn };
  }

  /**
   * Find the next available column index for a header cell
   */
  function findNextFreeColumn(occupancy, rowIndex, startIndex){
    let column = startIndex;
    while (true){
      const row = occupancy[rowIndex] || (occupancy[rowIndex] = []);
      if (!row[column]){
        return column;
      }
      column++;
    }
  }

  /**
   * Retrieve all header cells that occupy a specific column
   */
  function getHeaderCellsForColumn(info, columnIndex){
    if (typeof columnIndex !== 'number') return [];
    const map = info.headerColumns;
    if (!map) return [];
    const cells = map.get(columnIndex);
    return Array.isArray(cells) ? cells : [];
  }

  /**
   * Locate a body cell that corresponds to the provided column index
   */
  function getCellAtColumn(row, columnIndex){
    if (!row || typeof columnIndex !== 'number') return null;
    let pointer = 0;
    for (const cell of Array.from(row.cells)){
      const span = Math.max(1, cell.colSpan || 1);
      if (columnIndex >= pointer && columnIndex < pointer + span){
        return cell;
      }
      pointer += span;
    }
    return null;
  }

  function getColumnCells(table, columnIndex){
    const cells = [];
    if (!table || typeof columnIndex !== 'number') return cells;
    Array.from(table.tBodies || []).forEach(tbody => {
      Array.from(tbody.rows).forEach(row => {
        const cell = getCellAtColumn(row, columnIndex);
        if (cell) {
          cells.push(cell);
        }
      });
    });
    return cells;
  }

  /**
   * Persistent settings for inspection column locking
   */
  const TimeLockSettings = (() => {
    const STORAGE_KEY = CONFIG.LOCK_STORAGE_KEY;
    let windowMinutes = loadStoredValue();
    let inputEl = null;
    let summaryEl = null;

    function loadStoredValue(){
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return 0;
        const parsed = parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed < 0) return 0;
        return Math.min(parsed, 720);
      } catch (_err) {
        return 0;
      }
    }

    function clamp(value){
      if (!Number.isFinite(value) || value < 0) return 0;
      return Math.min(value, 720);
    }

    function formatSummary(value){
      if (value > 0) {
        return `Columns unlock within ±${value} minute${value === 1 ? '' : 's'} of the scheduled inspection time.`;
      }
      return 'Locking disabled — inspection columns remain editable at any time.';
    }

    function persist(value){
      windowMinutes = clamp(value);
      try {
        localStorage.setItem(STORAGE_KEY, String(windowMinutes));
      } catch (_err) {
        // localStorage might be unavailable
      }
      updateUI();
    }

    function updateUI(){
      if (inputEl && document.activeElement !== inputEl) {
        inputEl.value = windowMinutes;
      }
      if (summaryEl) {
        summaryEl.textContent = formatSummary(windowMinutes);
        summaryEl.classList.toggle('text-purple-600', windowMinutes > 0);
        summaryEl.classList.toggle('text-gray-500', windowMinutes === 0);
      }
    }

    function commitAndRefresh(value){
      persist(value);
      updateAllHighlights(true);
    }

    function bindControl(){
      inputEl = document.getElementById('inspection-lock-window');
      summaryEl = document.getElementById('inspection-lock-window-summary');
      if (!inputEl) return;

      updateUI();

      inputEl.addEventListener('input', () => {
        const value = clamp(parseInt(inputEl.value, 10));
        if (!Number.isNaN(value) && summaryEl) {
          summaryEl.textContent = formatSummary(value);
          summaryEl.classList.toggle('text-purple-600', value > 0);
          summaryEl.classList.toggle('text-gray-500', value === 0);
        }
      });

      const applyValue = () => {
        const value = clamp(parseInt(inputEl.value, 10));
        inputEl.value = value;
        commitAndRefresh(value);
      };

      inputEl.addEventListener('change', applyValue);
      inputEl.addEventListener('blur', applyValue);

      const resetBtn = document.getElementById('inspection-lock-window-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          inputEl.value = 0;
          commitAndRefresh(0);
        });
      }
    }

    return {
      getWindowMinutes: () => windowMinutes,
      bindControl
    };
  })();

  /**
   * Calculate absolute difference between two times with 24h wrap-around
   */
  function getNormalizedMinutesDiff(targetMinutes, nowMinutes){
    const diff = Math.abs(targetMinutes - nowMinutes);
    return Math.min(diff, 1440 - diff);
  }

  function updateCellInteractiveElements(cell, shouldLock){
    const interactiveSelectors = 'input, textarea, select, button';
    const interactives = cell.querySelectorAll(interactiveSelectors);
    interactives.forEach(el => {
      if (shouldLock) {
        if (el.dataset.timeLockManaged !== 'true') {
          el.dataset.timeLockManaged = 'true';
          el.dataset.timeLockPrevDisabled = el.disabled ? 'true' : 'false';
        }
        if (!el.disabled) {
          el.disabled = true;
        }
        el.setAttribute('aria-disabled', 'true');
        if (document.activeElement === el) {
          el.blur();
        }
      } else if (el.dataset.timeLockManaged === 'true') {
        if (el.dataset.timeLockPrevDisabled === 'false') {
          el.disabled = false;
          el.removeAttribute('aria-disabled');
        } else {
          el.setAttribute('aria-disabled', 'true');
        }
        delete el.dataset.timeLockManaged;
        delete el.dataset.timeLockPrevDisabled;
      }
    });

    const editables = cell.querySelectorAll('[contenteditable="true"], [contenteditable=""]');
    editables.forEach(el => {
      if (shouldLock) {
        if (el.dataset.timeLockManaged !== 'true') {
          el.dataset.timeLockManaged = 'true';
          el.dataset.timeLockPrevEditable = el.getAttribute('contenteditable') || '';
        }
        el.setAttribute('contenteditable', 'false');
        el.setAttribute('aria-disabled', 'true');
      } else if (el.dataset.timeLockManaged === 'true') {
        const previous = el.dataset.timeLockPrevEditable;
        if (previous === '') {
          el.removeAttribute('contenteditable');
        } else {
          el.setAttribute('contenteditable', previous);
        }
        el.removeAttribute('aria-disabled');
        delete el.dataset.timeLockManaged;
        delete el.dataset.timeLockPrevEditable;
      }
    });
  }

  function updateCellLockState(cell, shouldLock){
    if (!cell) return;
    if (shouldLock) {
      cell.classList.add(CONFIG.CLASS_LOCKED);
      cell.dataset.timeLockState = 'locked';
    } else {
      cell.classList.remove(CONFIG.CLASS_LOCKED);
      cell.removeAttribute('data-time-lock-state');
    }
    updateCellInteractiveElements(cell, shouldLock);
  }

  function updateHeaderLockState(header, shouldLock){
    if (!header) return;
    if (shouldLock) {
      header.classList.add(CONFIG.CLASS_LOCKED);
      header.setAttribute('data-time-lock-state', 'locked');
      header.setAttribute('aria-disabled', 'true');
    } else {
      header.classList.remove(CONFIG.CLASS_LOCKED);
      header.removeAttribute('data-time-lock-state');
      header.removeAttribute('aria-disabled');
    }
  }

  function applyLockToColumn(table, info, columnIndex, shouldLock, options = {}){
    info.columnLockState = info.columnLockState || new Map();
    const previous = info.columnLockState.get(columnIndex);
    if (!options.force && previous === shouldLock) {
      return;
    }
    info.columnLockState.set(columnIndex, shouldLock);

    const headerCells = getHeaderCellsForColumn(info, columnIndex).slice();
    if (info.headers && info.columnIndexes) {
      const fallbackIndex = info.columnIndexes.findIndex(idx => idx === columnIndex);
      if (fallbackIndex !== -1) {
        const fallbackHeader = info.headers[fallbackIndex];
        if (fallbackHeader && !headerCells.includes(fallbackHeader)) {
          headerCells.push(fallbackHeader);
        }
      }
    }
    headerCells.forEach(header => updateHeaderLockState(header, shouldLock));

    Array.from(table.tBodies || []).forEach(tbody => {
      Array.from(tbody.rows).forEach(row => {
        const cell = getCellAtColumn(row, columnIndex);
        if (cell) {
          updateCellLockState(cell, shouldLock);
        }
      });
    });
  }

  function clearColumnLocks(table, info){
    if (!info.columnLockState) return;
    info.columnLockState.forEach((state, columnIndex) => {
      if (state) {
        applyLockToColumn(table, info, columnIndex, false, { force: true });
      }
    });
    info.columnLockState.clear();
  }

  function updateColumnLockStates(table, info, nowMinutes, force = false){
    const lockWindow = TimeLockSettings.getWindowMinutes();
    if (!lockWindow || lockWindow <= 0) {
      if (info.columnLockState && info.columnLockState.size) {
        clearColumnLocks(table, info);
      }
      return;
    }

    info.columnLockState = info.columnLockState || new Map();

    info.times.forEach((timeStr, idx) => {
      const minutes = parseTimeToMinutes(timeStr);
      if (minutes === null) return;
      const columnIndex = info.columnIndexes ? info.columnIndexes[idx] : null;
      if (typeof columnIndex !== 'number') return;

      const diff = getNormalizedMinutesDiff(minutes, nowMinutes);
      const shouldLock = diff > lockWindow;
      applyLockToColumn(table, info, columnIndex, shouldLock, { force });
    });
  }

  /**
   * Initialize the time-based navigation system
   */
  function init(){
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    log('Initializing Time-Based Navigation System...');
    
    // Initial scan and setup
    setupMutationObserver();
    scanAllTables();
    updateAllHighlights();
    
    // Set up periodic updates
    setInterval(updateAllHighlights, CONFIG.UPDATE_INTERVAL);
    
    // Listen for form changes
    attachEventListeners();
    TimeLockSettings.bindControl();
    
    log('Time-Based Navigation System initialized successfully');
  }

  /**
   * Attach event listeners to form elements
   */
  function attachEventListeners(){
    const shiftDuration = document.getElementById('shift-duration');
    if (shiftDuration){ 
      shiftDuration.addEventListener('change', scheduleRescan); 
    }
    
    const startTime = document.getElementById('start-inspection-time');
    if (startTime){ 
      startTime.addEventListener('change', scheduleRescan); 
    }
    
    // Listen for product changes
    document.addEventListener('productChanged', scheduleRescan);
    
    // Listen for table rebuild events
    document.addEventListener('tableRebuilt', scheduleRescan);

    ['input', 'change', 'blur', 'paste'].forEach(eventName => {
      document.addEventListener(eventName, handleInteractiveMutation, true);
    });

    document.addEventListener('keyup', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.isContentEditable && target.closest('table[data-table-id]')) {
        scheduleHighlightRefresh();
      }
    }, true);
  }

  /**
   * Schedule a rescan of all tables
   */
  function scheduleRescan(){
    clearTimeout(state.scanTimer);
    state.scanTimer = setTimeout(() => {
      log('Rescanning tables due to form change...');
      scanAllTables();
      updateAllHighlights(true);
    }, 250);
  }

  /**
   * Set up mutation observer to detect new tables
   */
  function setupMutationObserver(){
    const observer = new MutationObserver(mutations => {
      let needsUpdate = false;
      
      mutations.forEach(mutation => {
        // Check for added nodes
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          
          if (node.matches('table[data-table-id]')) {
            collectTableInfo(node);
            needsUpdate = true;
          } else if (node.querySelector && node.querySelector('table[data-table-id]')) {
            scanTables(node);
            needsUpdate = true;
          }
        });
        
        // Check for removed nodes
        mutation.removedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          cleanupRemovedTables();
        });
      });
      
      if (needsUpdate) {
        updateAllHighlights(true);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Scan all tables in the document
   */
  function scanAllTables(){
    scanTables(document);
    cleanupRemovedTables();
  }

  /**
   * Scan tables within a root element
   */
  function scanTables(root){
    const tables = Array.from((root || document).querySelectorAll('table[data-table-id]'));
    log(`Found ${tables.length} tables to scan`);
    tables.forEach(collectTableInfo);
  }

  /**
   * Remove tables that are no longer in the DOM
   */
  function cleanupRemovedTables(){
    state.tables.forEach((info, table) => {
      if (!document.contains(table)) {
        state.tables.delete(table);
        log('Removed table from state:', table.dataset.tableId);
      }
    });
  }

  /**
   * Collect information about a table's time columns
   */
  function collectTableInfo(table){
    if (!table.tHead || !table.tBodies || table.tBodies.length === 0) {
      log('Table missing thead or tbody:', table.dataset.tableId);
      return;
    }

    const headerRows = table.tHead.rows;
    if (!headerRows || headerRows.length === 0) {
      log('Table missing header rows:', table.dataset.tableId);
      return;
    }

    // Find the row with time values (prefer second row, fallback to first)
    let timeRow = headerRows.length > 1 ? headerRows[1] : headerRows[0];
    
    // Find all cells with time values
    const timeCells = Array.from(timeRow.cells).filter(cell => {
      const text = cell.textContent.trim();
      return CONFIG.TIME_REGEX.test(text);
    });

    if (timeCells.length === 0) {
      log('No time columns found in table:', table.dataset.tableId);
      state.tables.delete(table);
      return;
    }

    const headerMeta = buildHeaderMetadata(table);

    const columnIndexes = timeCells.map(cell => {
      const columnIndex = headerMeta.positions.get(cell);
      if (typeof columnIndex === 'number') {
        return columnIndex;
      }
      log('Unable to resolve column index for time cell:', cell.textContent.trim(), table.dataset.tableId);
      return null;
    });
    
    // Extract time values
    const times = timeCells.map(cell => {
      const value = cell.textContent.trim();
      cell.dataset.timeSlot = value;
      return value;
    });

    // Store table information
    const tableInfo = {
      times,
      headers: timeCells,
      columnIndexes,
      headerColumns: headerMeta.headersByColumn,
      columnLockState: new Map(),
      activeIndex: -1,
      lastUpdate: null
    };

    state.tables.set(table, tableInfo);
    log(`Collected table info for ${table.dataset.tableId}:`, {
      timeColumns: times.length,
      columnIndexes,
      times
    });
  }

  /**
   * Update highlights for all tables
   */
function updateAllHighlights(force = false){
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    
    log(`Updating highlights (force=${force}) at ${now.toLocaleTimeString()}`);
    
    let firstActiveTable = null;
    let firstActiveColumn = null;

    state.tables.forEach((info, table) => {
      if (!document.contains(table)) {
        state.tables.delete(table);
        return;
      }

      if (!info.times || info.times.length === 0) return;

      // *** THIS IS THE CHANGED LINE ***
      const activeIndex = findCurrentInspectionIndex(info.times, nowMinutes);
      
      updateColumnLockStates(table, info, nowMinutes, force);
      
      if (activeIndex === -1) {
        log(`No current time slot found for table ${table.dataset.tableId}`);
        return;
      }

      // Update if forced or if the active index changed
      if (force || activeIndex !== info.activeIndex){
        info.activeIndex = activeIndex;
        info.lastUpdate = now;
        applyColumnHighlight(table, info, nowMinutes);
        
        const columnIndexForScroll = info.columnIndexes ? info.columnIndexes[activeIndex] : null;
        // Track first active column for auto-scroll
        if (!firstActiveTable && typeof columnIndexForScroll === 'number') {
          firstActiveTable = table;
          firstActiveColumn = columnIndexForScroll;
        }
      }
    });

    // Auto-scroll to the first active column
    if (CONFIG.AUTO_SCROLL && firstActiveTable && firstActiveColumn !== null) {
      scheduleAutoScroll(firstActiveTable, firstActiveColumn);
    }
  }


  /**
   * Find the index of the next inspection time slot
   */
  function findNextInspectionIndex(times, nowMinutes){
    let bestIndex = -1;
    let bestDiff = Infinity;
    
    times.forEach((timeStr, idx) => {
      const minutes = parseTimeToMinutes(timeStr);
      if (minutes === null) return;
      
      let diff = minutes - nowMinutes;
      
      // Handle time wrap around midnight
      if (diff < 0) {
        diff += 1440; // Add 24 hours in minutes
      }
      
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = idx;
      }
    });
    
    return bestIndex;
  }

  /**
   * Parse time string to minutes since midnight
   */
  function parseTimeToMinutes(str){
    const match = str.match(CONFIG.TIME_REGEX);
    if (!match) return null;
    
    const [hour, minute] = str.split(':').map(Number);
    return hour * 60 + minute;
  }

  /**
   * Check if all required fields in a column are filled with data
   * ENHANCED CHECK: Properly handles radio button groups and completion logic
   */
  function isColumnDataComplete(table, columnIndex) {
    if (typeof columnIndex !== 'number') {
        return false;
    }

    const columnCells = getColumnCells(table, columnIndex);
    
    let totalFields = 0;
    let filledFields = 0;
    let hasAnyEmptyRequiredField = false;
    const radioGroups = new Map(); // Track radio button groups by name
    const processedElements = new Set(); // Avoid double counting

    for (const cell of columnCells) {
        // Skip cells explicitly marked to skip indicators
        if (cell.closest && cell.closest('[data-skip-time-slot-indicator="true"]')) {
            continue;
        }

        // Find all interactive elements in the cell
        const interactiveElements = Array.from(cell.querySelectorAll('input:not([type=hidden]), textarea, select, [contenteditable]'));
        
        // Check if cell or its elements are marked as required
        const cellIsRequired = !isNodeMarkedOptional(cell) && isNodeMarkedRequired(cell);

        if (interactiveElements.length > 0) {
            // Process each interactive element in the cell
            for (const element of interactiveElements) {
                // Skip if already processed (for radio groups)
                if (processedElements.has(element)) {
                    continue;
                }

                // Handle radio button groups
                if (element.type === 'radio' && element.name) {
                    const formId = element.form ? (element.form.id || 'default') : 'no-form';
                    const groupKey = `${formId}_${element.name}`;
                    
                    if (!radioGroups.has(groupKey)) {
                        // First radio in this group - collect all radios with same name in same form/context
                        const formOrDoc = element.form || document;
                        const groupElements = Array.from(formOrDoc.querySelectorAll(`input[type="radio"][name="${element.name}"]`))
                            .filter(radio => {
                                // Only include radios that are in the same column
                                const radioCell = radio.closest('td, th');
                                return radioCell && columnCells.includes(radioCell);
                            });
                        
                        const hasCheckedRadio = groupElements.some(radio => radio.checked);
                        const groupIsRequired = groupElements.some(radio => 
                            !isNodeMarkedOptional(radio) && (isNodeMarkedRequired(radio) || cellIsRequired)
                        );

                        radioGroups.set(groupKey, {
                            elements: groupElements,
                            hasValue: hasCheckedRadio,
                            isRequired: groupIsRequired
                        });

                        // Mark all radio elements in this group as processed
                        groupElements.forEach(radio => processedElements.add(radio));

                        totalFields++;
                        if (hasCheckedRadio) {
                            filledFields++;
                        } else if (groupIsRequired) {
                            hasAnyEmptyRequiredField = true;
                        }
                    }
                }
                // Handle individual checkboxes (not part of radio groups)
                else if (element.type === 'checkbox') {
                    totalFields++;
                    const elementIsRequired = !isNodeMarkedOptional(element) && (isNodeMarkedRequired(element) || cellIsRequired);
                    const valuePresent = element.checked;

                    if (valuePresent) {
                        filledFields++;
                    } else if (elementIsRequired) {
                        hasAnyEmptyRequiredField = true;
                    }
                    processedElements.add(element);
                }
                // Handle other input types
                else {
                    totalFields++;
                    const elementIsRequired = !isNodeMarkedOptional(element) && (isNodeMarkedRequired(element) || cellIsRequired);
                    const valuePresent = hasMeaningfulValue(element);

                    if (valuePresent) {
                        // Check for meaningful non-default values
                        if (element.classList.contains('grade-select')) {
                            // Grade selects: non-A value means it was filled
                            if (element.value && element.value !== 'A') {
                                filledFields++;
                            } else if (elementIsRequired) {
                                hasAnyEmptyRequiredField = true;
                            }
                        } else {
                            // Other inputs with meaningful values
                            filledFields++;
                        }
                    } else if (elementIsRequired) {
                        hasAnyEmptyRequiredField = true;
                    }
                    processedElements.add(element);
                }
            }
        } else {
            // Cell without interactive elements - check cell content itself
            if (cellIsRequired) {
                totalFields++;
                if (hasMeaningfulValue(cell)) {
                    filledFields++;
                } else {
                    hasAnyEmptyRequiredField = true;
                }
            }
        }
    }

    // Enhanced completion logic:
    // 1. Must have fields to check (totalFields > 0)
    // 2. All fields must be filled (filledFields === totalFields) 
    // 3. No required fields should be empty
    if (totalFields === 0) {
        return false; // No data to check = not complete
    }

    // Stricter completion check
    const allFieldsFilled = filledFields === totalFields;
    const noRequiredFieldsEmpty = !hasAnyEmptyRequiredField;
    
    return allFieldsFilled && noRequiredFieldsEmpty;
}


  /**
   * Apply column highlighting to table
   */
  function applyColumnHighlight(table, info, nowMinutes){
    // Clear all existing highlights
    clearAllHighlights(table);

    const activeIndex = info.activeIndex;
    const columnIndex = info.columnIndexes ? info.columnIndexes[activeIndex] : null;
    if (typeof columnIndex !== 'number') {
      log('Column index for active header could not be determined:', activeIndex, table.dataset.tableId);
      return;
    }

    const activeTime = info.times[activeIndex];
    log(`Highlighting column ${columnIndex} (${activeTime}) in table ${table.dataset.tableId}`);

    const headerTargets = (() => {
      const cells = getHeaderCellsForColumn(info, columnIndex).slice();
      const fallback = info.headers[activeIndex];
      if (fallback && !cells.includes(fallback)) {
        cells.push(fallback);
      }
      return cells;
    })();

    headerTargets.forEach(headerCell => {
      if (!headerCell) return;
      headerCell.classList.remove(CONFIG.CLASS_PAST, CONFIG.CLASS_UPCOMING, CONFIG.CLASS_COMPLETE, CONFIG.CLASS_INCOMPLETE);
      headerCell.classList.add(CONFIG.CLASS_ACTIVE);
      headerCell.dataset.slotStatus = 'active';
      headerCell.setAttribute('data-active-slot', 'true');
      headerCell.removeAttribute('data-slot-completion');
      headerCell.setAttribute('title', `Current inspection time: ${activeTime}`);
      setSlotAriaLabel(headerCell, `Current inspection time: ${activeTime}`);
    });

    const activeColumnCells = getColumnCells(table, columnIndex);
    activeColumnCells.forEach(cell => {
      cell.classList.remove(CONFIG.CLASS_PAST, CONFIG.CLASS_UPCOMING, CONFIG.CLASS_COMPLETE, CONFIG.CLASS_INCOMPLETE);
      cell.classList.add(CONFIG.CLASS_ACTIVE);
      cell.dataset.slotStatus = 'active';
      cell.setAttribute('data-time-slot', activeTime);
      cell.removeAttribute('data-slot-completion');
    });

    // Mark past and upcoming columns with proper completion status
    info.times.forEach((timeStr, idx) => {
      const minutes = parseTimeToMinutes(timeStr);
      if (minutes === null) return;

      const colIndex = info.columnIndexes ? info.columnIndexes[idx] : null;
      const headerCells = getHeaderCellsForColumn(info, colIndex);
      const fallbackHeader = info.headers[idx];
      const targets = headerCells.length ? headerCells : (fallbackHeader ? [fallbackHeader] : []);

      if (idx === activeIndex) {
        return;
      }

      const columnCells = typeof colIndex === 'number' ? getColumnCells(table, colIndex) : [];

      let diff = minutes - nowMinutes;
      if (diff < 0) diff += 1440;

      let isPast = false;

      if (nowMinutes >= minutes) {
        isPast = (nowMinutes - minutes) > CONFIG.PAST_THRESHOLD;
      } else {
        const dayWrapDiff = (1440 - minutes) + nowMinutes;
        isPast = dayWrapDiff > CONFIG.PAST_THRESHOLD;
      }

      if (CONFIG.DEBUG) {
        const diffDebug = nowMinutes >= minutes ? nowMinutes - minutes : (1440 - minutes) + nowMinutes;
        log(`Time slot ${timeStr} (${minutes}min): nowMinutes=${nowMinutes}, isPast=${isPast}, diff=${diffDebug}min`);
      }

      if (isPast) {
        const isComplete = typeof colIndex === 'number' ? isColumnDataComplete(table, colIndex) : false;
        const slotStatus = isComplete ? 'complete' : 'incomplete';
        const statusLabel = isComplete ? 'Completed' : 'Needs attention';

        targets.forEach(header => {
          if (!header) return;
          header.classList.add(CONFIG.CLASS_PAST);
          header.classList.toggle(CONFIG.CLASS_COMPLETE, isComplete);
          header.classList.toggle(CONFIG.CLASS_INCOMPLETE, !isComplete);
          header.dataset.slotStatus = slotStatus;
          header.dataset.slotCompletion = slotStatus;
          header.setAttribute('title', `Past inspection time: ${timeStr} (${statusLabel})`);
          setSlotAriaLabel(header, `Past inspection time ${timeStr} - ${statusLabel}`);
        });

        columnCells.forEach(cell => {
          cell.classList.add(CONFIG.CLASS_PAST);
          cell.classList.toggle(CONFIG.CLASS_COMPLETE, isComplete);
          cell.classList.toggle(CONFIG.CLASS_INCOMPLETE, !isComplete);
          cell.dataset.slotStatus = slotStatus;
          cell.dataset.slotCompletion = slotStatus;
        });
      } else if (diff < 120) {
        targets.forEach(header => {
          if (!header) return;
          header.classList.add(CONFIG.CLASS_UPCOMING);
          header.classList.remove(CONFIG.CLASS_COMPLETE, CONFIG.CLASS_INCOMPLETE, CONFIG.CLASS_PAST);
          header.dataset.slotStatus = 'upcoming';
          header.removeAttribute('data-slot-completion');
          header.setAttribute('title', `Upcoming inspection time: ${timeStr}`);
          setSlotAriaLabel(header, `Upcoming inspection time: ${timeStr}`);
        });

        columnCells.forEach(cell => {
          cell.classList.add(CONFIG.CLASS_UPCOMING);
          cell.classList.remove(CONFIG.CLASS_COMPLETE, CONFIG.CLASS_INCOMPLETE, CONFIG.CLASS_PAST);
          cell.dataset.slotStatus = 'upcoming';
          cell.removeAttribute('data-slot-completion');
        });
      } else {
        targets.forEach(header => {
          if (!header) return;
          header.classList.remove(CONFIG.CLASS_COMPLETE, CONFIG.CLASS_INCOMPLETE, CONFIG.CLASS_UPCOMING, CONFIG.CLASS_PAST);
          header.removeAttribute('data-slot-completion');
          header.setAttribute('title', `Scheduled inspection time: ${timeStr}`);
          setSlotAriaLabel(header, `Scheduled inspection time: ${timeStr}`);
        });

        columnCells.forEach(cell => {
          cell.classList.remove(CONFIG.CLASS_COMPLETE, CONFIG.CLASS_INCOMPLETE, CONFIG.CLASS_UPCOMING, CONFIG.CLASS_PAST);
          cell.removeAttribute('data-slot-completion');
        });
      }
    });

    // Store active time on table
    table.dataset.activeTimeSlot = activeTime;
    table.dataset.activeColumnIndex = typeof columnIndex === 'number' ? String(columnIndex) : '';
    
    // Dispatch custom event
    const event = new CustomEvent('timeSlotActivated', {
      detail: {
        table: table,
        timeSlot: activeTime,
        columnIndex: activeIndex,
        columnNumber: columnIndex
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Clear all highlights from a table
   */
  function clearAllHighlights(table){
    const classes = [
      CONFIG.CLASS_ACTIVE, 
      CONFIG.CLASS_UPCOMING, 
      CONFIG.CLASS_PAST, 
      CONFIG.CLASS_COMPLETE, 
      CONFIG.CLASS_INCOMPLETE
    ];
    
    classes.forEach(className => {
      table.querySelectorAll('.' + className).forEach(el => {
        el.classList.remove(className);
        if (className === CONFIG.CLASS_ACTIVE) {
          el.removeAttribute('data-active-slot');
          if (el.tagName === 'TD') {
            el.removeAttribute('data-time-slot');
          }
        }
        if (el.tagName === 'TH') {
          el.removeAttribute('title');
        }
      });
    });

    table.querySelectorAll('[data-slot-status]').forEach(el => {
      el.removeAttribute('data-slot-status');
    });

    table.querySelectorAll('[data-slot-completion]').forEach(el => {
      el.removeAttribute('data-slot-completion');
    });

    table.querySelectorAll('[data-slot-aria]').forEach(el => {
      setSlotAriaLabel(el, null);
    });
  }

  /**
   * Schedule auto-scroll to active column
   */
  function scheduleAutoScroll(table, columnIndex){
    if (typeof columnIndex !== 'number') return;
    clearTimeout(state.scrollTimer);
    
    state.scrollTimer = setTimeout(() => {
      scrollToActiveColumn(table, columnIndex);
    }, CONFIG.SCROLL_DELAY);
  }

  /**
   * Scroll the table to show the active column
   */
  function scrollToActiveColumn(table, columnIndex){
    if (typeof columnIndex !== 'number') return;
    const tableInfo = state.tables.get(table);
    if (!tableInfo) return;

    const headerCells = getHeaderCellsForColumn(tableInfo, columnIndex);
    const activeHeader = headerCells.length ? headerCells[0] : (tableInfo.headers[tableInfo.activeIndex] || null);
    if (!activeHeader) return;

    // Check if the table is in a scrollable container
    const scrollContainer = findScrollableParent(table);
    
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const headerRect = activeHeader.getBoundingClientRect();
      
      // Only scroll if the header is not fully visible
      if (headerRect.left < containerRect.left || headerRect.right > containerRect.right) {
        const scrollLeft = activeHeader.offsetLeft - (scrollContainer.clientWidth / 2) + (activeHeader.offsetWidth / 2);
        
        scrollContainer.scrollTo({
          left: Math.max(0, scrollLeft),
          behavior: 'smooth'
        });
        
        log(`Auto-scrolled to column ${columnIndex}`);
      }
    }
  }

  /**
   * Find the nearest scrollable parent element
   */
  function findScrollableParent(element){
    let parent = element.parentElement;
    
    while (parent) {
      const overflow = window.getComputedStyle(parent).overflowX;
      
      if ((overflow === 'auto' || overflow === 'scroll') && parent.scrollWidth > parent.clientWidth) {
        return parent;
      }
      
      parent = parent.parentElement;
    }
    
    return null;
  }

  /**
   * Logging utility
   */
  function log(...args){
    if (CONFIG.DEBUG) {
      console.log('[TimeNavigation]', ...args);
    }
  }

  // Initialize on load
  init();

  // Expose public API
  window.TimeBasedNavigation = {
    rescan: scanAllTables,
    update: updateAllHighlights,
    enableDebug: (enable = true) => {
      CONFIG.DEBUG = enable;
      log('Debug mode', enable ? 'enabled' : 'disabled');
    },
    forceUpdate: () => updateAllHighlights(true),
    checkColumnCompletion: (tableId, columnIndex) => {
      const table = Array.from(state.tables.keys()).find(t => t.dataset.tableId === tableId);
      return table ? isColumnDataComplete(table, columnIndex) : null;
    },
    getTables: () => Array.from(state.tables.keys()),
    getActiveSlots: () => {
      const slots = {};
      state.tables.forEach((info, table) => {
        const tableId = table.dataset.tableId;
        if (tableId && info.activeIndex >= 0) {
          slots[tableId] = info.times[info.activeIndex];
        }
      });
      return slots;
    },
    getTableInfo: (tableId) => {
      const table = Array.from(state.tables.keys()).find(t => t.dataset.tableId === tableId);
      return table ? state.tables.get(table) : null;
    }
  };

})();