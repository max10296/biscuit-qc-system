(function(){
  'use strict';

  const PANEL_ID = 'genius-test-panel';
  const HIDDEN_CLASS = 'hidden';

  function init(){
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    buildPanel();
    document.addEventListener('keydown', handleKeydown, true);
  }

  function buildPanel(){
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.className = `${HIDDEN_CLASS}`;
    panel.innerHTML = `
      <header>
        <span class="title"><i class="fas fa-flask mr-1"></i>Genius Test Toolkit</span>
        <button type="button" data-gt-action="close" title="Close"><i class="fas fa-times"></i></button>
      </header>
      <section class="body">
        <button type="button" data-gt-action="fill-active"><i class="fas fa-magic mr-2"></i>Autofill Active Time Column</button>
        <button type="button" data-gt-action="scroll-active"><i class="fas fa-location-arrow mr-2"></i>Scroll to Active Slot</button>
        <button type="button" data-gt-action="toggle-debug"><i class="fas fa-bug mr-2"></i>Toggle Debug Logs</button>
        <button type="button" data-gt-action="clear-storage"><i class="fas fa-broom mr-2"></i>Clear Product Storage</button>
        <button type="button" data-gt-action="diagnostics"><i class="fas fa-clipboard-list mr-2"></i>Dump Diagnostics to Console</button>
      </section>
      <footer>Press <strong>Ctrl + Shift + G</strong> to toggle. <a href="#" data-gt-action="help">Help</a></footer>
    `;

    document.body.appendChild(panel);

    panel.addEventListener('click', e => {
      const btn = e.target.closest('[data-gt-action]');
      if (!btn) return;
      const action = btn.dataset.gtAction;
      if (action === 'close') { hidePanel(); }
      if (action === 'fill-active') { fillActiveColumn(); }
      if (action === 'scroll-active') { scrollToActiveColumn(); }
      if (action === 'toggle-debug') { toggleDebug(); }
      if (action === 'clear-storage') { clearProductStorage(); }
      if (action === 'diagnostics') { dumpDiagnostics(); }
      if (action === 'help') { e.preventDefault(); showHelp(); }
    });
  }

  function handleKeydown(event){
    if (event.key === 'Escape') {
      hidePanel();
      return;
    }
    if (event.key?.toLowerCase() === 'g' && event.shiftKey && (event.ctrlKey || event.metaKey)){
      event.preventDefault();
      togglePanel();
    }
  }

  function togglePanel(){
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.toggle(HIDDEN_CLASS);
    if (!panel.classList.contains(HIDDEN_CLASS)) {
      panel.focus({ preventScroll: true });
    }
  }

  function hidePanel(){
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.add(HIDDEN_CLASS);
  }

  function toast(message, type='info'){
    if (window.AppUtil && typeof window.AppUtil.toast === 'function'){
      window.AppUtil.toast(type, 'Genius Toolkit', message);
    } else {
      console.log(`[Genius Toolkit] ${message}`);
    }
  }

  function fillActiveColumn(){
    const tables = Array.from(document.querySelectorAll('table[data-table-id]'));
    let touched = 0;
    tables.forEach(table => {
      const header = table.querySelector('th.time-slot-active');
      if (!header) return;
      const columnIndex = header.cellIndex;
      const tbody = table.tBodies[0];
      if (!tbody) return;

      Array.from(tbody.rows).forEach(row => {
        const cell = row.cells[columnIndex];
        if (!cell) return;
        const inputs = cell.querySelectorAll('input:not([readonly]):not([disabled]), select');
        if (inputs.length === 0) return;
        cell.classList.add('genius-flash');
        setTimeout(() => cell.classList.remove('genius-flash'), 800);
        inputs.forEach(input => populateInput(input));
      });
      touched++;
    });

    toast(touched ? `Filled ${touched} table column${touched>1?'s':''}.` : 'No active time column detected.', touched ? 'success' : 'warning');
  }

  function populateInput(input){
    if (input.tagName === 'SELECT') {
      const opts = Array.from(input.options).filter(opt => opt.value !== '');
      if (opts.length) {
        const choice = opts[Math.floor(Math.random() * opts.length)];
        input.value = choice.value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }

    if (input.type === 'radio'){
      input.checked = input.value?.toLowerCase().includes('ok');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (input.type === 'checkbox') {
      input.checked = Math.random() > 0.3;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (input.type === 'number') {
      const min = parseFloat(input.dataset.min);
      const max = parseFloat(input.dataset.max);
      let value;
      if (Number.isFinite(min) && Number.isFinite(max) && max > min){
        const decimals = input.step && input.step !== 'any' ? (input.step.includes('.') ? input.step.split('.')[1].length : 0) : 1;
        const raw = min + Math.random() * (max - min);
        value = raw.toFixed(decimals);
      } else {
        value = (Math.random() * 20 + 5).toFixed(2);
      }
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    if (input.type === 'text') {
      input.value = 'OK';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }

  function scrollToActiveColumn(){
    const header = document.querySelector('th.time-slot-active');
    if (!header){
      toast('No active time slot at the moment.', 'warning');
      return;
    }
    header.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    header.classList.add('genius-flash');
    setTimeout(() => header.classList.remove('genius-flash'), 1000);
  }

  function toggleDebug(){
    window.DEBUG = !window.DEBUG;
    toast(`Debug logging ${window.DEBUG ? 'enabled' : 'disabled'}.`, 'info');
  }

  function clearProductStorage(){
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i);
        if (/^biscuit/i.test(key) || /^tableNotes\|/i.test(key) || /^product_/i.test(key)){
          keys.push(key);
        }
      }
      keys.forEach(key => localStorage.removeItem(key));
      toast(`Cleared ${keys.length} stored entries.`, 'success');
    } catch(e){
      toast('Unable to clear storage: ' + e.message, 'error');
    }
  }

  function dumpDiagnostics(){
    const tables = Array.from(document.querySelectorAll('table[data-table-id]'));
    const notes = Array.from(document.querySelectorAll('.table-notes-block textarea'));
    const payload = {
      timestamp: new Date().toISOString(),
      productId: document.getElementById('product-name')?.value || '',
      tables: tables.map(tbl => ({ id: tbl.getAttribute('data-table-id'), activeSlot: tbl.dataset.activeTimeSlot || null })),
      notesKeys: notes.map(n => ({ key: n.closest('.table-notes-block')?.dataset.notesKey, preview: (n.value || '').slice(0, 80) }))
    };
    console.group('[Genius Toolkit] Diagnostics');
    console.log(payload);
    console.groupEnd();
    toast('Diagnostics dumped to console.', 'info');
  }

  function showHelp(){
    const msg = `Genius Toolkit shortcuts:\n\n• Ctrl + Shift + G — Toggle panel\n• Autofill Active Time Column — populates numeric inputs for quick testing\n• Scroll to Active Slot — jumps to highlighted inspection column\n• Toggle Debug Logs — flips window.DEBUG flag\n• Clear Product Storage — removes locally stored product configuration & notes\n• Dump Diagnostics — prints product summary to console`;
    alert(msg);
  }

  init();
})();
