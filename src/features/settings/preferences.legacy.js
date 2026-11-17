  // Courtside 1.5.3 — local, versioned browser preferences.
  const SETTINGS_STORAGE_KEY='courtside.preferences.v1';
  const SETTINGS_DEFAULTS=Object.freeze({
    landing:'scores',defaultLiveOnly:false,showTicker:true,autoScroll:true,tickerSpeed:'normal',
    defaultStatsTab:'box',defaultLayout:1,defaultStatsOpen:true,defaultViewerTicker:false,
    leadersCategory:'scoring',leadersRows:25,
    alertsEnabled:false,alertsScope:'all',alertsTeams:[],
    alertsStart:true,alertsHalftime:false,alertsFinal:true,alertsLead:false,alertsClose:true,
    alertsSound:false,alertsVolume:'low',alertsOverlay:false
  });
  let settingsStorageAvailable=true;
  function loadSettingsPrefs(){
    try{
      const source=JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)||'{}');
      if(!source||typeof source!=='object'||Array.isArray(source))return {...SETTINGS_DEFAULTS};
      const next={...SETTINGS_DEFAULTS};
      if(['scores','standings','leaders'].includes(source.landing))next.landing=source.landing;
      if(typeof source.defaultLiveOnly==='boolean')next.defaultLiveOnly=source.defaultLiveOnly;
      if(['overview','box','team','charts'].includes(source.defaultStatsTab))next.defaultStatsTab=source.defaultStatsTab;
      if([1,2,4].includes(Number(source.defaultLayout)))next.defaultLayout=Number(source.defaultLayout);
      if(typeof source.defaultStatsOpen==='boolean')next.defaultStatsOpen=source.defaultStatsOpen;
      if(typeof source.defaultViewerTicker==='boolean')next.defaultViewerTicker=source.defaultViewerTicker;
      if(typeof source.showTicker==='boolean')next.showTicker=source.showTicker;
      if(typeof source.autoScroll==='boolean')next.autoScroll=source.autoScroll;
      if(['slow','normal','fast'].includes(source.tickerSpeed))next.tickerSpeed=source.tickerSpeed;
      if(['scoring','shooting','playmaking','rebounding','defense','general'].includes(source.leadersCategory))next.leadersCategory=source.leadersCategory;
      if([25,50,100].includes(Number(source.leadersRows)))next.leadersRows=Number(source.leadersRows);
      for(const key of ['alertsEnabled','alertsStart','alertsHalftime','alertsFinal','alertsLead','alertsClose','alertsSound','alertsOverlay']){
        if(typeof source[key]==='boolean')next[key]=source[key];
      }
      if(['all','selected'].includes(source.alertsScope))next.alertsScope=source.alertsScope;
      if(['low','medium','high'].includes(source.alertsVolume))next.alertsVolume=source.alertsVolume;
      if(Array.isArray(source.alertsTeams))next.alertsTeams=[...new Set(source.alertsTeams.map(String).filter(x=>/^[0-9]{1,3}$/.test(x)))].slice(0,30);
      return next;
    }catch{settingsStorageAvailable=false;return {...SETTINGS_DEFAULTS};}
  }
  let settingsPrefs=loadSettingsPrefs();
  function saveSettingsPrefs(){
    try{localStorage.setItem(SETTINGS_STORAGE_KEY,JSON.stringify(settingsPrefs));settingsStorageAvailable=true;}
    catch{settingsStorageAvailable=false;}
    const label=$('settingsStorageStatus');
    if(label)label.textContent=settingsStorageAvailable?'Saved in this browser':'Browser storage unavailable · changes last for this session only';
  }
  function applySettingsPrefs(){
    $('scoreTicker').hidden=!settingsPrefs.showTicker;
    // Keep the viewer's explicit Show ticker / Hide ticker button independent.
  }

