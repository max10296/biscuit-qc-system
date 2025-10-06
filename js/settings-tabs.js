// Tabs logic for main and settings tabs with explicit show/hide to override inline styles
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    // Helpers
    function show(el){ if(el){ el.style.display = ''; el.classList.add('active'); } }
    function hide(el){ if(el){ el.style.display = 'none'; el.classList.remove('active'); } }

    // Initialize top-level tab contents: hide all except the one with .active
    const tabContents = Array.from(document.querySelectorAll('.tab-content'));
    tabContents.forEach(c=>{ if(!c.classList.contains('active')) hide(c); else show(c); });

    // Top-level tabs
    const tabs = Array.from(document.querySelectorAll('.tab'));
    tabs.forEach(tab=>{
      tab.addEventListener('click', ()=>{
        const name = tab.getAttribute('data-tab');
        tabs.forEach(t=> t.classList.remove('active'));
        tab.classList.add('active');
        tabContents.forEach(c=> hide(c));
        const panel = document.getElementById(name);
        if(panel) show(panel);
      });
    });

    // Settings inner tabs
    const btns = Array.from(document.querySelectorAll('.settings-tab-button'));
    const settingsPanels = {
      'general': document.getElementById('general-settings'),
      'product-management': document.getElementById('product-management-settings'),
      
      'formulas-library': document.getElementById('formulas-library-settings')
    };

    function activateSettings(id){
      btns.forEach(b=> b.classList.toggle('active', b.getAttribute('data-settings-tab')===id));
      Object.values(settingsPanels).forEach(p=> hide(p));
      const key = (id==='product-management'||id==='formulas-library') ? id : 'general';
      const el = settingsPanels[key];
      if(el) show(el);
    }

    btns.forEach(b=> b.addEventListener('click', ()=> activateSettings(b.getAttribute('data-settings-tab'))));

    // Ensure defaults visible
    const defaultSettingsButton = document.querySelector('.settings-tab-button.active');
    if(defaultSettingsButton){
      activateSettings(defaultSettingsButton.getAttribute('data-settings-tab'));
    } else {
      activateSettings('general');
    }
  });
})();
