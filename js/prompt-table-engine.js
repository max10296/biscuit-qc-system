// Prompt-driven Relational AI Tables Engine
// Features:
// - DSL prompt parser for tables, fields, refs, computed formulas, formatting rules, and rollups
// - Renders editable data grids per table with reference lookups
// - Supports computed columns with dependencies and expression evaluation via expr-eval
// - Supports conditional formatting per column
// - Supports rollups (count, sum, avg, min, max) filtered by where clauses
// - Persistence: localStorage by default, optional RESTful Table API (gs Tables) via fetch
//
(function(){
  'use strict';

  const E = (sel,root=document)=> root.querySelector(sel);
  const EE= (sel,root=document)=> Array.from(root.querySelectorAll(sel));
  const deepClone = (o)=> JSON.parse(JSON.stringify(o));
  const { Parser } = window.exprEval || {};

  const Engine = {
    state: {
      useAPI: false,
      schema: {}, // tableName -> { fields, refs, computed, formatting, rollups }
      data: {},   // tableName -> rows
      filters: {}, // tableName -> filter string
      sort: {},    // tableName -> { key, dir: 'asc'|'desc' }
      dslSelector: '#dsl',
      tablesContainer: '#tables-container',
      errorsSelector: '#errors',
      storageNS: ''
    },

    init(opts={}){
      Object.assign(this.state, opts);
      window.PromptTableEngine = this; // expose
      this.loadAll();
    },

    setUseAPI(v){ this.state.useAPI = !!v; },
    setStorageNamespace(ns){ this.state.storageNS = ns || ''; },

    // --------- Persistence
    storageKey(){ return 'prompt_ai_tables_v1' + (this.state.storageNS? ('_'+this.state.storageNS) : ''); },
    saveAll(){
      try{
        const payload = { schema:this.state.schema, data:this.state.data, dsl:E(this.state.dslSelector).value };
        localStorage.setItem(this.storageKey(), JSON.stringify(payload));
        this.notify('Saved locally');
      }catch(err){ this.error(err); }
    },
    loadAll(){
      try{
        const s = localStorage.getItem(this.storageKey());
        if(!s) return;
        const parsed = JSON.parse(s);
        this.state.schema = parsed.schema || {};
        this.state.data = parsed.data || {};
        if(parsed.dsl) E(this.state.dslSelector).value = parsed.dsl;
        if(Object.keys(this.state.schema).length) this.renderAll();
      }catch(err){ this.error(err); }
    },
    resetAll(){
      localStorage.removeItem(this.storageKey());
      this.state.schema = {}; this.state.data = {};
      this.renderAll();
      this.notify('Reset');
    },

    // --------- DSL Parsing
    buildFromDSL(){
      const src = E(this.state.dslSelector).value;
      try{
        const schema = parseDSL(src);
        this.state.schema = schema;
        // convert rollups into synthetic computed columns
        for(const [t, meta] of Object.entries(this.state.schema)){
          meta.rollups = meta.rollups || [];
          meta.fields = meta.fields || [];
          meta.rollups.forEach((ru)=>{
            // avoid duplicate if user already defined a field with same key
            if(!meta.fields.some(f=>f.key===ru.key)){
              meta.fields.push({ key: ru.key, label: ru.key.replace(/_/g,' '), type: 'number', computed: true, rollupMeta: ru, decimals: 2 });
            }
          });
        }
        // initialize data buckets if not exist
        for(const t in schema){ if(!this.state.data[t]) this.state.data[t] = []; }
        E(this.state.errorsSelector).textContent = '';
        this.renderAll();
      }catch(err){
        E(this.state.errorsSelector).textContent = String(err.message||err);
        console.error(err);
      }
    },

    // --------- Rendering
    renderAll(){
      const container = E(this.state.tablesContainer);
      container.innerHTML = '';
      for(const [name, meta] of Object.entries(this.state.schema)){
        container.appendChild(this.renderTableCard(name, meta));
      }
    },

    renderTableCard(name, meta){
      const card = document.createElement('div');
      card.className = 'table-card';

      const header = document.createElement('header');
      header.innerHTML = `<h3>${name}</h3>`;
      const toolbar = document.createElement('div');
      toolbar.className = 'table-toolbar';
      const filterInput = document.createElement('input');
      filterInput.type = 'search';
      filterInput.placeholder = 'Filter…';
      filterInput.value = this.state.filters[name] || '';
      filterInput.addEventListener('input', ()=>{ this.state.filters[name] = filterInput.value; this.renderAll(); });
      toolbar.appendChild(filterInput);
      toolbar.appendChild(btn('Add Row', ()=>this.addRow(name)));
      toolbar.appendChild(btn('Delete Selected', ()=>this.deleteSelected(name)));
      toolbar.appendChild(badge(`${this.state.data[name]?.length||0} rows`));
      header.appendChild(toolbar);

      const table = document.createElement('table');
      table.className = 'grid';

      // Columns: visible fields including computed
      const columns = meta.fields.filter(f=>!f.hidden);
      const thead = document.createElement('thead');
      const trH = document.createElement('tr');
      trH.appendChild(th(''));
      columns.forEach(col=> {
        const thEl = document.createElement('th');
        thEl.textContent = col.label||col.key;
        thEl.style.cursor = 'pointer';
        thEl.addEventListener('click', ()=>{
          const cur = this.state.sort[name] || {};
          const dir = (cur.key===col.key && cur.dir==='asc') ? 'desc' : (cur.key===col.key && cur.dir==='desc') ? null : 'asc';
          if(dir){ this.state.sort[name] = { key: col.key, dir }; } else { delete this.state.sort[name]; }
          this.renderAll();
        });
        trH.appendChild(thEl);
      });
      thead.appendChild(trH);

      const tbody = document.createElement('tbody');
      let rows = this.state.data[name] || [];
      const fstr = (this.state.filters[name]||'').toLowerCase();
      if(fstr){ rows = rows.filter(r=> JSON.stringify(r).toLowerCase().includes(fstr)); }
      // apply sorting if any
      const sorter = this.state.sort[name];
      if(sorter){
        const colCfg = columns.find(c=>c.key===sorter.key);
        rows = rows.slice().sort((a,b)=>{
          const va = a[sorter.key];
          const vb = b[sorter.key];
          let cmp = 0;
          if(typeof va==='number' && typeof vb==='number') cmp = (va||0) - (vb||0);
          else cmp = String(va??'').localeCompare(String(vb??''));
          return sorter.dir==='asc' ? cmp : -cmp;
        });
      }
      rows.forEach((row, idx)=>{
        const tr = document.createElement('tr');
        // selection checkbox
        const tdSel = document.createElement('td');
        tdSel.innerHTML = `<input type="checkbox" class="row-select" data-idx="${idx}">`;
        tr.appendChild(tdSel);

        columns.forEach(col=>{
          const td = document.createElement('td');
          if(col.type==='ref'){
            const refRows = this.state.data[col.refTable]||[];
            const dispField = col.displayField || 'id';
            const sel = document.createElement('select');
            sel.innerHTML = `<option value="">-- select --</option>` + refRows.map(r=>`<option value="${r.id||r._id||''}" ${((row[col.key]||'')==(r.id||r._id||''))?'selected':''}>${escapeHTML(r[dispField]??(r.id||r._id||''))}</option>`).join('');
            sel.addEventListener('change',()=>{ row[col.key] = sel.value; this.recompute(name); this.saveAll(); this.renderAll(); });
            td.appendChild(sel);
          } else if(col.computed){
            const span = document.createElement('span');
            const val = safeEval(col.computeExpr, this.buildContext(name, row));
            span.textContent = formatVal(val, col);
            td.appendChild(span);
            applyFormatting(td, col, row, name, this);
          } else {
            const inp = document.createElement('input');
            inp.type = (col.type==='number')? 'number' : 'text';
            if(col.decimals!=null) inp.step = (1/Math.pow(10,col.decimals));
            if(col.min!=null) inp.min = col.min;
            if(col.max!=null) inp.max = col.max;
            if(col.required) inp.required = true;
            inp.value = row[col.key] ?? '';
            inp.placeholder = col.placeholder || '';
            const err = document.createElement('div');
            err.className = 'text-red-600 text-xs mt-1';
            function doValidate(){
              let msg = '';
              const val = (col.type==='number')? (inp.value===''?null:Number(inp.value)) : inp.value;
              if(col.required && (val==='' || val==null || (col.type==='number' && Number.isNaN(val)))) msg = 'Required';
              if(!msg && col.type==='number' && val!=null && !Number.isNaN(val)){
                if(col.min!=null && val < col.min) msg = `Min ${col.min}`;
                if(!msg && col.max!=null && val > col.max) msg = `Max ${col.max}`;
              }
              err.textContent = msg;
              if(msg){ inp.classList.add('border-red-500'); } else { inp.classList.remove('border-red-500'); }
            }
            inp.addEventListener('input',()=>{ row[col.key] = (col.type==='number')? (inp.value===''?null:Number(inp.value)) : inp.value; this.recompute(name); this.saveAll(); applyFormatting(td,col,row,name,this); doValidate(); });
            td.appendChild(inp);
            td.appendChild(err);
            // initial validation state
            doValidate();
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      // Build tfoot summary rows (Sum/Avg for numeric columns)
      const tfoot = document.createElement('tfoot');
      const trSum = document.createElement('tr');
      const trAvg = document.createElement('tr');
      const tdLabelSum = document.createElement('td'); tdLabelSum.textContent = 'Sum'; trSum.appendChild(tdLabelSum);
      const tdLabelAvg = document.createElement('td'); tdLabelAvg.textContent = 'Avg'; trAvg.appendChild(tdLabelAvg);
      columns.forEach(col=>{
        const tdS = document.createElement('td');
        const tdA = document.createElement('td');
        let sum = 0, count = 0;
        (this.state.data[name]||[]).forEach(r=>{
          const v = r[col.key];
          if(typeof v==='number' && !Number.isNaN(v)){ sum += v; count++; }
        });
        tdS.textContent = (count>0)? formatVal(sum, {type:'number',decimals: (col.decimals!=null?col.decimals:2)}) : '';
        tdA.textContent = (count>0)? formatVal(sum/count, {type:'number',decimals: (col.decimals!=null?col.decimals:2)}) : '';
        trSum.appendChild(tdS); trAvg.appendChild(tdA);
      });
      tfoot.appendChild(trSum); tfoot.appendChild(trAvg);

      // Footer note for rollups
      const footer = document.createElement('div');
      footer.className = 'footer-note';
      footer.textContent = meta.rollups && meta.rollups.length ? `Rollups: ${meta.rollups.map(r=>r.key).join(', ')}` : '';

      table.appendChild(thead); table.appendChild(tbody); table.appendChild(tfoot);
      card.appendChild(header); card.appendChild(table); card.appendChild(footer);
      return card;
    },

    addRow(tableName){
      const meta = this.state.schema[tableName];
      const row = {};
      for(const f of meta.fields){ if(f.default!=null) row[f.key]=f.default; }
      // simple auto id
      row.id = row.id || `${tableName}_${Date.now()}_${Math.floor(Math.random()*10000)}`;
      this.state.data[tableName] = this.state.data[tableName]||[];
      this.state.data[tableName].push(row);
      this.recompute(tableName);
      this.saveAll();
      this.renderAll();
    },

    deleteSelected(tableName){
      const container = E(this.state.tablesContainer);
      const card = EE('.table-card', container).find(c=> c.querySelector('header h3').textContent===tableName);
      const checks = EE('tbody .row-select', card);
      const toRemove = new Set(Array.from(checks).filter(c=>c.checked).map(c=> Number(c.dataset.idx)));
      this.state.data[tableName] = (this.state.data[tableName]||[]).filter((_,i)=> !toRemove.has(i));
      this.recompute(tableName);
      this.saveAll();
      this.renderAll();
    },

    // --------- Compute & formatting
    buildContext(tableName, row){
      const ctx = { cols: new Proxy({}, { get: (_,k)=> row[k] }), row, this: row, table: tableName, data: this.state.data, ref: (refVal)=> findRefRow(refVal, this.state.data) };
      return ctx;
    },

    recompute(tableName){
      const meta = this.state.schema[tableName];
      if(!meta) return;
      const rows = this.state.data[tableName]||[];
      for(const r of rows){
        for(const f of meta.fields){
          if(f.computed){
            let v = null;
            if(f.rollupMeta){
              v = this.computeRollup(tableName, f.rollupMeta, r);
            } else {
              v = safeEval(f.computeExpr, this.buildContext(tableName, r));
            }
            r[f.key] = v;
          }
        }
      }
      // recompute dependent tables rollups and computed refs if any
      for(const [t, m] of Object.entries(this.state.schema)){
        if(t===tableName) continue;
        // naive: recompute all
        const trs = this.state.data[t]||[];
        for(const r of trs){
          for(const f of m.fields){
            if(f.computed){ r[f.key] = safeEval(f.computeExpr, this.buildContext(t, r)); }
          }
        }
      }
    },

    // --------- API integration (optional, no auth assumed)
    async apiList(table){
      const res = await fetch(`tables/${table}`);
      return await res.json();
    },

    computeRollup(tableName, ru, currentRow){
      // ru: { key, agg, body, where }
      // body like: Samples.weight
      const m = (ru.body||'').match(/^(\w+)\./);
      if(!m) return null;
      const refTable = m[1];
      const rows = this.state.data[refTable] || [];
      const bodyExpr = (ru.body||'').replace(new RegExp('^'+refTable+'\.'), 'other.');
      const whereExpr = ru.where ? ru.where.replace(new RegExp(refTable+'\.', 'g'), 'other.') : null;
      const values = [];
      for(const other of rows){
        const ctx = this.buildContext(tableName, currentRow);
        ctx.other = other;
        const pass = whereExpr ? !!safeEval(whereExpr, ctx) : true;
        if(pass){
          const val = safeEval(bodyExpr, ctx);
          if(val!=null && !Number.isNaN(val)) values.push(Number(val));
        }
      }
      if(ru.agg==='count') return values.length;
      if(ru.agg==='sum') return values.reduce((a,b)=>a+b,0);
      if(ru.agg==='avg') return values.length? values.reduce((a,b)=>a+b,0)/values.length : 0;
      if(ru.agg==='min') return values.length? Math.min(...values): null;
      if(ru.agg==='max') return values.length? Math.max(...values): null;
      return null;
    }
  };

  // --------- Helpers
  function btn(label, onClick){ const b=document.createElement('button'); b.textContent=label; b.addEventListener('click', onClick); return b; }
  function th(label){ const el=document.createElement('th'); el.textContent=label; return el; }
  function badge(text){ const s=document.createElement('span'); s.className='badge'; s.textContent=text; return s; }
  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
  function notify(msg){ console.log(msg); }

  function applyFormatting(td, col, row, tableName, engine){
    if(!col.formatRules) return;
    td.classList.remove('cond-bad','cond-ok');
    col.formatRules.forEach(rule=>{
      const ok = safeEval(rule.when, engine.buildContext(tableName, row));
      if(ok){
        if(rule.addClass){ td.classList.add(...rule.addClass.split(/\s+/)); }
        if(rule.style){ Object.assign(td.style, rule.style); }
      }
    });
  }

  function formatVal(v, col){
    if(v==null || Number.isNaN(v)) return '';
    if(col.type==='number' && typeof col.decimals==='number') return Number(v).toFixed(col.decimals);
    return String(v);
  }

  function safeEval(expr, context){
    try{
      if(expr==null || expr==='') return null;
      const p = new Parser({ operators: { logical: true, comparison: true, concatenate: true } });
      // Inject helpers
      const scope = Object.assign({
        abs: Math.abs, min: Math.min, max: Math.max, round: Math.round, floor: Math.floor, ceil: Math.ceil,
        sum: (...a)=> a.reduce((x,y)=>x+(+y||0),0), avg: (...a)=> a.length? a.reduce((x,y)=>x+(+y||0),0)/a.length : 0,
      }, context.cols, context);
      return p.parse(expr).evaluate(scope);
    }catch(e){ return null; }
  }

  function findRefRow(refVal, data){
    if(!refVal) return null;
    for(const [t, rows] of Object.entries(data)){
      const found = (rows||[]).find(r=> (r.id||r._id) === refVal);
      if(found) return found;
    }
    return null;
  }

  // --------- DSL Parser
  // Grammar (lightweight):
  // table <Name> {\n fields:\n   key: <type> [attrs...] [= <expr>]\n rollups:\n   key = <agg>(<expr> [where <expr>])\n formatting:\n   <col>:\n     when <expr> then addClass "..." [style key=val ...]\n }
  function parseDSL(src){
    const lines = src.split(/\r?\n/);
    let i=0; const schema = {};

    function parseAttrs(rest){
      const out = {}; const parts = rest.trim().split(/\s+/);
      for(const p of parts){
        if(p.includes('=')){
          const [k,v] = p.split('=');
          out[k] = v?.replace(/^"|"$/g,'');
        } else if(p==='required'){ out.required=true; }
        else if(p==='pk'){ out.pk=true; }
        else if(p==='auto'){ out.auto=true; }
        else if(p==='display'){ out.display=true; }
      }
      return out;
    }

    function parseFormattingBlock(tableMeta){
      // expects at current line starting with 'formatting:' then nested rules
      // Simple parser for:
      //   col:
      //     when expr then addClass "..."
      while(i<lines.length){
        let l = lines[i].trim();
        if(!l){ i++; continue; }
        if(l.startsWith('}')) break;
        if(l.includes(':')){
          const [col, rest] = l.split(':');
          const colName = col.trim();
          i++;
          tableMeta.fields.find(f=>f.key===colName).formatRules = [];
          while(i<lines.length){
            l = lines[i].trim();
            if(!l){ i++; continue; }
            if(l.startsWith('when ')){
              const m = l.match(/^when\s+(.+)\s+then\s+addClass\s+"([^"]+)"/);
              if(m){
                tableMeta.fields.find(f=>f.key===colName).formatRules.push({ when: m[1], addClass: m[2] });
                i++; continue;
              }
            }
            if(l.startsWith('}')) break;
            if(l.endsWith(':')) break; // new column formatting block
            break;
          }
        } else {
          break;
        }
      }
    }

    while(i<lines.length){
      let line = lines[i].trim();
      if(!line){ i++; continue; }
      const m = line.match(/^table\s+(\w+)\s*\{/);
      if(m){
        const tableName = m[1];
        const meta = { fields: [], rollups: [] };
        i++;
        while(i<lines.length){
          line = lines[i].trim();
          if(!line){ i++; continue; }
          if(line.startsWith('fields:')){ i++; continue; }
          if(line.startsWith('rollups:')){ i++; continue; }
          if(line.startsWith('formatting:')){ i++; i = i; parseFormattingBlock(meta); continue; }
          if(line.startsWith('}')){ i++; break; }

          // field or rollup line
          if(line.includes(':')){
            // field
            const [key, rest0] = line.split(':');
            const keyName = key.trim();
            let rest = rest0.trim();
            let computeExpr = null;
            if(rest.includes('=')){
              const [typeAndAttrs, expr] = rest.split('=');
              rest = typeAndAttrs.trim();
              computeExpr = expr.trim();
            }
            const [type, ...attrParts] = rest.split(/\s+/);
            const attrs = parseAttrs(attrParts.join(' '));
            const field = { key: keyName, label: keyName.replace(/_/g,' '), type, ...attrs };
            if(type.startsWith('ref(')){
              const refTable = type.match(/^ref\((\w+)\)/)[1];
              field.type = 'ref'; field.refTable = refTable; field.displayField = attrs.display_field || 'id';
            }
            if(computeExpr){ field.computed=true; field.computeExpr=computeExpr; }
            if(field.decimals!=null) field.decimals = Number(field.decimals);
            if(field.min!=null) field.min = Number(field.min);
            if(field.max!=null) field.max = Number(field.max);
            meta.fields.push(field);
            i++; continue;
          }

          if(line.includes('=')){
            // rollup form: key = agg(expr where condition)
            const [left, right] = line.split('=');
            const key = left.trim();
            const r = right.trim();
            const m2 = r.match(/^(\w+)\((.+)\)$/);
            if(!m2) throw new Error('Invalid rollup: '+line);
            const agg = m2[1];
            let body = m2[2];
            let where = null;
            const w = body.split(/\s+where\s+/i);
            if(w.length>1){ where = w[1].trim(); body = w[0].trim(); }
            meta.rollups.push({ key, agg, body, where });
            i++; continue;
          }

          i++;
        }
        schema[tableName] = meta;
      } else { i++; }
    }

    return schema;
  }

  // Simple UI notifications
  Engine.notify = notify; Engine.error = (e)=>{ console.error(e); alert('Error: '+(e.message||e)); };

  // expose
  window.PromptTableEngine = Engine;
})();
