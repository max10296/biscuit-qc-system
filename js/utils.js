// Shared utilities: toast, confirm, debounce, unique ID
(function(){
  'use strict';
  const g = window.AppUtil = window.AppUtil || {};

  g.debounce = function(fn,ms){ let t; return function(){ const a=arguments, c=this; clearTimeout(t); t=setTimeout(()=>fn.apply(c,a),ms); }; };
  g.genId = function(){ try{ return crypto.randomUUID(); }catch(_){ return 'local_'+Math.random().toString(36).slice(2); } };

  // Toast system
  function ensureWrap(){ let w = document.querySelector('.app-toast-wrap'); if(!w){ w = document.createElement('div'); w.className='app-toast-wrap'; document.body.appendChild(w);} return w; }
  g.toast = function(type, title, msg){
    const wrap = ensureWrap();
    const t = document.createElement('div'); t.className = `app-toast ${type||'info'}`;
    t.innerHTML = `<div><div class="title">${title||''}</div><div class="msg">${msg||''}</div></div><button class="close">✕</button>`;
    t.querySelector('.close').onclick = ()=> t.remove();
    wrap.appendChild(t); setTimeout(()=> t.remove(), 5000);
  };

  g.confirm = function(message){ return new Promise(res=>{ const ok = window.confirm(message||'Are you sure?'); res(ok); }); };
})();
