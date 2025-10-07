// Ensure all notes (general and per-table) are visible during PDF export and printing
(function(){
  'use strict';

  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  // Create or update a plain-text display for textarea content so html2canvas/jspdf capture it reliably
  function ensureTextareaPrintView(textarea){
    if (!textarea) return null;
    let display = textarea.parentElement.querySelector('.notes-print-value');
    if (!display){
      display = document.createElement('div');
      display.className = 'notes-print-value';
      // Tailwind-like styling inline for reliability
      display.style.border = '1px solid #e5e7eb';
      display.style.borderRadius = '6px';
      display.style.padding = '8px 10px';
      display.style.fontSize = '0.875rem';
      display.style.lineHeight = '1.4';
      display.style.whiteSpace = 'pre-wrap';
      display.style.background = '#fff';
      display.style.marginTop = '4px';
      textarea.parentElement.insertBefore(display, textarea.nextSibling);
    }
    const val = textarea.value || '';
    display.textContent = val; // pre-wrap preserves newlines
    return display;
  }

  // Keep original visibility states so we can restore after export/print
  function captureStates(){
    const states = [];
    qsa('.table-notes-block').forEach(block => {
      const ta = block.querySelector('textarea');
      states.push({ 
        el: block, 
        hadHiddenClass: block.classList.contains('hidden'), 
        inlineDisplay: block.style.display,
        textarea: ta,
        textareaDisplay: ta ? ta.style.display : undefined,
        hadPrintDiv: !!block.querySelector('.notes-print-value')
      });
    });
    const productNotes = document.getElementById('product-notes-display-container');
    if (productNotes) {
      states.push({ el: productNotes, hadHiddenClass: productNotes.classList.contains('hidden'), inlineDisplay: productNotes.style.display, isProductNotes:true });
    }
    return states;
  }

  function showAllNotes(){
    // Per-table notes
    qsa('.table-notes-block').forEach(block => {
      block.classList.remove('hidden');
      block.style.display = 'block';
      const ta = block.querySelector('textarea');
      if (ta){
        const display = ensureTextareaPrintView(ta);
        // Hide textarea during export to avoid double content and to ensure text is captured
        ta.style.display = 'none';
        if (display) display.style.display = 'block';
      }
    });
    // General product notes (only if it has content)
    const container = document.getElementById('product-notes-display-container');
    const body = document.getElementById('product-notes-display');
    if (container && body) {
      const hasContent = (body.textContent || body.innerText || '').trim().length > 0;
      if (hasContent) {
        container.classList.remove('hidden');
        container.style.display = 'block';
      }
    }
  }

  function restoreStates(states){
    if (!states) return;
    states.forEach(s => {
      if (s.hadHiddenClass) s.el.classList.add('hidden'); else s.el.classList.remove('hidden');
      if (typeof s.inlineDisplay === 'string') s.el.style.display = s.inlineDisplay; else s.el.style.removeProperty('display');
      if (s.textarea) {
        if (typeof s.textareaDisplay === 'string') s.textarea.style.display = s.textareaDisplay; else s.textarea.style.removeProperty('display');
        const pv = s.el.querySelector('.notes-print-value');
        if (pv && !s.hadPrintDiv) {
          // Remove the temporary print view we created
          pv.parentElement.removeChild(pv);
        }
      }
    });
  }

  function prepareForExport(){
    const states = captureStates();
    showAllNotes();
    // Small layout flush to ensure html2canvas sees updated DOM
    return new Promise(resolve => requestAnimationFrame(()=> resolve(states)));
  }

  function setupExportHook(){
    const exportBtn = document.getElementById('export-pdf');
    if (!exportBtn) return;

    // Capture phase to ensure we run before bubble listeners
    exportBtn.addEventListener('click', async function(){
      try {
        const states = await prepareForExport();
        // Attempt to auto-restore after a short delay (export usually completes by then)
        setTimeout(()=> restoreStates(states), 3000);
      } catch(e){ /* no-op */ }
    }, true);
  }

  function setupPrintHooks(){
    let states;
    window.addEventListener('beforeprint', async function(){ states = await prepareForExport(); });
    window.addEventListener('afterprint', function(){ restoreStates(states); states = undefined; });
  }

  document.addEventListener('DOMContentLoaded', function(){
    setupExportHook();
    setupPrintHooks();
  });
})();
