/* AI Table Engine - renders configurable calculation tables with computed columns, conditionals, and cell merging.
   Features:
   - Columns support: key, label, type ('number' | 'select' | 'text'), required, min, max, step, decimals, placeholder, default
   - Computed columns via `compute` expression that can reference cols.<key>
   - Conditional formatting per column via [{ when: "expression", addClass: "...", style: { ... } }]
   - Header rows via headerRows: [ [ { label, colspan, rowspan } ] , ...]
   - Sections: [ { title, rows } ] to insert section header rows and allocate row counts
   - Merges: optional merges: [ { row, col, rowspan, colspan } ] for tbody cell merging (0-based, after section header rows)
   - Robust JSON import: parseRelaxedJSON() accepts ( ... ), stray commas, and markdown escapes like \[ \] and \_ .
*/

(function(){
  const DEBUG = !!(window.DEBUG ?? false);

  function log(...args){ if(DEBUG) console.log('[AI-Table]',...args); }
  function err(...args){ console.error('[AI-Table]',...args); }

  // Utilities exposed to expressions
  const util = {
    sum: (arr)=> arr.reduce((a,b)=> a + (Number(b)||0), 0),
    avg: (arr)=> { const nums = arr.map(v=> Number(v)).filter(v=> !isNaN(v)); return nums.length ? (nums.reduce((a,b)=> a+b, 0) / nums.length) : 0; },
    min: (arr)=> Math.min(...arr.map(v=> Number(v)||0)),
    max: (arr)=> Math.max(...arr.map(v=> Number(v)||0)),
    round: (v, d = 0)=> { const n = Number(v); if (isNaN(n)) return NaN; const f = Math.pow(10, d); return Math.round(n * f) / f; },
    clamp: (v, min, max)=> Math.max(min, Math.min(max, v)),
  };

  // Relaxed JSON to strict JSON
  function parseRelaxedJSON(input){
    if(typeof input !== 'string') return input;
    let s = input.trim();

    // Remove wrapping parentheses e.g. ( { ... } )
    if(s.startsWith('(') && s.endsWith(')')){
      s = s.substring(1, s.length - 1).trim();
    }

    // Some users paste with leading and trailing backticks or code fences
    s = s.replace(/^```[a-zA-Z]*\n?|```$/g, '').trim();

    // Undo common markdown escapes: \[ \] \_
    s = s.replace(/\\([\[\]_])/g, '$1');

    // Remove trailing commas before } or ]
    s = s.replace(/,\s*([\]}])/g, '$1');

    // Ensure keys are quoted (best-effort for simple identifiers)
    // Only apply where a key is followed by : and is unquoted
    s = s.replace(/([\[,{\s])([a-zA-Z_][a-zA-Z0-9_\-]*)\s*:/g, (m, p1, p2)=> `${p1}"${p2}":`);

    return JSON.parse(s);
  }

  function compileExpression(expr){
    if(!expr || typeof expr !== 'string') return null;
    try{
      // Allow short helpers without util. prefix
      const wrapped = expr
        .replace(/\bavg\s*\(/g, 'util.avg(')
        .replace(/\bsum\s*\(/g, 'util.sum(')
        .replace(/\bmin\s*\(/g, 'util.min(')
        .replace(/\bmax\s*\(/g, 'util.max(')
        .replace(/\bround\s*\(/g, 'util.round(')
        .replace(/\bclamp\s*\(/g, 'util.clamp(');

      // cols: object of current row values, value: for condition; rowIndex provided
      // eslint-disable-next-line no-new-func
      const fn = new Function('cols','value','rowIndex','util', `try { return (${wrapped}); } catch (e) { return NaN; }`);
      return (cols, value, rowIndex)=> fn(cols, value, rowIndex, util);
    }catch(e){
      err('Failed to compile expression:', expr, e);
      return null;
    }
  }

  function formatNumber(v, decimals){
    const n = Number(v);
    if(isNaN(n)) return '';
    if(typeof decimals === 'number') return n.toFixed(decimals);
    return String(n);
  }

  function buildTable(config){
    const table = document.createElement('table');
    table.className = 'form-table ai-table' + (config.borders ? ' borders' : '');

    // Build thead
    const thead = document.createElement('thead');
    if(Array.isArray(config.headerRows) && config.headerRows.length){
      config.headerRows.forEach(row=>{
        const tr = document.createElement('tr');
        row.forEach(cell=>{
          const th = document.createElement('th');
          th.textContent = cell.label ?? '';
          if(cell.colspan) th.colSpan = cell.colspan;
          if(cell.rowspan) th.rowSpan = cell.rowspan;
          tr.appendChild(th);
        });
        thead.appendChild(tr);
      });
    } else {
      // single header from columns
      const tr = document.createElement('tr');
      (config.columns||[]).forEach(c=>{
        const th = document.createElement('th');
        th.textContent = c.label ?? c.key;
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    }
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Pre-compile compute and conditional expressions
    const compiled = (config.columns||[]).map(col=>({ compute: compileExpression(col.compute), conditionals: Array.isArray(col.conditional) ? col.conditional.map(x=> ({...x, fn: compileExpression(x.when)})) : [] }));

    // Determine total body rows
    let totalRows = 0;
    const sections = Array.isArray(config.sections) ? config.sections : null;
    if(sections){
      totalRows = sections.reduce((a,b)=> a + (b.rows||0), 0) + sections.length; // + section header rows
    } else {
      totalRows = config.rows || 0;
    }

    // Helper to create input or static cell
    function createCell(col, rowIndex){
      const td = document.createElement('td');
      td.dataset.colKey = col.key;
      if(col.type === 'select' && Array.isArray(col.options)){
        const select = document.createElement('select');
        select.className = 'ai-cell-input';
        col.options.forEach(opt=>{
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          select.appendChild(o);
        });
        if(col.default) select.value = col.default;
        td.appendChild(select);
      } else if(col.type === 'number' || col.type === 'text' || !col.type){
        const input = document.createElement('input');
        input.className = 'ai-cell-input';
        input.type = col.type === 'text' ? 'text' : 'number';
        if(col.placeholder) input.placeholder = col.placeholder;
        if(typeof col.min === 'number') input.min = String(col.min);
        if(typeof col.max === 'number') input.max = String(col.max);
        if(typeof col.step === 'number') input.step = String(col.step);
        if(col.required) input.required = true;
        if(col.default != null) input.value = col.default;
        if(col.compute){ input.readOnly = true; input.tabIndex = -1; input.classList.add('ai-computed'); }
        td.appendChild(input);
      } else {
        td.textContent = '';
      }
      return td;
    }

    // Create body rows with optional section headers
    let currentRow = 0;
    if(sections){
      sections.forEach((sec, si)=>{
        // Section header row
        const trh = document.createElement('tr');
        trh.className = 'ai-section-row';
        const th = document.createElement('th');
        th.colSpan = (config.columns||[]).length;
        th.textContent = sec.title ?? `Section ${si+1}`;
        trh.appendChild(th);
        tbody.appendChild(trh);
        currentRow++;
        for(let r=0; r<(sec.rows||0); r++){
          const tr = document.createElement('tr');
          (config.columns||[]).forEach(col=> tr.appendChild(createCell(col, currentRow)) );
          tbody.appendChild(tr);
          currentRow++;
        }
      });
    } else {
      for(let r=0; r<totalRows; r++){
        const tr = document.createElement('tr');
        (config.columns||[]).forEach(col=> tr.appendChild(createCell(col, r)) );
        tbody.appendChild(tr);
      }
    }

    table.appendChild(tbody);

    // Apply merges if any (row/col indices target only data rows including section header rows)
    if(Array.isArray(config.merges)){
      config.merges.forEach(m=>{
        try{
          const tr = tbody.querySelectorAll('tr')[m.row];
          if(!tr) return;
          const td = tr.querySelectorAll('td,th')[m.col];
          if(!td) return;
          if(m.rowspan) td.rowSpan = m.rowspan;
          if(m.colspan) td.colSpan = m.colspan;

          // Hide covered cells
          for(let rr=0; rr<(m.rowspan||1); rr++){
            const rtr = tbody.querySelectorAll('tr')[m.row+rr];
            if(!rtr) continue;
            for(let cc=0; cc<(m.colspan||1); cc++){
              if(rr===0 && cc===0) continue;
              const ctd = rtr.querySelectorAll('td,th')[m.col+cc];
              if(ctd) ctd.style.display = 'none';
            }
          }
        }catch(e){ err('merge failed', m, e); }
      });
    }

    // Recompute logic for a given row element
    function recomputeRow(tr, rowIndex){
      const inputs = Array.from(tr.querySelectorAll('td .ai-cell-input'));
      const colsObj = {};
      (config.columns||[]).forEach((col, i)=>{
        const inp = inputs[i];
        let val;
        if (inp) {
          if (col.type === 'number' || inp.type === 'number') {
            val = inp.value === '' ? NaN : Number(inp.value);
          } else {
            val = (inp.value ?? '');
          }
        }
        colsObj[col.key] = val;
      });

      // Compute computed fields
      (config.columns||[]).forEach((col, i)=>{
        if(col.compute){
          const fn = compiled[i].compute;
          if(fn){
            const raw = fn(colsObj, colsObj[col.key], rowIndex);
            const value = (typeof col.decimals === 'number') ? util.round(raw, col.decimals) : raw;
            const input = inputs[i];
            if(input){
              input.value = isFinite(value) ? formatNumber(value, col.decimals) : '';
            }
            colsObj[col.key] = value;
          }
        }
      });

      // Apply conditionals
      (config.columns||[]).forEach((col, i)=>{
        const conds = compiled[i].conditionals;
        if(!conds || !conds.length) return;
        const cell = tr.querySelectorAll('td')[i];
        const input = inputs[i];
        if(!cell) return;

        // reset classes and any conditional inline styles
        cell.classList.remove('cf-warning','cf-danger','cf-ok');
        if(input) input.classList.remove('cf-warning','cf-danger','cf-ok');

        // clear previously applied conditional inline styles (only keys used by conds)
        const styleKeys = new Set();
        conds.forEach(c=>{
          if(c.style && typeof c.style === 'object'){
            Object.keys(c.style).forEach(k=> styleKeys.add(k));
          }
        });
        styleKeys.forEach(k=> {
          try { cell.style[k] = ''; } catch(e){}
        });

        conds.forEach(c=>{
          try{
            const v = colsObj[col.key];
            const ok = c.fn ? !!c.fn(colsObj, v, rowIndex) : false;
            if(ok){
              if(c.addClass){ cell.classList.add(c.addClass); if(input) input.classList.add(c.addClass); }
              if(c.style && typeof c.style === 'object') Object.assign(cell.style, c.style);
            }
          }catch(e){
            /* ignore */
          }
        });
      });
    }

    // Attach listeners on editable cells to recompute row
    Array.from(tbody.querySelectorAll('tr')).forEach((tr, rowIndex)=>{
      const cells = tr.querySelectorAll('td .ai-cell-input');
      if(!cells.length) return; // likely a section header row
      cells.forEach(inp=>{
        if(inp.readOnly) return;
        ['input','change'].forEach(ev=> inp.addEventListener(ev, ()=> recomputeRow(tr, rowIndex)) );
      });
      // Initial compute
      recomputeRow(tr, rowIndex);
    });

    return table;
  }

  // Public API
  window.AITable = {
    parseRelaxedJSON,
    build: function(cfg){
      return buildTable(cfg);
    },
    util
  };

  // Page integration for settings tab (if present)
  document.addEventListener('DOMContentLoaded', ()=>{
    const input = document.getElementById('ai-template-input');
    const btnRender = document.getElementById('render-ai-table');
    const out = document.getElementById('ai-table-output');
    const btnCopyPrompt = document.getElementById('copy-ai-table-prompt');

    if(btnCopyPrompt){
      btnCopyPrompt.addEventListener('click', ()=>{
        const prompt = getStandardTablePrompt();
        navigator.clipboard.writeText(prompt).then(()=>{
          if(typeof window.showNotification === 'function') showNotification('Standard AI Table Prompt copied.','success');
        });
      });
    }

    if(btnRender && input && out){
      btnRender.addEventListener('click', ()=>{
        try{
          const raw = input.value;
          const cfg = parseRelaxedJSON(raw);
          if(!cfg || cfg.type !== 'ai') throw new Error('Invalid config: missing type:"ai"');
          out.innerHTML = '';
          const table = buildTable(cfg);
          out.appendChild(table);
          if(typeof window.showNotification === 'function') showNotification('AI Table rendered successfully.','success');
        }catch(e){
          err(e);
          if(typeof window.showNotification === 'function') showNotification('Invalid AI Table JSON: '+ (e.message||e),'error',6000);
        }
      });
    }
  });

  function getStandardTablePrompt(){
    return (
`You are designing an AI calculation table. Produce STRICT JSON (no comments, no backticks, no wrapping parentheses) that follows this schema: { "name": "Human readable name", "type": "ai", "headerPosition": "top", "inspectionPeriod": 60, "borders": true, "headerRows": [ [ { "label": "Inputs", "colspan": 2 }, { "label": "Results", "rowspan": 2 } ], [ { "label": "Value A" }, { "label": "Value B" } ] ], "sections": [ { "title": "Section A", "rows": 3 }, { "title": "Section B", "rows": 2 } ], "rows": 0, "columns": [ { "key": "value_a", "label": "Value A", "type": "number", "min": 0, "max": 1000, "step": 1, "decimals": 2, "required": true, "placeholder": "e.g. 10" }, { "key": "value_b", "label": "Value B", "type": "number", "min": 0, "max": 1000, "step": 1, "decimals": 2, "required": true, "placeholder": "e.g. 20" }, { "key": "sum_ab", "label": "Sum (A+B)", "type": "number", "decimals": 2, "compute": "cols.value_a + cols.value_b", "conditional": [ { "when": "value > 100", "addClass": "cf-warning", "style": { "backgroundColor": "#fff3cd" } } ] }, { "key": "diff_ab", "label": "Difference (A-B)", "type": "number", "decimals": 2, "compute": "cols.value_a - cols.value_b" }, { "key": "avg_ab", "label": "Average", "type": "number", "decimals": 2, "compute": "avg([cols.value_a, cols.value_b])", "conditional": [ { "when": "value < 5", "addClass": "cf-danger", "style": { "backgroundColor": "#f8d7da" } } ] }, { "key": "status", "label": "Status", "type": "select", "options": ["OK","NOT OK"], "default": "OK", "conditional": [ { "when": "cols.sum_ab > 200", "addClass": "cf-danger", "style": { "backgroundColor": "#f5c6cb" } }, { "when": "cols.sum_ab <= 200", "addClass": "cf-ok", "style": { "backgroundColor": "#d4edda" } } ] } ], "merges": [ { "row": 1, "col": 0, "rowspan": 2, "colspan": 1 } ] } Rules: - Use only double quotes for keys and strings. No trailing commas. No escaped markdown characters. Do not wrap JSON in parentheses. - Expressions in compute and conditional.when can reference cols., value, and helpers: avg(), sum(), min(), max(), round(v,d), clamp(v,min,max). `);
  }
})();