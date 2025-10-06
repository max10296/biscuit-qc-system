// js/notes-toggle.js
// Adds a per-table "Show/Hide Notes" button next to CSV / Excel / Stop buttons.
// Each button toggles ONLY the notes block for its own table.
(function(){
  'use strict';

  const VISIBLE_PREFIX = 'tableNotes|visible|'; // + data-notes-key

  // --- utils ---
  const $ = (sel, root=document)=> root.querySelector(sel);

  function matchesToolbarText(el){
    if (!el) return false;
    const t = (el.textContent || '').toLowerCase();
    return t.includes('csv') || t.includes('excel') || t.includes('stop');
  }

  function findToolbarContainers(){
    const containers = new Set();
    const clickable = Array.from(document.querySelectorAll('button, a'));
    clickable.forEach(btn => {
      if (matchesToolbarText(btn)) {
        let p = btn.parentElement;
        for (let i=0;i<3 && p;i++){
          const hasManyButtons = p.querySelectorAll('button, a').length >= 2;
          if (hasManyButtons) { containers.add(p); break; }
          p = p.parentElement;
        }
      }
    });
    return Array.from(containers);
  }

  function createToggleButton(exampleBtnClass){
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-notes-toggle-btn','1');
    b.textContent = 'Hide Notes';
    if (exampleBtnClass) b.className = exampleBtnClass;
    else b.className = 'bg-gray-200 text-gray-800 px-2 py-1 rounded border border-gray-300 ml-2';
    b.style.marginLeft = b.style.marginLeft || '0.5rem';
    return b;
  }

  function findRelatedTable(toolbar){
    if (!toolbar) return null;
    // 1) check immediate next/prev siblings (up to a few steps)
    const limit = 6;
    let n = toolbar.nextElementSibling; let steps=0;
    while(n && steps++<limit){ if (n.tagName==='TABLE') return n; n = n.nextElementSibling; }
    n = toolbar.previousElementSibling; steps=0;
    while(n && steps++<limit){ if (n.tagName==='TABLE') return n; n = n.previousElementSibling; }
    // 2) search within parent container
    let p = toolbar.parentElement; let depth=0;
    while(p && depth++<3){ const t = p.querySelector('table'); if (t) return t; p = p.parentElement; }
    return null;
  }

  function getNotesBlockForTable(table){
    if (!table) return null;
    // Usually added directly after table by table-notes.js
    let sib = table.nextElementSibling;
    if (sib && sib.classList && sib.classList.contains('table-notes-block')) return sib;
    // Fallback: search forward until next table
    let n = table.nextElementSibling; let hops=0;
    while(n && hops++<10){
      if (n.classList && n.classList.contains('table-notes-block')) return n;
      if (n.tagName==='TABLE') break; // reached next table
      n = n.nextElementSibling;
    }
    return null;
  }

  function getSavedVisibleForKey(key){
    if (!key) return true;
    try{ const v = localStorage.getItem(VISIBLE_PREFIX+key); return v!== '0'; }catch(_){ return true; }
  }
  function setSavedVisibleForKey(key, visible){
    if (!key) return;
    try{ localStorage.setItem(VISIBLE_PREFIX+key, visible? '1':'0'); }catch(_){ }
  }

  function applyVisibilityToBlock(block, visible){
    if (!block) return;
    block.classList.toggle('hidden', !visible);
  }

  function updateButtonLabel(btn, visible){
    if (!btn) return;
    btn.textContent = visible ? 'Hide Notes' : 'Show Notes';
  }

  function initButtonForToolbar(tb){
    if (!tb || tb.querySelector('[data-notes-toggle-btn]')) return;
    const example = tb.querySelector('button, a');
    const btn = createToggleButton(example ? example.className : '');
    tb.appendChild(btn);

    function sync(){
      const table = findRelatedTable(tb);
      const block = getNotesBlockForTable(table);
      if (!block){ updateButtonLabel(btn, true); return; }
      const key = block.getAttribute('data-notes-key') || '';
      const visible = getSavedVisibleForKey(key);
      applyVisibilityToBlock(block, visible);
      updateButtonLabel(btn, visible);
    }

    btn.addEventListener('click', ()=>{
      const table = findRelatedTable(tb);
      const block = getNotesBlockForTable(table);
      if (!block) return; // nothing to toggle yet
      const key = block.getAttribute('data-notes-key') || '';
      const curVisible = !block.classList.contains('hidden');
      const nextVisible = !curVisible;
      applyVisibilityToBlock(block, nextVisible);
      setSavedVisibleForKey(key, nextVisible);
      updateButtonLabel(btn, nextVisible);
    });

    // Initial sync
    sync();
  }

  function injectButtons(){
    const toolbars = findToolbarContainers();
    toolbars.forEach(initButtonForToolbar);
  }

  function observe(){
    const mo = new MutationObserver(() => {
      // ensure buttons exist and labels synced
      injectButtons();
      // apply saved visibility to any new notes blocks
      document.querySelectorAll('.table-notes-block').forEach(block => {
        const key = block.getAttribute('data-notes-key') || '';
        const visible = getSavedVisibleForKey(key);
        applyVisibilityToBlock(block, visible);
      });
    });
    mo.observe(document.body, {childList:true, subtree:true});
  }

  function init(){
    injectButtons();
    observe();
    // Apply saved visibility on load to existing notes
    document.querySelectorAll('.table-notes-block').forEach(block => {
      const key = block.getAttribute('data-notes-key') || '';
      applyVisibilityToBlock(block, getSavedVisibleForKey(key));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
