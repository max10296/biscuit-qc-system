(function(){
  'use strict';

  const STORAGE_KEYS = {
    mainTab: 'qcMainTab:selected',
    settingsTab: 'qcSettingsTab:selected'
  };

  function save(key, value){
    try { localStorage.setItem(key, value); } catch(_){ /* storage might be unavailable */ }
  }

  function read(key){
    try { return localStorage.getItem(key) || ''; } catch(_){ return ''; }
  }

  function throttle(fn, wait){
    let ticking = false;
    return function(){
      if (ticking) return;
      ticking = true;
      const context = this;
      const args = arguments;
      requestAnimationFrame(function(){
        fn.apply(context, args);
        setTimeout(function(){ ticking = false; }, wait);
      });
    };
  }

  function prefersReducedMotion(){
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(_){ return false; }
  }

  document.addEventListener('DOMContentLoaded', function(){
    restoreMainTabState();
    restoreSettingsTabState();
    enhanceScrollingExperience();
  });

  function restoreMainTabState(){
    const tabs = Array.from(document.querySelectorAll('.tab[data-tab]'));
    if (!tabs.length) return;

    const saved = read(STORAGE_KEYS.mainTab);
    if (saved){
      const target = tabs.find(tab => tab.getAttribute('data-tab') === saved);
      if (target && !target.classList.contains('active')){
        requestAnimationFrame(() => target.click());
      }
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const name = tab.getAttribute('data-tab') || '';
        if (name) save(STORAGE_KEYS.mainTab, name);
      });
    });
  }

  function restoreSettingsTabState(){
    const buttons = Array.from(document.querySelectorAll('.settings-tab-button[data-settings-tab]'));
    if (!buttons.length) return;

    const saved = read(STORAGE_KEYS.settingsTab);
    if (saved){
      const target = buttons.find(btn => btn.getAttribute('data-settings-tab') === saved);
      if (target && !target.classList.contains('active')){
        requestAnimationFrame(() => target.click());
      }
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-settings-tab') || '';
        if (name) save(STORAGE_KEYS.settingsTab, name);
      });
    });
  }

  function enhanceScrollingExperience(){
    const backToTop = document.createElement('button');
    backToTop.type = 'button';
    backToTop.className = 'back-to-top';
    backToTop.setAttribute('aria-label', 'Scroll back to top');
    backToTop.setAttribute('aria-hidden', 'true');
    backToTop.innerHTML = '<i class="fas fa-arrow-up"></i><span>Top</span>';
    document.body.appendChild(backToTop);

    function scrollToTop(){
      const options = { top: 0 };
      if (!prefersReducedMotion()) options.behavior = 'smooth';
      window.scrollTo(options);
    }

    backToTop.addEventListener('click', scrollToTop);

    const updateVisibility = () => {
      const shouldShow = window.scrollY > 320;
      backToTop.classList.toggle('back-to-top--visible', shouldShow);
      backToTop.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    };

    window.addEventListener('scroll', throttle(updateVisibility, 120));
    window.addEventListener('resize', throttle(updateVisibility, 200));
    updateVisibility();
  }
})();
