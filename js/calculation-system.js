
(function(){
  const DEFAULT_OPERATIONS = {
    sum: {
      label: 'Sum', symbol: '+', minInputs: 2, maxInputs: null,
      description: 'Add multiple values together',
      exec: (inputs) => inputs.reduce((a,b)=>a + b, 0)
    },
    subtract: {
      label: 'Subtract', symbol: '-', minInputs: 2, maxInputs: 2,
      description: 'Subtract second value from first',
      exec: (inputs) => inputs.slice(1).reduce((a,b)=>a - b, inputs[0] ?? 0)
    },
    multiply: {
      label: 'Multiply', symbol: '×', minInputs: 2, maxInputs: null,
      description: 'Multiply values',
      exec: (inputs) => inputs.reduce((a,b)=>a * b, 1)
    },
    divide: {
      label: 'Divide', symbol: '÷', minInputs: 2, maxInputs: 2,
      description: 'Divide first value by second',
      exec: (inputs) => {
        const denom = inputs[1];
        if (denom === 0) return NaN;
        return (inputs[0] ?? 0) / denom;
      }
    },
    average: {
      label: 'Average', symbol: 'avg', minInputs: 2, maxInputs: null,
      description: 'Average of values',
      exec: (inputs) => inputs.reduce((a,b)=>a+b,0) / (inputs.length || 1)
    },
    min: {
      label: 'Min', symbol: 'min', minInputs: 2, maxInputs: null,
      description: 'Minimum of values',
      exec: (inputs) => Math.min(...inputs)
    },
    max: {
      label: 'Max', symbol: 'max', minInputs: 2, maxInputs: null,
      description: 'Maximum of values',
      exec: (inputs) => Math.max(...inputs)
    }
  };

  // Utility: create elements
  function el(tag, attrs = {}, children = []){
    const node = document.createElement(tag);
    let hasTypeAttr = false;
    Object.entries(attrs).forEach(([k,v])=>{
      if (v == null || v === false) return; // skip null/undefined/false attributes
      if (k === 'class') node.className = v;
      else if (k === 'style') node.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.substring(2), v);
      else {
        if (k === 'type') hasTypeAttr = true;
        // boolean attributes: allow true to set empty attribute
        if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      }
    });
    // Prevent accidental form submissions: default all builder buttons to type="button"
    if (tag.toLowerCase() === 'button' && !hasTypeAttr) {
      node.setAttribute('type', 'button');
    }
    (Array.isArray(children) ? children : [children]).forEach(c=>{
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // Style injection (scoped basics)
  function injectStyles(){
    if (document.getElementById('calc-builder-styles')) return;
    const style = el('style', { id:'calc-builder-styles' }, `
      .calc-builder { font-size: 12px; color: #1f2937; }
      .calc-steps { display: flex; flex-direction: column; gap: 10px; }
      .calc-step { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #fff; }
      .calc-step-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
      .calc-step-title { font-weight: 700; color:#374151; }
      .calc-row { display:flex; gap:8px; align-items:center; flex-wrap: wrap; }
      .calc-select, .calc-input { border: 1px solid #d1d5db; border-radius: 4px; padding: 4px 6px; background:#f9fafb; }
      .calc-badge { background:#eff6ff; color:#1e40af; padding:2px 6px; border-radius: 999px; font-size: 11px; }
      .calc-btn { border: 1px solid #d1d5db; background:#f3f4f6; color:#111827; padding:4px 8px; border-radius:4px; cursor:pointer; }
      .calc-btn:hover { background:#e5e7eb; }
      .calc-danger { color:#991b1b; }
      .calc-add { background:#10b981; color:#fff; border-color:#10b981; }
      .calc-add:hover { background:#059669; }
      .calc-preview { background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; padding:8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
      .calc-help { color:#6b7280; font-size: 11px; }
    `);
    document.head.appendChild(style);
  }

  // Input source builders
  function makeSourceSelect(options){
    const sel = el('select', { class:'calc-select calc-source-type' }, [
      el('option', { value:'parameter' }, 'Parameter'),
      el('option', { value:'variable' }, 'Variable'),
      el('option', { value:'constant' }, 'Constant'),
      el('option', { value:'result' }, 'Result of Step')
    ]);
    if (options && options.defaultValue) sel.value = options.defaultValue;
    return sel;
  }

  function makeParamSelect(params){
    const sel = el('select', { class:'calc-select calc-parameter' }, [ el('option', { value:'' }, 'Select parameter') ]);
    params.forEach(p => sel.appendChild(el('option', { value: p.id || p.name || p.key }, p.label || p.name || p.id)));
    return sel;
  }

  function makeVariableSelect(vars){
    const sel = el('select', { class:'calc-select calc-variable' }, [ el('option', { value:'' }, 'Select variable') ]);
    vars.forEach(v => sel.appendChild(el('option', { value: v.id || v.name }, v.label || v.name)));
    return sel;
  }

  function makeResultSelect(steps, currentIndex){
    const sel = el('select', { class:'calc-select calc-result-ref' }, [ el('option', { value:'' }, 'Select step result') ]);
    steps.forEach((s, idx) => {
      if (idx < currentIndex) sel.appendChild(el('option', { value: s.id }, `Result of Step ${idx+1}`));
    });
    return sel;
  }

  function makeConstantInput(){
    return el('input', { type:'number', step:'any', class:'calc-input calc-constant', placeholder:'e.g., 100' });
  }

  function uid(prefix='id'){ return `${prefix}-${Math.random().toString(36).slice(2,9)}`; }

  class CalculationBuilder {
    constructor(options = {}){
      injectStyles();
      this.operations = options.operations || DEFAULT_OPERATIONS;
      this.params = options.params || []; // [{id,label}]
      this.variables = options.variables || []; // [{name,label}]
      this.container = null;
      this.steps = []; // UI state mirror
      this.hiddenInput = null; // .calculation-json input to sync
    }

    // Public API
    mount(container, opts = {}){
      this.container = (typeof container === 'string') ? document.querySelector(container) : container;
      if (!this.container) return;
      if (opts.params) this.params = opts.params;
      if (opts.variables) this.variables = opts.variables;
      if (opts.hiddenInput) this.hiddenInput = (typeof opts.hiddenInput === 'string') ? document.querySelector(opts.hiddenInput) : opts.hiddenInput;

      // Root UI
      this.root = el('div', { class:'calc-builder' });
      const header = el('div', { class:'calc-row', style:'justify-content: space-between; margin-bottom:8px;' }, [
        el('div', { class:'calc-help' }, 'Build multi-step formulas. The final result is the output of the last step.'),
        el('div', {}, [
          el('button', { class:'calc-btn calc-add', onclick: () => this.addStep() }, '+ Add Step')
        ])
      ]);
      this.stepsWrap = el('div', { class:'calc-steps' });
      this.previewWrap = el('div', { class:'calc-preview', style:'margin-top:8px;' });

      this.root.appendChild(header);
      this.root.appendChild(this.stepsWrap);
      this.root.appendChild(el('div', { class:'calc-help', style:'margin-top:6px;' }, 'Preview'));
      this.root.appendChild(this.previewWrap);

      this.container.innerHTML = '';
      this.container.appendChild(this.root);

      // Initialize default state if none
      if (!this.steps.length) this.addStep();
      this.render();
    }

    bindHiddenInput(input){
      this.hiddenInput = (typeof input === 'string') ? document.querySelector(input) : input;
      this.syncHidden();
    }

    setContext({ params = [], variables = [] } = {}){
      this.params = params;
      this.variables = variables;
      this.render();
    }

    // Load from JSON (object or string); structure: { steps: [ {id, operation, inputs: [{type, ..., value/paramId/varName/stepId}] } ] }
    loadCalculation(calculation){
      try {
        const obj = typeof calculation === 'string' ? JSON.parse(calculation) : calculation;
        if (!obj || !Array.isArray(obj.steps)) return;
        // ensure ids
        this.steps = obj.steps.map((s, i) => ({
          id: s.id || uid('step'),
          operation: s.operation || 'sum',
          inputs: (s.inputs || []).map(inp => ({ ...inp }))
        }));
        this.render();
        this.syncHidden();
      } catch(e) {
        console.warn('loadCalculation error', e);
      }
    }

    getCalculation(){
      return { steps: this.steps.map(s => ({ id: s.id, operation: s.operation, inputs: s.inputs.map(i => ({...i})) })) };
    }

    // Backward-compat alias
    buildCalculationObject(){
      return this.getCalculation();
    }

    // Execute using a context of values: { parameters: {id: value}, variables: {name: value} }
    executeCalculation(context = {}){
      const parameters = context.parameters || {};
      const variables = context.variables || {};
      const stepResults = {};

      const resolveInput = (inp) => {
        if (!inp || !inp.type) return NaN;
        switch(inp.type){
          case 'constant': return Number(inp.value ?? 0);
          case 'parameter': return Number(parameters[inp.paramId] ?? NaN);
          case 'variable': return Number(variables[inp.varName] ?? NaN);
          case 'result': return Number(stepResults[inp.stepId] ?? NaN);
          default: return NaN;
        }
      };

      for (let i = 0; i < this.steps.length; i++){
        const step = this.steps[i];
        const op = this.operations[step.operation];
        if (!op) return NaN;
        const inputValues = (step.inputs || []).map(resolveInput);
        // Validate counts
        const count = inputValues.length;
        if ((op.minInputs && count < op.minInputs) || (op.maxInputs && count > op.maxInputs)) return NaN;
        // Any NaN -> result NaN
        if (inputValues.some(v => Number.isNaN(v))) { stepResults[step.id] = NaN; continue; }
        try {
          stepResults[step.id] = op.exec(inputValues);
        } catch(e){ stepResults[step.id] = NaN; }
      }
      // final result of last step
      if (!this.steps.length) return NaN;
      return stepResults[this.steps[this.steps.length - 1].id];
    }

    // Internal: UI management
    addStep(){
      const newStep = { id: uid('step'), operation: 'sum', inputs: [ { type:'parameter', paramId:'' }, { type:'parameter', paramId:'' } ] };
      this.steps.push(newStep);
      this.render();
      this.syncHidden();
    }

    removeStep(idx){
      this.steps.splice(idx, 1);
      this.render();
      this.syncHidden();
    }

    addInput(idx){
      const step = this.steps[idx];
      const op = this.operations[step.operation];
      if (op.maxInputs && step.inputs.length >= op.maxInputs) return;
      step.inputs.push({ type:'constant', value: 0 });
      this.render();
      this.syncHidden();
    }

    removeInput(stepIdx, inputIdx){
      const step = this.steps[stepIdx];
      if (step.inputs.length <= 1) return;
      step.inputs.splice(inputIdx, 1);
      this.render();
      this.syncHidden();
    }

    changeOperation(idx, operation){
      const step = this.steps[idx];
      step.operation = operation;
      const op = this.operations[operation];
      // Fit input count to min
      if (op && step.inputs.length < (op.minInputs || 1)){
        while (step.inputs.length < (op.minInputs || 1)) step.inputs.push({ type:'constant', value: 0 });
      }
      if (op && op.maxInputs && step.inputs.length > op.maxInputs){
        step.inputs = step.inputs.slice(0, op.maxInputs);
      }
      this.render();
      this.syncHidden();
    }

    changeInputType(stepIdx, inputIdx, type){
      const step = this.steps[stepIdx];
      const prev = step.inputs[inputIdx];
      let next = { type };
      if (type === 'parameter') next.paramId = '';
      if (type === 'variable') next.varName = '';
      if (type === 'constant') next.value = 0;
      if (type === 'result') next.stepId = '';
      step.inputs[inputIdx] = next;
      this.render();
      this.syncHidden();
    }

    updateInputDetail(stepIdx, inputIdx, key, value){
      const step = this.steps[stepIdx];
      step.inputs[inputIdx][key] = value;
      this.syncHidden();
      this.renderPreview();
    }

    render(){
      if (!this.stepsWrap) return;
      this.stepsWrap.innerHTML = '';
      this.steps.forEach((step, idx) => {
        const stepHeader = el('div', { class:'calc-step-header' }, [
          el('div', { class:'calc-step-title' }, `Step ${idx+1}`),
          el('div', {}, [
            el('span', { class:'calc-badge', style:'margin-right:8px;' }, step.id),
            el('button', { class:'calc-btn calc-danger', onclick: () => this.removeStep(idx) }, 'Remove')
          ])
        ]);

        const opSelect = el('select', { class:'calc-select', onchange: (e)=> this.changeOperation(idx, e.target.value) });
        Object.entries(this.operations).forEach(([key,op])=>{
          opSelect.appendChild(el('option', { value:key, selected: step.operation===key ? 'selected' : null }, op.label));
        });

        // Ensure correct selected option after building list
        opSelect.value = step.operation;
        const opRow = el('div', { class:'calc-row', style:'margin-bottom:6px;' }, [ el('span', {}, 'Operation:'), opSelect, el('span', { class:'calc-help' }, this.operations[step.operation]?.description || '') ]);

        // Inputs row(s)
        const inputsWrap = el('div', { class:'calc-row', style:'flex-direction: column; gap:6px; align-items: stretch;' });
        step.inputs.forEach((inp, iidx) => {
          const row = el('div', { class:'calc-row', style:'align-items: center;' });
          const typeSel = makeSourceSelect({ defaultValue: inp.type });
          typeSel.addEventListener('change', (e)=> this.changeInputType(idx, iidx, e.target.value));
          row.appendChild(typeSel);

          // details per type
          let detail;
          if (inp.type === 'parameter'){
            detail = makeParamSelect(this.params);
            detail.value = inp.paramId || '';
            detail.addEventListener('change', (e)=> this.updateInputDetail(idx, iidx, 'paramId', e.target.value));
          } else if (inp.type === 'variable'){
            detail = makeVariableSelect(this.variables);
            detail.value = inp.varName || '';
            detail.addEventListener('change', (e)=> this.updateInputDetail(idx, iidx, 'varName', e.target.value));
          } else if (inp.type === 'constant'){
            detail = makeConstantInput();
            if (inp.value != null) detail.value = inp.value;
            detail.addEventListener('input', (e)=> this.updateInputDetail(idx, iidx, 'value', e.target.value));
          } else if (inp.type === 'result'){
            detail = makeResultSelect(this.steps, idx);
            detail.value = inp.stepId || '';
            detail.addEventListener('change', (e)=> this.updateInputDetail(idx, iidx, 'stepId', e.target.value));
          } else {
            detail = el('span', { class:'calc-help' }, 'Select input type');
          }
          row.appendChild(detail);

          row.appendChild(el('button', { class:'calc-btn', onclick: ()=> this.removeInput(idx, iidx) }, '−'));
          inputsWrap.appendChild(row);
        });

        const addInputBtn = el('button', { class:'calc-btn', onclick: ()=> this.addInput(idx) }, '+ Add Input');
        const inputsSection = el('div', {}, [ inputsWrap, addInputBtn ]);

        const stepEl = el('div', { class:'calc-step' }, [ stepHeader, opRow, inputsSection ]);
        this.stepsWrap.appendChild(stepEl);
      });

      this.renderPreview();
    }

    renderPreview(){
      if (!this.previewWrap) return;
      const toLabel = (inp, idx) => {
        if (!inp) return '?';
        if (inp.type === 'constant') return `[${Number(inp.value ?? 0)}]`;
        if (inp.type === 'parameter'){
          const p = this.params.find(x => (x.id||x.name||x.key) === inp.paramId);
          return `[${p?.label || p?.name || p?.id || 'parameter'}]`;
        }
        if (inp.type === 'variable'){
          const v = this.variables.find(x => (x.id||x.name) === inp.varName);
          return `[${v?.label || v?.name || 'variable'}]`;
        }
        if (inp.type === 'result'){
          const stepIdx = this.steps.findIndex(s => s.id === inp.stepId);
          return stepIdx >= 0 ? `Result of Step ${stepIdx+1}` : 'Result (?)';
        }
        return '?';
      };

      const lines = this.steps.map((s, idx) => {
        const op = this.operations[s.operation];
        const sym = op?.symbol || s.operation;
        const parts = (s.inputs||[]).map((inp,i)=> toLabel(inp, i));
        return `Step ${idx+1} = ${parts.join(` ${sym} `)}`;
      });
      if (lines.length){
        lines.push(`Final Result = Result of Step ${lines.length}`);
      }
      this.previewWrap.textContent = lines.join('\n');
    }

    syncHidden(){
      if (!this.hiddenInput) return;
      try { this.hiddenInput.value = JSON.stringify(this.getCalculation()); } catch(_){}
    }
  }

  // Auto-mount if containers exist
  function autoMount(){
    const containers = document.querySelectorAll('.calculation-builder, .calculation-builder-container');
    if (!containers.length) return;
    containers.forEach(c => {
      const cb = new CalculationBuilder();
      // Bind optional hidden input with class .calculation-json inside container
      const hidden = c.querySelector('.calculation-json');
      cb.mount(c, { hiddenInput: hidden || null });
      // Expose instance for advanced integrations
      c.__calcBuilder = cb;
    });
  }

  // Static utility: compute without UI instance
  CalculationBuilder.compute = function(calculation, context = {}){
    try {
      const obj = typeof calculation === 'string' ? JSON.parse(calculation) : calculation;
      const steps = Array.isArray(obj?.steps) ? obj.steps : (Array.isArray(obj) ? obj : []);
      const operations = DEFAULT_OPERATIONS;
      const parameters = context.parameters || {};
      const variables = context.variables || {};
      const stepResults = {};
      const resolve = (inp) => {
        if (!inp) return NaN;
        switch(inp.type){
          case 'constant': return Number(inp.value ?? 0);
          case 'parameter': return Number(parameters[inp.paramId] ?? NaN);
          case 'variable': return Number(variables[inp.varName] ?? NaN);
          case 'result': return Number(stepResults[inp.stepId] ?? NaN);
          default: return NaN;
        }
      };
      for (let i=0;i<steps.length;i++){
        const s = steps[i];
        const op = operations[s.operation];
        if (!op) return NaN;
        const vals = (s.inputs||[]).map(resolve);
        const count = vals.length;
        if ((op.minInputs && count < op.minInputs) || (op.maxInputs && count > op.maxInputs)) return NaN;
        if (vals.some(v => Number.isNaN(v))) { stepResults[s.id || `s${i+1}`] = NaN; continue; }
        try { stepResults[s.id || `s${i+1}`] = op.exec(vals); } catch(e){ stepResults[s.id || `s${i+1}`] = NaN; }
      }
      if (!steps.length) return NaN;
      const lastId = steps[steps.length-1].id || `s${steps.length}`;
      return stepResults[lastId];
    } catch(e){ return NaN; }
  };

  window.CalculationBuilder = CalculationBuilder;
  document.addEventListener('DOMContentLoaded', function(){
  // Defer auto-mount to end of task queue to ensure modal DOM is present
  setTimeout(autoMount, 0);
});
})();


// ============================================================================
// CONTENT FROM: calc-engine.js
// Calculation Engine Manager
// Bridges multi-step CalculationBuilder formulas with table inputs
// Provides:
// - calculationBuilder.executeCalculation(calculation, tableId, colIndex)
// - calculationBuilder.recalculateDependents(tableId, paramName, colIndex)
// - calculationBuilder.compute(calculation, context)
// ============================================================================
(function(){
  function toNumber(v){ const n = Number(v); return Number.isFinite(n) ? n : NaN; }

  function buildParametersContext(tableId, colIndex){
    const params = {};
    
    // Find all inputs in the same column across all tables
    // This allows calculations to reference parameters from other tables
    const allInputs = document.querySelectorAll(`input[data-col-index="${CSS.escape(String(colIndex))}"]`);
    
    allInputs.forEach(input => {
      // Skip calculated fields to avoid circular dependencies
      if (input.classList.contains('gui-calculated') || input.classList.contains('formula-calculated')) {
        return;
      }
      
      const name = input.dataset.paramName || input.closest('tr')?.querySelector('.param-label')?.textContent?.trim();
      const pid = input.dataset.paramId;
      const val = toNumber(input.value);
      
      if (!Number.isNaN(val)){
        if (name) {
          // If parameter from different table, prefix with table name
          const inputTableId = input.dataset.tableId;
          if (inputTableId && inputTableId !== tableId) {
            // Try to get table name from the table element
            const tableEl = input.closest('table');
            const tableName = tableEl?.dataset?.tableName || inputTableId;
            params[`${tableName}.${name}`] = val;
          }
          params[name] = val; // Also store without prefix for backward compatibility
        }
        if (pid) params[pid] = val;   // by internal id
      }
    });
    
    return params;
  }

  function buildVariablesContext(){
    // Try global map if provided by host app
    if (window.getCustomVariables && typeof window.getCustomVariables === 'function'){
      try { return window.getCustomVariables() || {}; } catch(_){}
    }
    if (window.customVariablesMap && typeof window.customVariablesMap === 'object'){
      return window.customVariablesMap;
    }
    // Fallback: read any inputs tagged as custom variables
    const vars = {};
    // Look for variables in both the modal and the main document
    const containers = ['#productModal #variables-container', '#product-modal #variables-container', '#variables-container'];
    containers.forEach(selector => {
      const container = document.querySelector(selector);
      if (container) {
        container.querySelectorAll('.variable-row').forEach(row => {
          const nameInput = row.querySelector('.variable-name');
          const valueInput = row.querySelector('.variable-value');
          if (nameInput && valueInput) {
            const name = nameInput.value?.trim();
            const val = toNumber(valueInput.value);
            if (name && !Number.isNaN(val)) {
              vars[name] = val;
            }
          }
        });
      }
    });
    
    // Also check for any other variable inputs with data attributes
    document.querySelectorAll('[data-variable-name]').forEach(el => {
      const name = el.dataset.variableName;
      const val = toNumber(el.value);
      if (name && !Number.isNaN(val)) vars[name] = val;
    });
    
    return vars;
  }

  function compute(calculation, context){
    if (window.CalculationBuilder && typeof window.CalculationBuilder.compute === 'function'){
      return window.CalculationBuilder.compute(calculation, context);
    }
    // Minimal inline evaluator (sum, subtract, multiply, divide)
    try {
      const obj = typeof calculation === 'string' ? JSON.parse(calculation) : calculation;
      const steps = obj?.steps || [];
      const stepResults = {};
      const resolve = (inp) => {
        switch(inp.type){
          case 'constant': return Number(inp.value ?? 0);
          case 'parameter': return Number(context.parameters?.[inp.paramId] ?? NaN);
          case 'variable': return Number(context.variables?.[inp.varName] ?? NaN);
          case 'result': return Number(stepResults[inp.stepId] ?? NaN);
          default: return NaN;
        }
      };
      for (let i=0;i<steps.length;i++){
        const s = steps[i];
        const vals = (s.inputs||[]).map(resolve);
        if (vals.some(v => Number.isNaN(v))) { stepResults[s.id] = NaN; continue; }
        let r = NaN;
        switch(s.operation){
          case 'sum': r = vals.reduce((a,b)=>a+b,0); break;
          case 'subtract': r = vals.slice(1).reduce((a,b)=>a-b, vals[0] ?? 0); break;
          case 'multiply': r = vals.reduce((a,b)=>a*b,1); break;
          case 'divide': r = (vals[1]===0) ? NaN : (vals[0] ?? 0) / vals[1]; break;
          case 'average': r = vals.reduce((a,b)=>a+b,0) / (vals.length || 1); break;
          case 'min': r = Math.min(...vals); break;
          case 'max': r = Math.max(...vals); break;
          default: r = NaN;
        }
        stepResults[s.id] = r;
      }
      return steps.length ? stepResults[steps[steps.length-1].id] : NaN;
    } catch(_){ return NaN; }
  }

  function executeCalculation(calculation, tableId, colIndex){
    try {
      const parameters = buildParametersContext(tableId, colIndex);
      const variables = buildVariablesContext();
      const ctx = { parameters, variables };
      return compute(calculation, ctx);
    } catch(e){
      console.warn('executeCalculation error', e);
      return NaN;
    }
  }

  function formatNumber(value){
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    return Math.round(value * 100) / 100; // keep as number for inputs of type="number"
  }

  function recalculateDependents(tableId, paramName, colIndex){
    try {
      // Find all calculated inputs in the same column
      const calculatedInputs = document.querySelectorAll(`.gui-calculated[data-col-index="${CSS.escape(String(colIndex))}"]`);
      
      calculatedInputs.forEach(input => {
        const calcStr = input.dataset.calculation;
        if (!calcStr) return;
        
        let calculation;
        try { 
          calculation = JSON.parse(decodeURIComponent(calcStr)); 
        } catch(e){ 
          console.warn('Failed to parse calculation:', e);
          return; 
        }
        
        // Execute calculation for this input's table context
        const inputTableId = input.dataset.tableId || tableId;
        const value = executeCalculation(calculation, inputTableId, colIndex);
        
        if (typeof value === 'number' && Number.isFinite(value)) {
          input.value = value.toFixed(2);
          // Trigger change event for any dependent calculations
          const ev = new Event('change', { bubbles: true });
          input.dispatchEvent(ev);
        } else {
          input.value = '';
        }
      });
    } catch(e){ 
      console.error('recalculateDependents error:', e); 
    }
  }

  // Initialize CalculationBuilder instance if available
  let builderInstance = null;
  if (window.CalculationBuilder) {
    builderInstance = new window.CalculationBuilder();
  }

  // Helper: resolve the exact container to mount the builder inside a parameter row
  function resolveMountContainer(container){
    let mountEl = container;
    try {
      if (container && container.querySelector) {
        const builderBox = container.querySelector('.calc-builder-box');
        if (builderBox) return builderBox;
        const inner = container.querySelector('.calculation-fields');
        if (inner) return inner;
      }
    } catch(_){/*noop*/}
    return mountEl;
  }

  // Helper: collect parameter options from ALL sections in the product modal or form
  function collectParamsNear(el){
    const params = [];
    const seenNames = new Set();
    
    // Check if we're in a product modal or the main form
    const modal = el.closest?.('#productModal, #product-modal');
    const root = modal || document;
    
    // Collect ALL parameters from ALL sections/tables
    // While editing product, parameter names live in .param-name inputs
    root.querySelectorAll('.param-name').forEach(input => {
      const v = (input.value || '').trim();
      if (v && !seenNames.has(v)) {
        seenNames.add(v);
        // Try to get the section/table name for better labeling
        const tableContainer = input.closest('.table-container');
        const sectionName = tableContainer?.querySelector('.table-name')?.value?.trim() || '';
        const label = sectionName ? `${sectionName} - ${v}` : v;
        params.push({ id: v, label: label, name: v });
      }
    });
    
    // Fallback to any labels on rendered form (when viewing, not editing)
    if (!params.length){
      document.querySelectorAll('.param-label').forEach(label => {
        const text = (label.textContent || '').trim();
        if (text && !seenNames.has(text)) {
          seenNames.add(text);
          const tableEl = label.closest('table');
          const sectionName = tableEl?.dataset?.tableName || '';
          const displayLabel = sectionName ? `${sectionName} - ${text}` : text;
          params.push({ id: text, label: displayLabel, name: text });
        }
      });
    }
    
    return params;
  }

  // Iterate all mounted builder instances on the page
  function forEachBuilderInstance(cb){
    const containers = document.querySelectorAll('.calculation-fields, .calculation-builder-container');
    containers.forEach(c => {
      const inst = c.__calcBuilder;
      if (inst) cb(inst, c);
    });
  }

  // Public API with extended methods
  const __templateRegistry = {};
window.calculationBuilder = {
    compute,
    executeCalculation,
    recalculateDependents,
    
    // Bridge methods for CalculationBuilder
    initializeBuilder(container, calculation) {
      if (!window.CalculationBuilder){
        console.warn('CalculationBuilder not loaded');
        return;
      }
      const mountEl = resolveMountContainer(container);
      // Mark for later lookups
      mountEl.classList.add('calculation-builder-container');
      // Ensure a hidden input to persist JSON
      let hidden = mountEl.querySelector('.calculation-json');
      if (!hidden){
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.className = 'calculation-json';
        mountEl.appendChild(hidden);
      }
      
      // Collect ALL parameters and variables
      const params = collectParamsNear(mountEl);
      const vars = buildVariablesContext();
      const formattedVars = Object.keys(vars).map(name => ({
        id: name,
        name: name,
        label: name
      }));
      
      // Create or reuse an instance for this mount
      const instance = mountEl.__calcBuilder || new window.CalculationBuilder();
      instance.params = params;
      instance.variables = formattedVars;
      instance.mount(mountEl, { 
        params: params, 
        variables: formattedVars,
        hiddenInput: hidden 
      });
      // Store instance on the mount element and also on the nearest .calculation-fields for reliable retrieval
      mountEl.__calcBuilder = instance;
      const fieldsContainer = mountEl.closest ? mountEl.closest('.calculation-fields') : null;
      if (fieldsContainer) fieldsContainer.__calcBuilder = instance;
      
      if (calculation) {
        try { 
          instance.loadCalculation(calculation); 
        } catch(e){ 
          console.warn('Error loading calculation:', e); 
        }
      }
    },
    
    setCustomVariables(variables) {
      if (!window.CalculationBuilder){
        console.warn('CalculationBuilder not loaded');
        return;
      }
      // Format variables properly, handling both object and string inputs
      const formatted = (variables || []).map(v => {
        if (typeof v === 'string') {
          return { id: v, name: v, label: v };
        }
        return { 
          id: v.name || v.id || v, 
          name: v.name || v.id || v,
          label: v.label || v.name || v.id || v 
        };
      });
      
      // Update all builder instances
      forEachBuilderInstance((inst)=>{
        if (inst.setContext) {
          inst.setContext({ variables: formatted });
        } else {
          inst.variables = formatted;
        }
        // Force re-render to update dropdowns
        if (inst.render) inst.render();
      });
    },
    
    refreshParameterOptions() {
      // Collect custom variables too when refreshing parameters
      const vars = buildVariablesContext();
      const formattedVars = Object.keys(vars).map(name => ({
        id: name,
        name: name,
        label: name
      }));
      
      forEachBuilderInstance((inst, el)=>{
        const params = collectParamsNear(el);
        if (inst.setContext) {
          inst.setContext({ params, variables: formattedVars });
        } else {
          inst.params = params;
          inst.variables = formattedVars;
        }
        if (inst.render) inst.render();
      });
    },
    
    // Extract calculation JSON from the builder inside given container
    extractCalculation(container){
      const mountEl = resolveMountContainer(container);
      let inst = mountEl.__calcBuilder;
      if (!inst && container && container.__calcBuilder) inst = container.__calcBuilder;
      if (!inst && mountEl && mountEl.closest) {
        const fieldsContainer = mountEl.closest('.calculation-fields');
        if (fieldsContainer && fieldsContainer.__calcBuilder) inst = fieldsContainer.__calcBuilder;
      }
      if (!inst || !inst.getCalculation) return null;
      try { return inst.getCalculation(); } catch(_){ return null; }
    },

    // Expose the builder instance for direct access if needed
    getBuilderInstance() {
      return builderInstance;
    },
    
    // Recalculate all GUI-calculated inputs on the page
    recalculateAll() {
      // Find all calculated inputs
      const calculatedInputs = document.querySelectorAll('.gui-calculated, input[data-calculation]');
      
      calculatedInputs.forEach(input => {
        const calculationStr = input.dataset.calculation;
        const tableId = input.dataset.tableId;
        const colIndex = input.dataset.colIndex;
        
        if (calculationStr && tableId !== undefined && colIndex !== undefined) {
          try {
            const calculation = JSON.parse(decodeURIComponent(calculationStr));
            const result = this.executeCalculation(calculation, tableId, parseInt(colIndex));
            
            if (typeof result === 'number' && Number.isFinite(result)) {
              input.value = result.toFixed(2);
            } else {
              input.value = '';
            }
          } catch (e) {
            console.warn('Error recalculating input:', e);
            input.value = '';
          }
        }
      });
    }
  };
})();