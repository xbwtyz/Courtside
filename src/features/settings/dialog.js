  // ---------------- Courtside 1.5.3 settings interface ----------------
  let settingsReturnFocus=null;
  const settingsTabs=['general','ticker','viewer','leaders','alerts','data','whatsnew'];
  function syncSettingsControls(){
    $('settingsLanding').value=settingsPrefs.landing;
    $('settingsDefaultLiveOnly').checked=settingsPrefs.defaultLiveOnly;
    $('settingsDefaultStatsTab').value=settingsPrefs.defaultStatsTab;
    $('settingsDefaultLayout').value=String(settingsPrefs.defaultLayout);
    $('settingsDefaultStatsOpen').checked=settingsPrefs.defaultStatsOpen;
    $('settingsDefaultViewerTicker').checked=settingsPrefs.defaultViewerTicker;
    $('settingsShowTicker').checked=settingsPrefs.showTicker;
    $('settingsAutoScroll').checked=settingsPrefs.autoScroll;
    $('settingsTickerSpeed').value=settingsPrefs.tickerSpeed;
    $('settingsTickerSpeed').disabled=!settingsPrefs.autoScroll;
    $('settingsLeadersCategory').value=settingsPrefs.leadersCategory;
    $('settingsLeadersRows').value=String(settingsPrefs.leadersRows);
    alertsSyncSettings();
    $('settingsStorageStatus').textContent=settingsStorageAvailable?'Preferences are stored in this browser':'Browser storage unavailable · changes last for this session only';
  }
  function selectAppSettingsTab(tab){
    if(!settingsTabs.includes(tab))tab='general';
    for(const name of settingsTabs){
      const section=$('csSettings'+name[0].toUpperCase()+name.slice(1));
      section.hidden=name!==tab;
      const btn=$('csSettingsTab'+name[0].toUpperCase()+name.slice(1));
      btn.setAttribute('aria-selected',String(name===tab));
      btn.tabIndex=name===tab?0:-1;
    }
    $('appSettingsDialog').querySelector('.cs-settings-body').scrollTop=0;
    if(tab==='data')renderDataLogPerformance();
    if(tab==='alerts')alertsSyncSettings();
    if(tab==='whatsnew'){markWhatsNewRead();renderWhatsNew();}
    // Keep the selected Settings section visible in the horizontal mobile tab strip.
    if(window.matchMedia('(max-width:730px)').matches && !$('appSettingsModal').hidden){
      $('csSettingsTab'+tab[0].toUpperCase()+tab.slice(1)).scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
    }
  }
  function openAppSettings(tab='general'){
    const modal=$('appSettingsModal');
    if(modal.hidden){settingsReturnFocus=document.activeElement;modal.hidden=false;document.body.classList.add('cs-settings-open');}
    syncSettingsControls();selectAppSettingsTab(tab);alertsUpdateToastVisibility();
    $('appSettingsClose').focus({preventScroll:true});
  }
  function closeAppSettings(){
    if($('appSettingsModal').hidden)return;
    $('appSettingsModal').hidden=true;document.body.classList.remove('cs-settings-open');alertsUpdateToastVisibility();
    if(settingsReturnFocus?.isConnected)settingsReturnFocus.focus({preventScroll:true});
    settingsReturnFocus=null;
  }
  for(const id of ['appSettingsOpen','viewerSettingsOpen'])$(id).addEventListener('click',()=>openAppSettings());
  $('appSettingsClose').addEventListener('click',closeAppSettings);
  $('appSettingsBackdrop').addEventListener('click',closeAppSettings);
  $('whatsNewOpenFromGeneral').addEventListener('click',()=>selectAppSettingsTab('whatsnew'));
  for(const button of $('appSettingsDialog').querySelectorAll('[data-settings-tab]')){
    button.addEventListener('click',()=>selectAppSettingsTab(button.dataset.settingsTab));
    button.addEventListener('keydown',event=>{
      if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      event.preventDefault();
      const current=settingsTabs.indexOf(button.dataset.settingsTab);
      const direction=['ArrowRight','ArrowDown'].includes(event.key)?1:-1;
      const next=event.key==='Home'?settingsTabs[0]:event.key==='End'?settingsTabs[settingsTabs.length-1]:settingsTabs[(current+direction+settingsTabs.length)%settingsTabs.length];
      selectAppSettingsTab(next);
      $('csSettingsTab'+next[0].toUpperCase()+next.slice(1)).focus();
    });
  }
  function changeSettingsPref(key,value){
    settingsPrefs[key]=value;saveSettingsPrefs();syncSettingsControls();applySettingsPrefs();
  }
  $('settingsLanding').addEventListener('change',event=>changeSettingsPref('landing',event.target.value));
  $('settingsDefaultLiveOnly').addEventListener('change',event=>changeSettingsPref('defaultLiveOnly',event.target.checked));
  $('settingsDefaultStatsTab').addEventListener('change',event=>changeSettingsPref('defaultStatsTab',event.target.value));
  $('settingsDefaultLayout').addEventListener('change',event=>changeSettingsPref('defaultLayout',Number(event.target.value)));
  $('settingsDefaultStatsOpen').addEventListener('change',event=>changeSettingsPref('defaultStatsOpen',event.target.checked));
  $('settingsDefaultViewerTicker').addEventListener('change',event=>changeSettingsPref('defaultViewerTicker',event.target.checked));
  $('settingsShowTicker').addEventListener('change',event=>changeSettingsPref('showTicker',event.target.checked));
  $('settingsAutoScroll').addEventListener('change',event=>changeSettingsPref('autoScroll',event.target.checked));
  $('settingsTickerSpeed').addEventListener('change',event=>changeSettingsPref('tickerSpeed',event.target.value));
  $('settingsLeadersCategory').addEventListener('change',event=>{
    changeSettingsPref('leadersCategory',event.target.value);
    leaderSetCategory(settingsPrefs.leadersCategory);
  });
  $('settingsLeadersRows').addEventListener('change',event=>{
    changeSettingsPref('leadersRows',Number(event.target.value));
    leaderState.rows=settingsPrefs.leadersRows;leaderState.page=1;renderLeaders();
  });
  $('settingsResetAll').addEventListener('click',()=>{
    if(!confirm('Restore default Courtside settings? Your streams and cached game data will not be cleared.'))return;
    settingsPrefs={...SETTINGS_DEFAULTS};alertsResetBaseline();saveSettingsPrefs();syncSettingsControls();applySettingsPrefs();alertsRenderToasts();
    leaderSetCategory(settingsPrefs.leadersCategory);
    leaderState.rows=settingsPrefs.leadersRows;leaderState.page=1;renderLeaders();
  });
  // Settings is above the player overlay: capture Escape/Tab before viewer listeners.
  document.addEventListener('keydown',event=>{
    if($('appSettingsModal').hidden)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();closeAppSettings();return;
    }
    if(event.key!=='Tab')return;
    const focusables=[...$('appSettingsDialog').querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),a[href]')].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length);
    if(!focusables.length)return;
    const first=focusables[0],last=focusables[focusables.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  },true);
