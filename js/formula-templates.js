/*
AI Formula Templates Manager
- Robust JSON/JS parsing for AI-provided templates
- Schema validation and normalization
- Safe-ish compute compilation with utility helpers
- LocalStorage persistence
- Interactive test UI + LaTeX rendering via MathJax (if present)

Expected template shape (JSON):
{
  "id": "poisson",
  "name": "Poisson Distribution PMF",
  "latex": "P(X=k)=\\frac{e^{-\\lambda}\\,\\lambda^{k}}{k!}",
  "variables": [
    {"name":"lambda","label":"Average defects (λ)"},
    {"name":"k","label":"Observed defects (k)"}
  ],
  "compute": "(vars,util)=> Math.exp(-vars.lambda)*Math.pow(vars.lambda, vars.k)/util.factorial(vars.k)"
}

Notes:
- If AI returns a JS object literal (not strict JSON), we also accept it by safely evaluating as data.
- If AI returns compute as a function (not string), we serialize it to string for storage.
*/
(function(){
  'use strict';

  if (window.__FormulaTemplatesInitDone) return; // avoid double init if file loaded twice
  window.__FormulaTemplatesInitDone = true;

  const STORAGE_KEY = 'formulas.templates.v1';

  function getEl(id){ return document.getElementById(id); }

  function notify(msg, type='info'){
    try {
      const n = getEl('notification');
      if (!n) return;
      n.textContent = msg;
      n.className = 'notification ' + (type==='error'?'bg-red-100 text-red-700':'bg-green-100 text-green-700');
      n.style.display = 'block';
      setTimeout(()=>{ n.style.display='none'; }, 3000);
    } catch(e){}
  }

  function slugify(text){
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')
      || 'formula-' + Math.random().toString(36).slice(2,8);
  }

  function loadTemplates(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch(e){ return []; }
  }
  function saveTemplates(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // Utility helpers available to compute()
  const util = {
    clamp:(x,min,max)=> Math.max(min, Math.min(max, x)),
    round:(x,dec=3)=> Math.round((+x + Number.EPSILON) * Math.pow(10,dec))/Math.pow(10,dec),
    sum: arr => arr.reduce((a,b)=>a+(+b||0),0),
    mean: arr => arr.length ? arr.reduce((a,b)=>a+(+b||0),0)/arr.length : 0,
    stddev: arr => {
      const m = util.mean(arr);
      const v = arr.length ? util.mean(arr.map(x=>Math.pow((+x||0)-m,2))) : 0;
      return Math.sqrt(v);
    },
    factorial: (n) => {
      n = Math.floor(+n);
      if (n<0) return NaN;
      let r=1; for (let i=2;i<=n;i++) r*=i; return r;
    },
    // Approximation of gamma using Lanczos
    gamma: (z) => {
      const g = 7;
      const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
      if(z < 0.5) return Math.PI / (Math.sin(Math.PI*z) * util.gamma(1-z));
      z -= 1;
      let x = p[0];
      for (let i=1;i<g+2;i++) x += p[i] / (z + i);
      const t = z + g + 0.5;
      return Math.sqrt(2*Math.PI) * Math.pow(t, z+0.5) * Math.exp(-t) * x;
    },
    erf: (x) => {
      // Abramowitz and Stegun approximation
      const sign = x < 0 ? -1 : 1; x = Math.abs(x);
      const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
      const t = 1/(1+p*x);
      const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
      return sign*y;
    }
  };

  function compileCompute(compute){
    // Accepts: string with arrow/function OR actual function
    if (typeof compute === 'function') return compute;
    if (typeof compute !== 'string' || !compute.trim()) {
      throw new Error('compute must be a non-empty string or function');
    }
    // Build function from string without polluting scope
    const fn = new Function('return (' + compute + ')')();
    if (typeof fn !== 'function') throw new Error('compute did not evaluate to a function');
    return fn;
  }

  function normalizeVariables(vars){
    if (!Array.isArray(vars)) return [];
    return vars.map(v=>{
      const name = slugify(v && (v.name || v.key || v.id || 'var'));
      const label = (v && (v.label || v.title)) || name;
      const type = (v && v.type) || 'number';
      return { name, label, type };
    });
  }

  function validateTemplate(t){
    if (!t || typeof t !== 'object') throw new Error('Template must be an object');
    const out = {};
    out.name = String(t.name || 'Untitled Formula').trim();
    out.id = slugify(t.id || out.name);
    out.latex = typeof t.latex === 'string' ? t.latex : '';
    out.variables = normalizeVariables(t.variables || []);
    if (!out.variables.length) {
      // Best-effort: infer variable names by scanning compute string for vars.X
      if (typeof t.compute === 'string') {
        const m = t.compute.match(/vars\.([a-zA-Z0-9_]+)/g) || [];
        const uniq = Array.from(new Set(m.map(s=>s.split('.')[1])));
        out.variables = uniq.map(n=>({name:n,label:n,type:'number'}));
      }
    }
    out.compute = t.compute;
    // Sanity compile test
    try { compileCompute(out.compute); } catch(e){ throw new Error('Invalid compute: ' + e.message); }
    return out;
  }

  function parseAiInput(text){
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error('Input is empty');
    // First, try strict JSON
    try {
      return JSON.parse(trimmed);
    } catch(jsonErr){
      // Try to accept common JS object literal (non-JSON) from AI
      try {
        // Replace smart quotes
        const fixed = trimmed
          .replace(/[“”]/g,'"')
          .replace(/[‘’]/g, "'");
        // If it looks like an object literal without export/var
        const wrapped = fixed.startsWith('{') || fixed.startsWith('(') ? fixed : '('+fixed+')';
        const obj = new Function('return ' + wrapped)();
        return obj;
      } catch(jsErr){
        throw new Error('Invalid JSON/JS object. JSON error: ' + jsonErr.message + ' | JS parse error: ' + jsErr.message);
      }
    }
  }

  function renderTemplatesList(){
    const listEl = getEl('templates-list');
    if (!listEl) return;
    const templates = loadTemplates();
    listEl.innerHTML = '';
    if (!templates.length){
      listEl.innerHTML = '<div class="text-gray-500 text-xs">No templates yet. Import one using the form on the left.</div>';
      return;
    }
    templates.forEach(t=>{
      const item = document.createElement('div');
      item.className = 'p-2 border rounded flex items-center justify-between';
      item.innerHTML = `
        <div>
          <div class="font-semibold">${escapeHtml(t.name)}</div>
          <div class="text-xs text-gray-500">ID: ${escapeHtml(t.id)} | Vars: ${t.variables.length}</div>
        </div>
        <div class="space-x-2">
          <button class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs view-btn">View</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded text-xs delete-btn">Delete</button>
        </div>`;
      item.querySelector('.view-btn').addEventListener('click',()=>showTemplateDetails(t.id));
      item.querySelector('.delete-btn').addEventListener('click',()=>deleteTemplate(t.id));
      listEl.appendChild(item);
    });
  }

  function deleteTemplate(id){
    const templates = loadTemplates();
    const idx = templates.findIndex(x=>x.id===id);
    if (idx>=0){
      templates.splice(idx,1);
      saveTemplates(templates);
      renderTemplatesList();
      const details = getEl('template-details');
      if (details) details.style.display='none';
      notify('Template deleted');
    }
  }

  function showTemplateDetails(id){
    const details = getEl('template-details');
    if (!details) return;
    const t = loadTemplates().find(x=>x.id===id);
    if (!t){ details.style.display='none'; return; }
    details.style.display='block';

    // Build variable input controls
    const varsHtml = t.variables.map(v=>`
      <label class="block text-xs mb-1">${escapeHtml(v.label)} (${escapeHtml(v.name)})</label>
      <input type="number" step="any" data-var="${escapeHtml(v.name)}" class="border p-1 rounded w-full mb-2" />
    `).join('');

    const latexBlock = t.latex ? `<div class="mt-2 p-2 bg-gray-50 border rounded text-sm">$${t.latex}$</div>` : '';

    details.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-lg font-bold">${escapeHtml(t.name)}</div>
          <div class="text-xs text-gray-500">ID: ${escapeHtml(t.id)}</div>
        </div>
        <div class="space-x-2">
          <button id="export-tpl" class="bg-purple-600 text-white px-2 py-1 rounded text-xs">Export JSON</button>
        </div>
      </div>
      ${latexBlock}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div>
          <h4 class="font-semibold mb-2">Variables</h4>
          ${varsHtml || '<div class="text-xs text-gray-500">No variables detected.</div>'}
        </div>
        <div>
          <h4 class="font-semibold mb-2">Evaluate</h4>
          <button id="run-compute" class="bg-blue-600 text-white px-3 py-1 rounded text-xs">Compute</button>
          <div id="compute-result" class="mt-2 p-2 bg-white border rounded text-sm"></div>
        </div>
      </div>
    `;

    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([details]).catch(()=>{});
    }

    details.querySelector('#run-compute')?.addEventListener('click',()=>{
      try {
        const inputs = details.querySelectorAll('[data-var]');
        const vars = {};
        inputs.forEach(inp=>{ const n=inp.getAttribute('data-var'); vars[n] = parseFloat(inp.value); });
        const fn = compileCompute(t.compute);
        const val = fn(vars, util);
        details.querySelector('#compute-result').textContent = typeof val === 'object' ? JSON.stringify(val) : String(val);
      } catch(e){
        details.querySelector('#compute-result').textContent = 'Error: ' + e.message;
      }
    });

    details.querySelector('#export-tpl')?.addEventListener('click',()=>{
      const json = JSON.stringify(t, null, 2);
      copyToClipboard(json).then(()=>notify('Template JSON copied to clipboard')).catch(()=>{});
    });
  }

  function copyToClipboard(text){
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback
    return new Promise((resolve,reject)=>{
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand('copy'); resolve(); } catch(e){ reject(e); }
      finally { document.body.removeChild(ta); }
    });
  }

  function getStandardPrompt(){
    return (
`You are creating a single formula template to be used inside a Quality Control web app. Return STRICT JSON only, no markdown, with this exact shape:
{
  "id": "a-short-id-with-kebab-case",
  "name": "Human readable formula name",
  "latex": "A concise LaTeX representation (escape backslashes)",
  "variables": [
    {"name":"var1","label":"Label for var1"},
    {"name":"var2","label":"Label for var2"}
  ],
  "compute": "(vars,util)=> /* return a number or object; use vars.var1 etc. You may call util.factorial, util.gamma, util.mean, util.stddev, util.erf, util.clamp, util.round */ 0"
}
Rules:
- compute MUST be a single JavaScript arrow function AS A STRING. Do not include comments outside JSON. Do not include trailing commas.`
    );
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
  }

  function initUI(){
    const copyBtn = getEl('copy-ai-prompt');
    const importBtn = getEl('import-ai-template');
    const input = getEl('ai-template-input');

    if (copyBtn){
      copyBtn.addEventListener('click', ()=>{
        const prompt = getStandardPrompt();
        copyToClipboard(prompt)
          .then(()=>{
            if (input) input.value = prompt;
            notify('Standard AI prompt copied');
          })
          .catch(()=>{});
      });
    }

    if (importBtn && input){
      importBtn.addEventListener('click', ()=>{
        try {
          const rawObj = parseAiInput(input.value);

          // If compute provided as function, convert to string
          if (typeof rawObj.compute === 'function') {
            rawObj.compute = rawObj.compute.toString();
          }

          const normalized = validateTemplate(rawObj);
          // Ensure unique id
          const templates = loadTemplates();
          if (templates.some(x=>x.id===normalized.id)){
            // append small suffix
            normalized.id = normalized.id + '-' + Math.random().toString(36).slice(2,6);
          }
          templates.push(normalized);
          saveTemplates(templates);
          renderTemplatesList();
          showTemplateDetails(normalized.id);
          notify('Template imported successfully');
        } catch(e){
          notify(e.message, 'error');
        }
      });
    }

    renderTemplatesList();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
