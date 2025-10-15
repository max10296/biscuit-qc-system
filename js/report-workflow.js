(function(){
  'use strict';

  function $(sel, root=document){ return root.querySelector(sel); }
  function gatherFormBasics(){
    const productSel = $('#product-name');
    const product_id = productSel && productSel.value || '';
    const product_name = (productSel && productSel.options[productSel.selectedIndex] && productSel.options[productSel.selectedIndex].text) || '';
    const report_date = $('#report-date')?.value || '';
    const batch_no = $('#batch-number')?.value || '';
    const shift = $('#shift')?.value || '';
    const shift_duration = parseInt($('#shift-duration')?.value || '8',10);
    const start_time = $('#start-inspection-time')?.value || '';
    return { product_id, product_name, report_date, batch_no, shift, shift_duration, start_time };
  }

  function genId(){ try{ return crypto.randomUUID(); }catch(_){ return 'local_'+Math.random().toString(36).slice(2); } }

  function saveLocalReport(payload){
    const list = JSON.parse(localStorage.getItem('reportsLocal')||'[]');
    const rec = { id: genId(), ...payload, created_at: Date.now(), updated_at: Date.now(), gs_table_name:'reports' };
    list.push(rec);
    localStorage.setItem('reportsLocal', JSON.stringify(list));
    return rec;
  }

  async function createReport(payload){
    try{
      if (window.apiClient && typeof window.apiClient.createReport === 'function'){
        return await window.apiClient.createReport(payload);
      }
      const res = await fetch('/api/reports',{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(payload)
      });
      if(!res.ok){
        const txt = await res.text().catch(()=> '');
        throw new Error('Failed to save report: '+res.status+' '+txt);
      }
      return await res.json();
    } catch(e){
      console.warn('[reports] API save failed, using localStorage fallback:', e);
      return saveLocalReport(payload);
    }
  }

  function computeOverallScore(){
    // Hook point: compute a simple score from visible inputs if available
    // For now return null; other modules can update this via custom logic
    return null;
  }

  function buildSnapshot(){
    // Collect minimal snapshot to restore context on reports page
    const basics = gatherFormBasics();
    const notes = document.getElementById('product-notes-display')?.textContent || '';
    // Collect table notes summary (be tolerant if table-notes module didn't load)
    let tableNotes = [];
    try {
      tableNotes = Array.from(document.querySelectorAll('.table-notes-block textarea')).map(t=>({ key: t.closest('.table-notes-block')?.getAttribute('data-notes-key')||'', value: t.value||'' }));
    } catch(_) { tableNotes = []; }
    return { basics, notes, tableNotes };
  }

  async function saveReport(){
    try{
      const basics = gatherFormBasics();
      const score = computeOverallScore();
      const defects_count = null; // optional
      const status = 'submitted'; // default; could be changed by app logic
      const data = buildSnapshot();
      const payload = { ...basics, status, score, defects_count, notes: data.notes, form_data: data, pallets: collectPallets() };
      const rec = await createReport(payload);
      notify('Saved to Reports');
      // Navigate with context
      const u = new URL('reports.html', location.href);
      u.searchParams.set('batch', basics.batch_no || '');
      u.searchParams.set('product', basics.product_id || basics.product_name || '');
      location.href = u.toString();
    }catch(e){ console.error(e); notify('Save failed','error'); }
  }

  // --- Restore from reportId (deep-link from reports.html) ---
  async function restoreFromReportId(){
    const u = new URL(location.href);
    const id = u.searchParams.get('reportId');
    if(!id) return;
    try{
      let rec = null;
      if (window.apiClient && typeof window.apiClient.getReport === 'function'){
        rec = await window.apiClient.getReport(id);
      } else {
        const res = await fetch(`/api/reports/${id}`);
        if(!res.ok) throw new Error('Report not found');
        rec = await res.json();
      }
      await applyBasics(rec);
      await applySnapshot(rec);
      notify('Report loaded');
    }catch(e){ console.error(e); notify('Failed to load report','error'); }
  }

  async function applyBasics(rec){
    // Wait for product options to be ready (if populated async)
    await waitFor(()=> document.getElementById('product-name'));
    const productSel = document.getElementById('product-name');
    if(rec.product_id && productSel){
      // Try a few times in case options load late
      for(let i=0;i<20;i++){
        productSel.value = rec.product_id;
        if(productSel.value===rec.product_id) break;
        await delay(250);
      }
      productSel.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const setVal = (id,val)=>{ const el=document.getElementById(id); if(el){ el.value = val ?? el.value; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } };
    setVal('report-date', (rec.report_date||'').slice(0,10));
    setVal('batch-number', rec.batch_no||'');
    setVal('shift', rec.shift||'');
    if(rec.shift_duration!=null) setVal('shift-duration', String(rec.shift_duration));
    setVal('start-inspection-time', rec.start_time||'');
  }

  async function applySnapshot(rec){
    let snap = null;
    try{
      if (rec.form_data){
        if (typeof rec.form_data === 'string') { try{ snap = JSON.parse(rec.form_data); }catch(_){ snap = null; } }
        else { snap = rec.form_data; }
      } else if (rec.data){
        snap = typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data;
      }
    }catch(_){ snap = null; }
    if(!snap) return;
    // Product notes display area
    const disp = document.getElementById('product-notes-display');
    const cont = document.getElementById('product-notes-display-container');
    if(disp){ disp.textContent = snap.notes || ''; }
    if(cont && (snap.notes||'').trim()){ cont.style.display = ''; }

    // Apply table notes after tables render
    if(Array.isArray(snap.tableNotes)){
      for(let attempt=0; attempt<20; attempt++){
        let applied = 0;
        snap.tableNotes.forEach(n=>{
          const block = document.querySelector(`.table-notes-block[data-notes-key="${CSS.escape(n.key)}"] textarea`);
          if(block){ block.value = n.value||''; block.dispatchEvent(new Event('input',{bubbles:true})); applied++; }
        });
        if(applied===snap.tableNotes.length) break; // all set
        await delay(500);
      }
    }
  }

  function delay(ms){ return new Promise(r=> setTimeout(r, ms)); }
  async function waitFor(fn, timeout=8000){ const t0=Date.now(); while(true){ const v = fn(); if(v) return v; if(Date.now()-t0>timeout) return null; await delay(150); } }

  function notify(msg,type){
    const el = document.getElementById('notification') || (function(){
      const d=document.createElement('div'); d.id='notification'; d.style.position='fixed'; d.style.bottom='16px'; d.style.right='16px'; d.style.background='#111827'; d.style.color='#fff'; d.style.padding='8px 12px'; d.style.borderRadius='6px'; d.style.zIndex='9999'; document.body.appendChild(d); return d; })();
    el.textContent = msg; el.style.background = type==='error' ? '#b91c1c' : '#111827';
    el.style.display='block'; setTimeout(()=>{ el.style.display='none'; }, 2000);
  }

  document.addEventListener('DOMContentLoaded', function(){
    // Wire existing button if present
    const directBtn = document.getElementById('save-to-reports');
    if(directBtn && !directBtn.dataset.reportsWired){
      directBtn.dataset.reportsWired = '1';
      directBtn.addEventListener('click', saveReport);
    } else {
      // Fallback: inject next to legacy save button if exists
      const saveBtn = document.getElementById('save-data');
      if(saveBtn && !saveBtn.dataset.reportsWired){
        saveBtn.dataset.reportsWired = '1';
        const wrap = document.createElement('div');
        wrap.className = 'inline-flex ml-2';
        const btn = document.createElement('button');
        btn.id = 'save-to-reports';
        btn.className = 'bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700';
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt mr-1"></i>Save to Reports';
        wrap.appendChild(btn);
        saveBtn.parentElement && saveBtn.parentElement.appendChild(wrap);
        btn.addEventListener('click', saveReport);
      }
    }
    // Listen to global event bridge from legacy script.js if present
    window.addEventListener('requestSaveToReports', saveReport);
    // Try restore
    restoreFromReportId();
  });
})();
