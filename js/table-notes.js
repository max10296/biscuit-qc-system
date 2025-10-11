(function(){
  'use strict';

  const NOTES_TEXT_PREFIX = 'tableNotes|text|';
  const NOTES_VISIBILITY_PREFIX = 'tableNotes|visible|';
  const NOTES_ATTR = 'data-notes-key';

  const debounce = (fn, delay = 250) => {
    let timer;
    return function(){
      const args = arguments;
      const ctx = this;
      clearTimeout(timer);
      timer = setTimeout(()=> fn.apply(ctx, args), delay);
    };
  };

  function getCurrentProductId(){
    const select = document.getElementById('product-name');
    return select && select.value ? select.value : 'global';
  }

  function storageKey(key){
    return NOTES_TEXT_PREFIX + key;
  }

  function readStorage(key){
    try {
      return localStorage.getItem(storageKey(key)) || '';
    } catch(e){
      return '';
    }
  }

  function writeStorage(key, value){
    try {
      if (value && value.trim()) {
        localStorage.setItem(storageKey(key), value.trim());
      } else {
        localStorage.removeItem(storageKey(key));
      }
    } catch(e){
      /* ignore quota errors */
    }
  }

  function getTableTitle(table){
    if (!table) return 'this table';
    const container = table.closest('.mb-4') || table.parentElement;
    if (container){
      const heading = container.querySelector('h3, h2, header h3, header h2');
      if (heading && heading.textContent){
        return heading.textContent.replace(/\s+/g,' ').trim();
      }
    }
    const labeledBy = table.getAttribute('aria-labelledby');
    if (labeledBy){
      const el = document.getElementById(labeledBy);
      if (el) return el.textContent.trim();
    }
    return table.getAttribute('data-table-id') || table.id || 'this table';
  }

  function ensureNotesBlock(table){
    if (!table) return null;

    const tableId = table.getAttribute('data-table-id') || table.id;
    if (!tableId) return null;

    const key = `${getCurrentProductId()}::${tableId}`;

    // avoid duplicates
    let existing = findExistingBlock(table, key);
    if (existing) {
      hydrateTextarea(existing, key);
      return existing;
    }

    const block = document.createElement('div');
    block.className = 'table-notes-block';
    block.setAttribute(NOTES_ATTR, key);

    const header = document.createElement('header');
    header.innerHTML = `<i class="fas fa-sticky-note"></i><span> Notes for ${escapeHtml(getTableTitle(table))}</span>`;

    const textarea = document.createElement('textarea');
    textarea.className = 'table-notes-textarea';
    textarea.placeholder = 'Document observations, corrective actions, or additional details for operators.';
    textarea.value = readStorage(key);

    const hint = document.createElement('div');
    hint.className = 'table-notes-hint';
    hint.textContent = 'Notes persist per product & table. They will be included in saved reports and print exports.';

    textarea.addEventListener('input', debounce(()=>{
      writeStorage(key, textarea.value);
      block.dispatchEvent(new CustomEvent('tableNotesChanged', {
        bubbles: true,
        detail: { key, value: textarea.value }
      }));
    }, 300));

    block.appendChild(header);
    block.appendChild(textarea);
    block.appendChild(hint);

    table.insertAdjacentElement('afterend', block);

    applySavedVisibility(block, key);

    return block;
  }

  function escapeHtml(str){
    return (str || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch] || ch));
  }

  function findExistingBlock(table, key){
    let node = table.nextElementSibling;
    let hops = 0;
    while(node && node.tagName !== 'TABLE' && hops < 6){
      if (node.classList && node.classList.contains('table-notes-block')){
        if (!key || node.getAttribute(NOTES_ATTR) === key) {
          return node;
        }
      }
      node = node.nextElementSibling;
      hops++;
    }
    return null;
  }

  function hydrateTextarea(block, key){
    if (!block) return;
    const textarea = block.querySelector('textarea');
    if (textarea && !textarea.dataset.__hydrated){
      textarea.value = readStorage(key);
      textarea.dataset.__hydrated = '1';
      textarea.addEventListener('input', debounce(()=>{
        writeStorage(key, textarea.value);
        block.dispatchEvent(new CustomEvent('tableNotesChanged', {
          bubbles: true,
          detail: { key, value: textarea.value }
        }));
      }, 300));
    }
    applySavedVisibility(block, key);
  }

  function applySavedVisibility(block, key){
    if (!block) return;
    try {
      const v = localStorage.getItem(NOTES_VISIBILITY_PREFIX + key);
      if (v === '0') {
        block.classList.add('hidden');
      } else {
        block.classList.remove('hidden');
      }
    } catch(e){
      /* ignore */
    }
  }

  function scanAndAttach(root){
    const tables = (root || document).querySelectorAll('table[data-table-id]');
    tables.forEach(table => ensureNotesBlock(table));
  }

  function observeMutations(){
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches && node.matches('table[data-table-id]')) {
            ensureNotesBlock(node);
          } else {
            scanAndAttach(node);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function onProductChange(){
    // Rebuild all notes blocks to include new product scope
    document.querySelectorAll('table[data-table-id]').forEach(table => {
      const block = findExistingBlock(table);
      if (block) block.remove();
      ensureNotesBlock(table);
    });
  }

  function dispatchReady(){
    document.dispatchEvent(new CustomEvent('tableNotesReady'));
  }

  function init(){
    scanAndAttach(document);
    observeMutations();
    document.addEventListener('productChanged', onProductChange);
    dispatchReady();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
