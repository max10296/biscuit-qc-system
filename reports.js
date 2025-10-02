(function(){
  'use strict';

  // Ensure Chart.js uses container height to avoid growth/resize issues
  if (window.Chart && Chart.defaults) {
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.responsive = true;
    Chart.defaults.resizeDelay = 100;
  }

  const state = { page: 1, limit: 20, total: 0, items: [], search: '', status: '', shift: '', dateFrom: '', dateTo: '', charts: {} };
  const $ = (sel,root=document)=> root.querySelector(sel);

  function fmtDate(ms){ if(!ms) return '-'; const d = new Date(+ms||ms); return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`; }
  function badge(status){
    const cls = status==='approved'?'approved': status==='rejected'?'rejected': status==='submitted'?'submitted':'draft';
    return `<span class="badge ${cls}">${status||'-'}</span>`;
  }

  async function load(){
    let data = [];
    let fromAPI = false;
    let apiMeta = null;
    try{
      const filters = {};
      if(state.search) filters.search = state.search;
      if(state.status) filters.status = state.status;
      if(state.shift) filters.shift = state.shift;
      if(state.dateFrom) filters.dateFrom = state.dateFrom;
      if(state.dateTo) filters.dateTo = state.dateTo;
      
      const response = await window.apiClient.getReports(filters);
      data = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
      fromAPI = true;
      apiMeta = response;
    }catch(e){
      console.error('[reports] API list failed:', e);
      data = [];
    }

    // Apply UI filters (works for both API and localStorage)
    const q = (state.search||'').trim().toLowerCase();
    if(q){
      data = data.filter(r => {
        try{
          const vals = [r.product_name, r.product_id, r.batch_no, r.shift, r.status, r.notes, r.report_date];
          return vals.some(v => String(v ?? '').toLowerCase().includes(q));
        }catch(_){ return false; }
      });
    }
    if(state.status) data = data.filter(r=> (r.status||'').toLowerCase()===state.status.toLowerCase());
    if(state.shift) data = data.filter(r=> (r.shift||'')===state.shift);
    if(state.dateFrom) data = data.filter(r=> (r.report_date||'') >= state.dateFrom);
    if(state.dateTo) data = data.filter(r=> (r.report_date||'') <= state.dateTo);

    // Sort by last updated desc if available
    data.sort((a,b)=> (b.updated_at||0) - (a.updated_at||0));

    state.total = data.length; // after filters

    if(fromAPI){
      // Assume API already paginated; keep items as-is after filtering
      state.items = data;
    } else {
      // Client-side pagination for localStorage fallback
      const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;
      const start = (state.page - 1) * state.limit;
      state.items = data.slice(start, start + state.limit);
    }

    renderTable();
    renderKpis();
    renderCharts();
  }

  function renderTable(){
    const tb = $('#reports-table tbody');
    if(!state.items.length){
      tb.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-3">No reports found</td></tr>`;
      $('#pagination-info').textContent = 'No results';
      return;
    }
    tb.innerHTML = state.items.map(r=>{
      const date = r.report_date ? (''+r.report_date).slice(0,10) : '-';
      const score = (r.score!=null && isFinite(r.score)) ? Number(r.score).toFixed(1) : '-';
      return `<tr>
        <td>${(r.product_name||r.product_id||'-')}</td>
        <td>${r.batch_no||'-'}</td>
        <td>${date}</td>
        <td>${r.shift||'-'}</td>
        <td>${badge(r.status)}</td>
        <td>${score}</td>
        <td>
          <a class="text-blue-600 hover:underline" href="index.html?product=${encodeURIComponent(r.product_id||'')}&batch=${encodeURIComponent(r.batch_no||'')}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(r.shift||'')}"><i class="fas fa-external-link-alt mr-1"></i>Open</a>
          <a class="ml-2 text-indigo-600 hover:underline" href="index.html?reportId=${encodeURIComponent(r.id)}"><i class="fas fa-upload mr-1"></i>Load</a>
          <button class="ml-2 text-green-600 hover:underline" data-approve="${r.id}"><i class="fas fa-check mr-1"></i>Approve</button>
          <button class="ml-1 text-yellow-700 hover:underline" data-reject="${r.id}"><i class="fas fa-times mr-1"></i>Reject</button>
          <button class="ml-2 text-gray-700 hover:underline" data-json="${r.id}" title="View JSON"><i class="fas fa-code mr-1"></i>JSON</button>
          <button class="ml-2 text-red-600 hover:underline" data-del="${r.id}"><i class="fas fa-trash-alt mr-1"></i>Delete</button>
        </td>
      </tr>`;
    }).join('');

    tb.querySelectorAll('[data-del]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-del');
        if(!confirm('Delete this report?')) return;
        try{
          await window.apiClient.deleteReport(id);
        }catch(e){
          console.error('[reports] API delete failed:', e);
        }
        await load();
      });
    });

    tb.querySelectorAll('[data-approve]').forEach(btn=>{
      btn.addEventListener('click', ()=> updateStatus(btn.getAttribute('data-approve'), 'approved'));
    });
    tb.querySelectorAll('[data-reject]').forEach(btn=>{
      btn.addEventListener('click', ()=> updateStatus(btn.getAttribute('data-reject'), 'rejected'));
    });
    tb.querySelectorAll('[data-json]').forEach(btn=>{
      btn.addEventListener('click', ()=> showJSON(btn.getAttribute('data-json')));
    });

    const start = (state.page - 1) * state.limit;
    const end = Math.min(start + state.items.length, state.total);
    $('#pagination-info').textContent = state.total ? `Showing ${start + 1}-${end} of ${state.total}` : 'No results';
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    const prev = $('#prev-page'), next = $('#next-page');
    if(prev) prev.disabled = state.page <= 1;
    if(next) next.disabled = state.page >= totalPages;
  }

  async function updateStatus(id, status){
    try{
      await window.apiClient.updateReport(id, { status });
    }catch(e){
      console.error('[reports] API patch failed:', e);
    }
    await load();
  }

  async function showJSON(id){
    let rec = null;
    try{
      rec = await window.apiClient.getReport(id);
    }catch(e){
      console.error('[reports] API get failed:', e);
      rec = null;
    }
    const modal = document.getElementById('json-modal');
    const pre = document.getElementById('json-pre');
    pre.textContent = JSON.stringify(rec||{}, null, 2);
    modal.classList.remove('hidden');
  }

  function renderKpis(){
    const total = state.items.length;
    const approved = state.items.filter(x=> x.status==='approved').length;
    const rejected = state.items.filter(x=> x.status==='rejected').length;
    const scores = state.items.map(x=> typeof x.score==='number'?x.score:null).filter(x=> x!=null);
    const avg = scores.length? (scores.reduce((a,b)=>a+b,0)/scores.length) : 0;

    $('#kpi-total').textContent = total;
    $('#kpi-approved').textContent = approved;
    $('#kpi-rejected').textContent = rejected;
    $('#kpi-avg-score').textContent = avg.toFixed(1);
  }

  function groupBy(arr, key){
    const m = new Map();
    arr.forEach(r=>{ const k = r[key]||'-'; m.set(k, (m.get(k)||[]).concat([r])); });
    return m;
  }

  function renderCharts(){
    // Status chart
    const ctx1 = $('#chart-status');
    if(ctx1){ const g = groupBy(state.items,'status'); const labels = Array.from(g.keys()); const vals = labels.map(k=> g.get(k).length);
      drawChart('status', ctx1, { type:'doughnut', labels, data: vals, bg: ['#22c55e','#ef4444','#3b82f6','#9ca3af'] }); }
    // Avg score by product
    const ctx2 = $('#chart-score');
    if(ctx2){ const g = groupBy(state.items,'product_name'); const labels = Array.from(g.keys()); const vals = labels.map(k=>{
        const arr = g.get(k).map(r=> r.score).filter(x=> typeof x==='number');
        return arr.length? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
      });
      drawChart('score', ctx2, { type:'bar', labels, data: vals, bg: '#6366f1' }); }
    // Defects by product
    const ctx3 = $('#chart-defects');
    if(ctx3){ const g = groupBy(state.items,'product_name'); const labels = Array.from(g.keys()); const vals = labels.map(k=>{
        const arr = g.get(k).map(r=> r.defects_count||0);
        return arr.reduce((a,b)=>a+b,0);
      });
      drawChart('defects', ctx3, { type:'bar', labels, data: vals, bg: '#f59e0b' }); }
    // By shift
    const ctx4 = $('#chart-shift');
    if(ctx4){ const g = groupBy(state.items,'shift'); const labels = Array.from(g.keys()); const vals = labels.map(k=> g.get(k).length);
      drawChart('shift', ctx4, { type:'pie', labels, data: vals, bg: ['#10b981','#60a5fa'] }); }
  }

  function drawChart(key, canvas, cfg){
    if(!window._charts) window._charts = {};
    if(window._charts[key]){ window._charts[key].destroy(); }
    const data = { labels: cfg.labels, datasets: [{ label: cfg.label||'', data: cfg.data, backgroundColor: cfg.bg }] };
    const options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, resizeDelay: 100, plugins: { legend: { position: 'bottom' } } }, cfg.options||{});
    const ctx = canvas.getContext ? canvas.getContext('2d') : canvas;
    window._charts[key] = new Chart(ctx, { type: cfg.type, data, options });
  }

  function wire(){
    const u = new URL(location.href);
    const qProduct = u.searchParams.get('product')||'';
    const qBatch = u.searchParams.get('batch')||'';
    const qSearch = [qProduct,qBatch].filter(Boolean).join(' ');
    if(qSearch){ $('#search').value = qSearch; state.search = qSearch; }

    $('#search').addEventListener('input', debounce(()=>{ state.search = $('#search').value.trim(); load(); },300));
    $('#filter-status').addEventListener('change', ()=>{ state.status = $('#filter-status').value; load(); });
    $('#filter-shift').addEventListener('change', ()=>{ state.shift = $('#filter-shift').value; load(); });
    $('#date-from').addEventListener('change', ()=>{ state.dateFrom = $('#date-from').value; load(); });
    $('#date-to').addEventListener('change', ()=>{ state.dateTo = $('#date-to').value; load(); });

    $('#btn-refresh').addEventListener('click', load);

    $('#prev-page').addEventListener('click', ()=>{ if(state.page>1){ state.page--; load(); } });
    $('#next-page').addEventListener('click', ()=>{ state.page++; load(); });

    $('#btn-export-csv').addEventListener('click', exportCSV);
    $('#btn-export-pdf').addEventListener('click', exportPDF);

    const resetBtn = $('#btn-reset');
    if(resetBtn){
      resetBtn.addEventListener('click', ()=>{
        $('#search').value = '';
        $('#filter-status').value = '';
        $('#filter-shift').value = '';
        $('#date-from').value = '';
        $('#date-to').value = '';
        state.search = '';
        state.status = '';
        state.shift = '';
        state.dateFrom = '';
        state.dateTo = '';
        state.page = 1;
        load();
      });
    }
  }

  function exportCSV(){
    const rows = [ ['Product','Batch','Date','Shift','Status','Score'] ].concat(
      state.items.map(r=> [r.product_name||r.product_id||'', r.batch_no||'', (r.report_date||'').slice(0,10), r.shift||'', r.status||'', r.score??''])
    );
    const csv = rows.map(r=> r.map(v=> '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'reports.csv'; a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
  }

  async function exportPDF(){
    // Simple print of current dashboard using print dialog
    window.print();
    try{ window.AppUtil?.toast('ok','PDF Exported','Use your browser dialog to save.'); }catch(_){ }
  }

  function debounce(fn,ms){ let t; return function(){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,arguments),ms); }; }
  // simple toast hook if available
  function toast(type,title,msg){ try{ window.AppUtil?.toast(type,title,msg); }catch(_){} }

  // Avoid memory leaks on SPA-like navigation
  window.addEventListener('beforeunload', ()=>{
    if(window._charts){ Object.values(window._charts).forEach(ch=>{ try{ ch.destroy(); }catch(_){} }); }
  });

  document.addEventListener('DOMContentLoaded', ()=>{ wire(); load(); });
})();
