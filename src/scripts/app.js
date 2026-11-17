
  'use strict';
/*__COURTSIDE_ESPN_SCOREBOARD_ENDPOINT__*//*__COURTSIDE_STREAM_PROVIDERS_CONFIG__*/  const $ = id => document.getElementById(id);

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

  const fmtDate = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const dateFromString = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d,12); };
  const today = () => fmtDate(new Date());
  const safe = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const safeLogo = url => { try { const u = new URL(url); return u.protocol==='https:' && (u.hostname.endsWith('.espncdn.com')||u.hostname==='espncdn.com') ? u.href : ''; } catch { return ''; } };

/*__COURTSIDE_DATA_LOG_CORE__*//*__COURTSIDE_LIVE_ALERTS__*/  const state = {
    date:today(), games:[], lastUpdated:null, error:'', loading:false, firstLoaded:false,
    liveOnly:settingsPrefs.defaultLiveOnly, query:'', nextAt:0, expanded:new Set(), requestSeq:0, controller:null, fetchDate:null
  };

  $('datePicker').value = state.date;
  $('liveOnly').checked = state.liveOnly;

  // AuraSports uses ESPN game IDs; PPV.st and Matchora use independent IDs.
  // Cross-provider matches must be verified against BOTH ESPN teams and kickoff.
  let auraGames = new Map(), auraUpdatedAt = 0, auraPending = null;
  let ppvEvents = [], ppvUpdatedAt = 0, ppvPending = null;
  let matchoraEvents = [], matchoraUpdatedAt = 0, matchoraPending = null;
  const viewerState = {
    gameId:null, sourceUrl:null, sources:[], liveGames:[], previousFocus:null,
    layout:1, activeTile:0, tickerOpen:false, slots:Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]})),
    request:0, theater:false, statsOpen:true, statsCache:new Map(), statsPending:new Map(), statsSeq:0,
    statsTab:'box', boxWide:false, boxTeam:null, boxSort:'pts', boxSortDesc:true, statsError:'',
    chartView:'lead',shotTeam:'all',shotPlayer:'all',shotPeriod:'all',chartSelections:{lead:null,prob:null,shots:null},
    statsDisplayKey:null
  };
/*__COURTSIDE_ESPN_CONFIG__*//*__COURTSIDE_ESPN_REQUEST_SCHEDULER__*//*__COURTSIDE_ESPN_REFRESH_POLICY__*//*__COURTSIDE_STREAM_PROVIDERS_REQUESTS__*//*__COURTSIDE_STREAM_PROVIDERS_MATCHING__*//*__COURTSIDE_VIEWER_TITLE__*//*__COURTSIDE_TICKER_CONTROLLER__*//*__COURTSIDE_VIEWER_CONTROLLER__*//*__COURTSIDE_GAME_CENTER_BOX_SCORE__*//*__COURTSIDE_GAME_CENTER_CHARTS__*//*__COURTSIDE_GAME_CENTER_RENDER__*//*__COURTSIDE_ESPN_GAME_SUMMARY__*//*__COURTSIDE_GAME_CENTER_CONTROLLER__*//*__COURTSIDE_SCOREBOARD_DATA__*//*__COURTSIDE_SCOREBOARD_RENDER__*//*__COURTSIDE_STANDINGS__*//*__COURTSIDE_TEAM_PROFILE__*//*__COURTSIDE_TEAM_PROFILE_HANDLERS__*/  $('csTabScores').addEventListener('click',()=>setMainView('scores'));
  $('csTabStandings').addEventListener('click',()=>setMainView('standings'));
  $('csTabLeaders').addEventListener('click',()=>setMainView('leaders'));
  $('csTabLog').addEventListener('click',()=>setMainView('log'));
  $('standingsRefresh').addEventListener('click',()=>fetchStandings(true));
  $('csTabScores').addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();setMainView('standings');$('csTabStandings').focus();}});
  $('csTabStandings').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();setMainView('scores');$('csTabScores').focus();}if(e.key==='ArrowRight'){e.preventDefault();setMainView('leaders');$('csTabLeaders').focus();}});
  $('csTabLeaders').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();setMainView('standings');$('csTabStandings').focus();}if(e.key==='ArrowRight'){e.preventDefault();setMainView('log');$('csTabLog').focus();}});
  $('csTabLog').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();setMainView('leaders');$('csTabLeaders').focus();}});

/*__COURTSIDE_SCOREBOARD_CARD_CONTROLS__*//*__COURTSIDE_VIEWER_CONTROLS__*//*__COURTSIDE_GAME_CENTER_HANDLERS__*//*__COURTSIDE_TICKER_CLICKS__*//*__COURTSIDE_VIEWER_KEYBOARD__*//*__COURTSIDE_SCOREBOARD_NAVIGATION__*/  // Settings events are registered near the end after leaderboard definitions.
  $('refreshSettingsToggle').addEventListener('click',()=>openAppSettings('data'));

/*__COURTSIDE_PLAYER_PROFILE_DATA__*//*__COURTSIDE_PLAYER_PROFILE_DIALOG__*//*__COURTSIDE_PLAYER_PROFILE_HANDLERS__*//*__COURTSIDE_LEAGUE_LEADERS_DATA__*//*__COURTSIDE_LEAGUE_LEADERS_RENDER__*//*__COURTSIDE_LEAGUE_LEADERS_HANDLERS__*/  // Courtside 1.6.1: embedded, version-selectable release history. No network activity.
  const COURTSIDE_RELEASE='1.6.1';
  const WHATS_NEW_RELEASES=[{"version":"1.6","title":"Live Game Alerts","type":"Feature release","reconstructed":false,"changes":[["Added","Five configurable alerts: Game Started, Halftime, Final Score, Lead Change, and Close Game."],["Added","Team-specific monitoring, a notification bell, and a 50-entry session history."],["Added","Optional original notification tones, volume controls, and video spoiler protection."],["Technical","Alerts reuse existing ESPN scoreboard responses without additional polling."]]},{"version":"1.5.6","title":"Performance & Stability","type":"Maintenance release","reconstructed":false,"changes":[["Improved","Capped Data Log comparison snapshots and added least-recently-used eviction."],["Improved","Reduced redundant Data Log DOM updates and batched visual refreshes."],["Added","Local performance diagnostics for comparison/rendering times and snapshot usage."],["Tested","Long-session simulated refreshes, memory limits, and viewer interactions."]]},{"version":"1.5.5","title":"Data Log","type":"Feature release","reconstructed":false,"changes":[["Added","Dedicated Data Log tab monitoring ESPN request activity throughout the session."],["Added","Field-level change comparisons, response status, request timing, and filters."],["Added","Search, JSON export, pause/resume, and a 2,000-record in-memory history."],["Improved","Error handling that preserves valid comparison baselines."]]},{"version":"1.5.4","title":"Viewer Preferences","type":"Settings update","reconstructed":false,"changes":[["Added","Default Live Only setting for the scoreboard."],["Added","Default Game Center tab and 1-, 2-, or 4-screen layout preferences."],["Added","Default sidebar visibility and viewer-ticker visibility options."],["Improved","Applying saved defaults only when a new viewer opens; active streams stay untouched."]]},{"version":"1.5.3","title":"Settings Menu","type":"Feature release","reconstructed":false,"changes":[["Added","App-wide Settings dialog with organized preference sections."],["Added","Startup page, ticker visibility, auto-scroll, and speed preferences."],["Added","Default leaderboard category and page-size settings."],["Added","Browser storage, Restore Defaults, and refresh diagnostics."]]},{"version":"1.5.2","title":"Usability Improvements","type":"Quality-of-life release","reconstructed":false,"changes":[["Added","Drag and touch-swipe horizontal scrolling on both score tickers."],["Added","Hover, keyboard-focus, and touch explanations of statistical abbreviations."],["Improved","Ticker pause/resume and click-versus-drag behavior."]]},{"version":"1.5.1","title":"Performance & Polish","type":"Maintenance release","reconstructed":false,"changes":[["Improved","Priority-aware ESPN scheduling and accounting through response processing."],["Improved","Incremental scorecard updates instead of rebuilding every card."],["Improved","Ticker continuity and leaderboard controls/focus preservation."]]},{"version":"1.5","title":"League Leaders","type":"Major feature","reconstructed":false,"changes":[["Added","League-wide rankings organized into six statistical categories."],["Added","Team/position filters, qualification rules, sortable columns, and player search."],["Added","Pagination, player portraits, and links to existing profiles."],["Technical","On-demand ESPN pagination, caching, and incomplete-dataset safeguards."]]},{"version":"1.4","title":"Player Profiles","type":"Major feature","reconstructed":false,"changes":[["Added","Clickable player names that open dedicated profile dialogs."],["Added","Current-season player overview, statistics, and game logs."],["Added","Game-log links into the associated Courtside Game Center."],["Improved","Profile overlays that leave video players undisturbed."]]},{"version":"1.3.2","title":"Stream Provider Improvements","type":"Reconstructed maintenance entry","reconstructed":true,"changes":[["Added","Matchora as an additional source option in the viewing interface."],["Improved","PPV.st source preference, provider fallback, and stream-index caching."],["Fixed","Visible version numbering was updated as the project evolved."]]},{"version":"1.3.1","title":"Standings Corrections","type":"Reconstructed bugfix entry","reconstructed":true,"changes":[["Fixed","Score-object formatting issues discussed during development."],["Fixed","Win/loss calculation and standings display issues discussed during development."]]},{"version":"1.3","title":"Standings & Team Profiles","type":"Major feature","reconstructed":false,"changes":[["Added","Eastern and Western Conference standings with team records and rankings."],["Added","Interactive Team Profiles with overview, roster, and schedule."],["Improved","Navigation between team details without disrupting active video streams."]]},{"version":"1.2","title":"Adaptive ESPN Refresh","type":"Reconstructed infrastructure entry","reconstructed":true,"changes":[["Added","Adaptive polling: 10-second live scores, 15-second live-game stats, and 60-second idle updates."],["Improved","Exponential backoff, retry handling, and cached-data fallbacks."],["Improved","Reduced polling in background tabs and on completed historical dates."]]},{"version":"1.1.1","title":"Interface Cleanup","type":"Reconstructed quality-of-life entry","reconstructed":true,"changes":[["Improved","More compact scoreboard layout and consolidated viewer controls."],["Improved","Cleaner multiview and header presentation."],["Added","Refresh-information and ticker-related controls."]]},{"version":"1.1","title":"Multiview","type":"Reconstructed feature entry","reconstructed":true,"changes":[["Added","Multiple independent video panels and selectable multiview layouts."],["Added","Per-panel game and stream-source selection."],["Technical","Preserved embedded players’ native audio behavior because cross-origin audio cannot be reliably controlled."]]},{"version":"1.0","title":"The Beginning","type":"Reconstructed initial release","reconstructed":true,"changes":[["Added","Standalone HTML NBA scoreboard with game information and viewing functionality."],["Added","Foundational game selection and ESPN score integration."],["Historical note","Detailed original v1.0 release notes were not preserved; this is a broad reconstruction."]]}];
  const WHATS_NEW_SEEN_KEY='courtside.whatsnew.seen.v1';
  const WHATS_NEW_SELECTED_KEY='courtside.whatsnew.selected.v1';
  let whatsNewSeenThisSession=false;
  let whatsNewSelected=WHATS_NEW_RELEASES[0].version;
  function whatsNewReadStored(key){
    try{return localStorage.getItem(key)||'';}catch{return '';}
  }
  function whatsNewWriteStored(key,value){
    try{localStorage.setItem(key,value);}catch{/* Local-file privacy settings can disable storage. */}
  }
  function updateWhatsNewIndicators(){
    const unread=!whatsNewSeenThisSession&&whatsNewReadStored(WHATS_NEW_SEEN_KEY)!==COURTSIDE_RELEASE;
    for(const id of ['whatsNewNavBadge','whatsNewMainDot','whatsNewViewerDot'])$(id).hidden=!unread;
    $('appSettingsOpen').setAttribute('aria-label',unread?'Open Courtside settings; new release notes available':'Open Courtside settings');
    $('viewerSettingsOpen').setAttribute('aria-label',unread?'Courtside settings; new release notes available':'Courtside settings');
  }
  function markWhatsNewRead(){
    whatsNewSeenThisSession=true;
    whatsNewWriteStored(WHATS_NEW_SEEN_KEY,COURTSIDE_RELEASE);
    updateWhatsNewIndicators();
  }
  function renderWhatsNew(){
    const index=WHATS_NEW_RELEASES.findIndex(r=>r.version===whatsNewSelected);
    const i=index>=0?index:0,release=WHATS_NEW_RELEASES[i];
    whatsNewSelected=release.version;
    $('whatsNewVersion').value=release.version;
    $('whatsNewOlder').disabled=i===WHATS_NEW_RELEASES.length-1;
    $('whatsNewNewer').disabled=i===0;
    $('whatsNewCount').textContent=`${i+1} of ${WHATS_NEW_RELEASES.length}`;
    const note=release.reconstructed?'<p class="cs-wn-historical">This older release summary was reconstructed from development discussions; the exact original version attribution has not been independently verified.</p>':'';
    $('whatsNewDetails').innerHTML=`<div class="cs-wn-release-head"><span class="cs-wn-version">VERSION ${safe(release.version)}</span><h4 id="whatsNewReleaseTitle">${safe(release.title)}</h4><span class="cs-wn-type">${safe(release.type)}</span></div><div class="cs-wn-changes">${release.changes.map(([kind,description])=>`<div class="cs-wn-change"><span class="cs-wn-kind ${['Added','Improved','Fixed'].includes(kind)?kind.toLowerCase():''}">${safe(kind)}</span><p>${safe(description)}</p></div>`).join('')}</div>${note}`;
    $('whatsNewAnnounce').textContent=`Showing version ${release.version}: ${release.title}`;
    whatsNewWriteStored(WHATS_NEW_SELECTED_KEY,release.version);
  }
  function initWhatsNew(){
    const select=$('whatsNewVersion');
    select.innerHTML=WHATS_NEW_RELEASES.map(r=>`<option value="${safe(r.version)}">v${safe(r.version)} — ${safe(r.title)}</option>`).join('');
    const saved=whatsNewReadStored(WHATS_NEW_SELECTED_KEY);
    if(WHATS_NEW_RELEASES.some(r=>r.version===saved))whatsNewSelected=saved;
    select.addEventListener('change',event=>{whatsNewSelected=event.target.value;renderWhatsNew();});
    $('whatsNewOlder').addEventListener('click',()=>{
      const index=WHATS_NEW_RELEASES.findIndex(r=>r.version===whatsNewSelected);
      if(index<0||index===WHATS_NEW_RELEASES.length-1)return;
      whatsNewSelected=WHATS_NEW_RELEASES[index+1].version;renderWhatsNew();
    });
    $('whatsNewNewer').addEventListener('click',()=>{
      const index=WHATS_NEW_RELEASES.findIndex(r=>r.version===whatsNewSelected);
      if(index<=0)return;
      whatsNewSelected=WHATS_NEW_RELEASES[index-1].version;renderWhatsNew();
    });
    renderWhatsNew();updateWhatsNewIndicators();
  }

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
  initWhatsNew();alertsInit();syncSettingsControls();applySettingsPrefs();
  // The chosen launch page is used only at startup; switching tabs never saves a new default.
  if(settingsPrefs.landing!=='scores')setMainView(settingsPrefs.landing);

/*__COURTSIDE_DATA_LOG_CONTROLS__*/  // One lightweight scheduler checks independent due times. No extra fetches on paintViewer().
  function runAdaptivePolls(){
    if(!document.hidden){
      const now=Date.now();
      if(!state.loading&&now>=state.nextAt&&now>=espnPoll.sharedUntil)fetchScores();
      refreshSelectedStatsIfDue();
      if(mainView==='standings'&&$('viewer').hidden&&!standingsState.pending&&(!standingsState.at||now-standingsState.at>=STANDINGS_TTL_MS))fetchStandings();
    }
    updateStatus();
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)runAdaptivePolls();});
  setInterval(runAdaptivePolls,1000);
  setInterval(refreshViewerGameList,AURA_TTL_MS);
  renderLeaders();render();renderTickers();fetchScores(true);

  // ========================================================================
  // Courtside 1.5.2: statistical abbreviation glossary, across dynamic tables.
  // One overlay lives outside scroll containers to avoid clipping or sort bugs.
  // ========================================================================
  const statGlossary={
    'GP':['Games Played','Total number of games the player appeared in this season.'],
    'GS':['Games Started','Games in which the player was in the starting lineup.'],
    'MPG':['Minutes Per Game','Average playing time per game.'],
    'MIN':['Minutes Played','Playing time. Leaderboard General shows season totals; individual game tables show time in that game.'],
    'PPG':['Points Per Game','Average points scored per game played.'],
    'PTS':['Points','Total points scored in the relevant season or game.'],
    'FGM/G':['Field Goals Made Per Game','Average successful two- and three-point field goals per game.'],
    'FGA/G':['Field Goal Attempts Per Game','Average two- and three-point shot attempts per game.'],
    'FG%':['Field Goal Percentage','Percentage of all field goal attempts made: field goals made ÷ field goals attempted × 100.'],
    'FG':['Field Goals (Made–Attempted)','Field goals made and attempted, usually displayed as made–attempted.'],
    '3PM/G':['Three-Pointers Made Per Game','Average successful three-point field goals per game.'],
    '3PA/G':['Three-Point Attempts Per Game','Average attempted three-point field goals per game.'],
    '3P%':['Three-Point Percentage','Percentage of three-point attempts made.'],
    '3PT':['Three-Pointers (Made–Attempted)','Three-point field goals made and attempted in the game.'],
    'FTM/G':['Free Throws Made Per Game','Average successful free throws per game.'],
    'FTA/G':['Free Throw Attempts Per Game','Average free throw attempts per game.'],
    'FT%':['Free Throw Percentage','Percentage of free throw attempts made.'],
    'FT':['Free Throws (Made–Attempted)','Free throws made and attempted in the game.'],
    'APG':['Assists Per Game','Average assists per game played.'],
    'AST':['Assists','Passes directly leading to a made basket. Season or single-game total depending on table.'],
    'TOPG':['Turnovers Per Game','Average turnovers committed per game.'],
    'TO':['Turnovers','Times possession was lost to the opposing team.'],
    'AST/TO':['Assist-to-Turnover Ratio','Total assists divided by total turnovers; undefined when turnovers are zero.'],
    'RPG':['Rebounds Per Game','Average offensive and defensive rebounds collected per game.'],
    'REB':['Rebounds','Total rebounds collected from missed shots.'],
    'DD':['Double-Doubles','Games reaching at least 10 in two of points, rebounds, assists, steals or blocks.'],
    'TD':['Triple-Doubles','Games reaching at least 10 in three of points, rebounds, assists, steals or blocks.'],
    'SPG':['Steals Per Game','Average steals recorded per game.'],
    'BPG':['Blocks Per Game','Average blocked shots per game.'],
    'STL':['Steals','Possessions gained by taking the ball away from the opposing team.'],
    'BLK':['Blocks','Opponent field-goal attempts legally deflected to prevent a made shot.'],
    'PF/G':['Personal Fouls Per Game','Average personal fouls committed per game.'],
    'PF':['Personal Fouls','Number of personal fouls committed.'],
    '+/-':['Plus/Minus','Team point differential while this player is on the court.'],
    'OPP':['Opponent','The opposing team in that game.'],
    'W/L':['Win/Loss','Whether the team won or lost the game.'],
    'W–L':['Wins–Losses','Number of wins and losses in the current standings record.'],
    'PCT':['Winning Percentage','Wins divided by games played; the share of games won.'],
    'GB':['Games Behind','Number of games a team trails its conference leader in the standings.'],
    'HOME':['Home Record','Wins and losses in games played at home.'],
    'AWAY':['Away Record','Wins and losses in road games.'],
    'L10':['Last Ten Games','Record over a team’s most recent 10 games.'],
    'STRK':['Current Streak','Consecutive wins or losses entering the next game.']
  };
  const statTip=document.createElement('div');
  statTip.id='csStatTooltip';statTip.className='cs-stat-tooltip';statTip.hidden=true;
  statTip.setAttribute('role','tooltip');document.body.appendChild(statTip);
  let statTipAnchor=null,statTipPinned=false,statDecorateFrame=0;
  function statLabel(th){
    const sort=th.querySelector('button[data-leader-sort],button[data-bs-sort],button[data-player-sort]');
    const label=sort?sort.textContent:[...th.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('');
    return label.replace(/\s*[↓↑▼▲]\s*$/,'').trim().toUpperCase().replace(/\s+%/g,'%');
  }
  function statDetail(th){
    const key=statLabel(th);
    if(statGlossary[key])return {key,...{title:statGlossary[key][0],detail:statGlossary[key][1]}};
    if(/^Q[1-4]$/.test(key))return {key,title:`Quarter ${key.slice(1)}`,detail:`Points scored during the ${['first','second','third','fourth'][Number(key.slice(1))-1]} quarter.`};
    if(/^OT\d+$/.test(key))return {key,title:`Overtime ${key.slice(2)}`,detail:`Points scored during overtime period ${key.slice(2)}.`};
    return null;
  }
  function decorateStatHeaders(){
    // Covers box scores, leaders, standings, player game logs and quarter scores.
    document.querySelectorAll('.bs-table th,.cs-leaders-table th,.cs-player-stats-table th,.cs-standings-table th,.quarters th').forEach(th=>{
      const info=statDetail(th);if(!info||th.dataset.statGlossary===info.key&&th.querySelector('.stat-info'))return;
      th.dataset.statGlossary=info.key;
      let button=th.querySelector('.stat-info');
      if(!button){
        button=document.createElement('button');button.type='button';button.className='stat-info';
        button.textContent='i';button.setAttribute('aria-describedby','csStatTooltip');
        th.appendChild(button);
      }
      button.setAttribute('aria-label',`Explain ${info.key}: ${info.title}`);
    });
    if(statTipAnchor&&!statTipAnchor.isConnected)hideStatTip();
  }
  function scheduleStatHeaders(){
    if(statDecorateFrame)return;
    statDecorateFrame=requestAnimationFrame(()=>{statDecorateFrame=0;decorateStatHeaders();});
  }
  const statObserver=new MutationObserver(scheduleStatHeaders);
  statObserver.observe(document.body,{childList:true,subtree:true});
  function statTipPosition(th){
    const rect=th.getBoundingClientRect(),width=statTip.offsetWidth,height=statTip.offsetHeight;
    const left=Math.min(window.innerWidth-width-12,Math.max(12,rect.left+(rect.width-width)/2));
    const below=rect.bottom+9,top=below+height<window.innerHeight-10?below:Math.max(10,rect.top-height-9);
    statTip.style.left=`${left}px`;statTip.style.top=`${top}px`;
  }
  function showStatTip(th,pin=false){
    const info=statDetail(th);if(!info)return;
    statTipAnchor=th;statTipPinned=pin;
    statTip.innerHTML=`<strong>${safe(info.key)} — ${safe(info.title)}</strong><span>${safe(info.detail)}</span>`;
    statTip.hidden=false;statTipPosition(th);
  }
  function hideStatTip(){statTip.hidden=true;statTipAnchor=null;statTipPinned=false;}
  document.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch'||statTipPinned)return;
    const th=event.target.closest?.('th[data-stat-glossary]');
    if(th&&th!==statTipAnchor)showStatTip(th);
  });
  document.addEventListener('pointerout',event=>{
    if(statTipPinned||!statTipAnchor)return;
    if(statTipAnchor.contains(event.relatedTarget))return;
    if(statTipAnchor.contains(event.target))hideStatTip();
  });
  document.addEventListener('focusin',event=>{
    if(statTipPinned)return;
    const th=event.target.closest?.('th[data-stat-glossary]');
    if(th)showStatTip(th);
  });
  document.addEventListener('focusout',event=>{
    if(!statTipPinned&&statTipAnchor?.contains(event.target)&&!statTipAnchor.contains(event.relatedTarget))hideStatTip();
  });
  // Capturing ensures a touch on the info button never activates sort handlers.
  document.addEventListener('click',event=>{
    const info=event.target.closest?.('button.stat-info');
    if(info){event.preventDefault();event.stopPropagation();showStatTip(info.closest('th'),true);return;}
    if(statTipPinned)hideStatTip();
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!statTip.hidden)hideStatTip();},true);
  window.addEventListener('resize',()=>{if(statTipAnchor)statTipPosition(statTipAnchor);});
  document.addEventListener('scroll',event=>{
    if(event.target?.closest?.('.ticker-window'))return;
    // Tapping an info button may itself scroll a narrow table into view.
    // Keep an explicitly opened explanation visible through that scroll.
    if(statTipPinned&&statTipAnchor?.isConnected){statTipPosition(statTipAnchor);return;}
    if(!statTip.hidden)hideStatTip();
  },true);
  scheduleStatHeaders();

