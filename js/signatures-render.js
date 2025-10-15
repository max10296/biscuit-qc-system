(function(){
  'use strict';

  const $ = (sel, root=document)=> root.querySelector(sel);

  function getVisibleSignatures(){
    if (typeof window.getProductSignatures === 'function'){
      try { return window.getProductSignatures() || []; } catch(_){}
    }
    // Fallback defaults
    return [
      { id:'sig1', label:'Quality Engineer', visible:true, order:1, showName:true, showDate:true },
      { id:'sig2', label:'Production Supervisor', visible:true, order:2, showName:true, showDate:true },
      { id:'sig3', label:'Quality Manager', visible:true, order:3, showName:true, showDate:true }
    ];
  }

  function render(){
    const grid = $('#signature-grid');
    if (!grid) return;
    const sigs = getVisibleSignatures().filter(s=> s.visible !== false).sort((a,b)=> (a.order||0)-(b.order||0));
    grid.innerHTML = '';
    if (sigs.length === 0){
      grid.innerHTML = '<div style="text-align:center; color:#6b7280;">No signatures configured for this product.</div>';
      return;
    }
    sigs.forEach(sig=>{
      const cell = document.createElement('div');
      cell.className = 'signature-cell';
      const showName = sig.showName !== false;
      const showDate = sig.showDate !== false;
      cell.innerHTML = `
        <div class="signature-line"></div>
        <div class="signature-role">${escapeHtml(sig.label || 'Signature')}</div>
        <div class="signature-meta">
          ${showName ? '<span>Name: __________</span>' : ''}
          ${showName && showDate ? '<span>|</span>' : ''}
          ${showDate ? '<span>Date: __________</span>' : ''}
        </div>
      `;
      grid.appendChild(cell);
    });
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"]/g, s=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  }

  function init(){
    render();
    // Re-render when product changes
    const productSel = document.getElementById('product-name');
    if (productSel){ productSel.addEventListener('change', render); }
    // When signatures updated from modal
    window.addEventListener('signatures-updated', render);
    // Before print ensure content is up to date
    window.addEventListener('beforeprint', render);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
