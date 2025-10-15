// Product Management UI Integration Layer for Prompt-driven AI Tables
// Provides per-product storage namespace and simple init with product switching
(function(){
  'use strict';

  const Integration = {
    engine: null,
    cfg: null,
    init(cfg){
      // cfg: { productIdInput, dslSelector, containerSelector, errorsSelector, useAPI }
      this.cfg = cfg;
      this.engine = window.PromptTableEngine;
      if(!this.engine) throw new Error('PromptTableEngine not found. Load js/prompt-table-engine.js first.');

      // Initialize engine with provided selectors if present
      this.engine.init({
        dslSelector: cfg.dslSelector || this.engine.state.dslSelector,
        tablesContainer: cfg.containerSelector || this.engine.state.tablesContainer,
        errorsSelector: cfg.errorsSelector || this.engine.state.errorsSelector,
        useAPI: !!cfg.useAPI
      });

      const pidInput = document.querySelector(cfg.productIdInput);
      if(pidInput){
        pidInput.addEventListener('input', ()=>{
          this.setProduct(pidInput.value.trim());
        });
        this.setProduct(pidInput.value.trim());
      } else {
        // Fallback: no product id input, just build once
        this.engine.buildFromDSL();
      }
    },
    setProduct(productId){
      // Use productId as namespace to separate storage per product
      this.engine.setStorageNamespace(productId || '');
      // optional: try to load existing product-specific data
      this.engine.loadAll();
      // rebuild from current DSL
      this.engine.buildFromDSL();
    },
    setDSL(text){
      const ta = document.querySelector(this.engine.state.dslSelector);
      if(ta){ ta.value = text; }
      this.engine.buildFromDSL();
    },
    exportJSON(){
      const payload = { schema: this.engine.state.schema, data: this.engine.state.data, dsl: document.querySelector(this.engine.state.dslSelector)?.value || '' };
      return JSON.stringify(payload, null, 2);
    },
    importJSON(json){
      try{
        const payload = (typeof json==='string')? JSON.parse(json) : json;
        this.engine.state.schema = payload.schema || {};
        this.engine.state.data = payload.data || {};
        if(payload.dsl){ const ta = document.querySelector(this.engine.state.dslSelector); if(ta) ta.value = payload.dsl; }
        this.engine.renderAll();
        this.engine.saveAll();
      }catch(e){
        alert('Import failed: '+(e.message||e));
      }
    }
  };

  window.ProductAIIntegration = Integration;
})();
