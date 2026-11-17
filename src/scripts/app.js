
  'use strict';
  // ESPN's unofficial public scoreboard endpoint (no API key). May change without notice.
  const API = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
  const AURA_API = 'https://aurasports.xyz/api/schedule';
  const AURA_TTL_MS = 2 * 60 * 1000;
  // PPV.st's public event index: return the iframe provided by the API, never synthesize one.
  const PPV_APIS = ['https://api.ppv.st/api/streams', 'https://api.ppv.to/api/streams'];
  const PPV_TTL_MS = 2 * 60 * 1000;
  // Matchora publishes NBA events and match/channel embed URLs in one schedule response.
  // Keep these requests independent of ESPN and the two existing stream indexes.
  const MATCHORA_APIS = [
    'https://matchora.to/api/v1/schedule?watchable=1',
    'https://matchora.pro/api/v1/schedule?watchable=1'
  ];
  const MATCHORA_TTL_MS = 2 * 60 * 1000;
  const $ = id => document.getElementById(id);

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
  const SUMMARY_API='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';
  const ESPN_LIVE_SCORES_MS=10*1000;
  const ESPN_LIVE_STATS_MS=15*1000;
  const ESPN_IDLE_MS=60*1000;
  const ESPN_MAX_BACKOFF_MS=5*60*1000;
  const espnPoll={sharedUntil:0,scoreFailures:0};
  const statsPoll={gameId:null,nextAt:0,failures:0};


  // Courtside 1.5.1 — priority-aware dispatch with full-response accounting.
  // 0: scores, 1: active game, 2: profiles/standings, 3: bulk leaderboards.
  // High-priority requests are serialized. One paced background request may
  // overlap a NEW high-priority request, so a slow leaderboard response never
  // prevents a live score from starting on time. At most two ESPN requests
  // are active, and background pages never start while a high job is active.
  // Callers resolve only after JSON parsing finishes, keeping slots honest.
  const espnJobs=[];
  let espnHighBusy=false,espnLeaderBusy=false,espnJobTimer=null;
  let espnLeaderLastStart=0,espnJobOrdinal=0;
  function requestESPN(work,priority=2){
    return new Promise((resolve,reject)=>{
      espnJobs.push({work,priority,resolve,reject,order:++espnJobOrdinal});
      pumpESPN();
    });
  }
  function startESPNJob(job){
    const leader=job.priority===3;
    if(leader){espnLeaderBusy=true;espnLeaderLastStart=Date.now();}
    else espnHighBusy=true;
    Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(()=>{
      if(leader)espnLeaderBusy=false;
      else espnHighBusy=false;
      pumpESPN();
    });
  }
  function pumpESPN(){
    if(espnJobTimer){clearTimeout(espnJobTimer);espnJobTimer=null;}
    if(!espnJobs.length)return;
    espnJobs.sort((a,b)=>a.priority-b.priority||a.order-b.order);
    if(Date.now()<espnPoll.sharedUntil){
      const until=new Date(espnPoll.sharedUntil).toLocaleTimeString();
      while(espnJobs.length)espnJobs.shift().reject(new Error(`ESPN rate limited until ${until}`));
      return;
    }
    if(!espnHighBusy && espnJobs[0].priority<3){
      startESPNJob(espnJobs.shift());
    }
    // Defer background work until the high-priority lane has drained. A later
    // high-priority arrival can bypass a slow in-flight background fetch.
    if(espnHighBusy||espnLeaderBusy||!espnJobs.length||espnJobs[0].priority<3)return;
    const wait=2600-(Date.now()-espnLeaderLastStart);
    if(wait>0){espnJobTimer=setTimeout(pumpESPN,wait);return;}
    startESPNJob(espnJobs.shift());
  }

  function exponentialBackoff(failures){
    return Math.min(ESPN_MAX_BACKOFF_MS, 30000*Math.pow(2,Math.min(4,Math.max(0,failures-1))));
  }
  function retryAfterMs(value){
    if(!value)return 0;
    const numeric=Number(value.trim());
    if(Number.isFinite(numeric)&&numeric>=0)return numeric*1000;
    const parsed=Date.parse(value);
    return Number.isFinite(parsed)?Math.max(0,parsed-Date.now()):0;
  }
  function noteEspnResponseError(response,channel){
    if(response.status!==429 && !(response.status===503 && response.headers.get('Retry-After')))return;
    const failures=channel==='scores'?espnPoll.scoreFailures+1:statsPoll.failures+1;
    const retry=Math.max(retryAfterMs(response.headers.get('Retry-After')),exponentialBackoff(failures));
    espnPoll.sharedUntil=Math.max(espnPoll.sharedUntil,Date.now()+retry);
  }
  function phaseForGameId(id){
    const game=state.games.find(g=>String(g.id)===String(id));
    if(game)return game._phase;
    return viewerState.liveGames.some(g=>g.id===String(id))?'live':'upcoming';
  }
  function scoresRefreshMs(){
    // A historical date with no games still doesn't require polling.
    if(state.lastUpdated&&state.date<today()&&state.games.every(g=>g._phase==='final'))return Infinity;
    return state.games.some(g=>g._phase==='live')?ESPN_LIVE_SCORES_MS:ESPN_IDLE_MS;
  }
  function statsRefreshMs(id){
    const phase=phaseForGameId(id);
    return phase==='final'?Infinity:phase==='live'?ESPN_LIVE_STATS_MS:ESPN_IDLE_MS;
  }
  function resetStatsPollFor(id){
    if(statsPoll.gameId===id)return;
    statsPoll.gameId=id;
    statsPoll.nextAt=0;
    statsPoll.failures=0;
  }
  function statsNeedsRequest(id,force=false){
    if(force)return true;
    const cache=viewerState.statsCache.get(id);
    if(!cache)return true;
    if(phaseForGameId(id)==='final')return cache.phase!=='final'; // One final snapshot, then stop.
    return Date.now()-cache.at>=statsRefreshMs(id);
  }
  function selectedStatsDueAt(){
    if(document.hidden||$('viewer').hidden||!viewerState.statsOpen||!viewerState.gameId)return Infinity;
    const id=viewerState.gameId,cache=viewerState.statsCache.get(id);
    if(!statsNeedsRequest(id))return cache?cache.at+statsRefreshMs(id):Infinity;
    return Math.max(statsPoll.nextAt,espnPoll.sharedUntil);
  }
  function refreshSelectedStatsIfDue(){
    if(!viewerState.gameId||viewerState.statsPending.has(viewerState.gameId))return;
    if(Date.now()>=selectedStatsDueAt())updateStatsSidebar(false,{showCache:false});
  }

  function validAuraUrl(value){
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      const trusted = host === 'aurasports.xyz' || host.endsWith('.aurasports.xyz') ||
        host === 'aurasportsplayer.cfd' || host.endsWith('.aurasportsplayer.cfd');
      return url.protocol === 'https:' && trusted ? url.href : '';
    } catch { return ''; }
  }

  function validPpvUrl(value){
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      // PPV embeds use third-party hosts which can change. Require public HTTPS URLs.
      if(url.protocol !== 'https:' || url.username || url.password ||
        host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') ||
        /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) return '';
      return url.href;
    } catch { return ''; }
  }

  // Only allow the provider's documented embed endpoints, not arbitrary URLs
  // supplied by its API (or unrelated domains).
  function validMatchoraUrl(value){
    try {
      const url=new URL(value);
      if(url.protocol!=='https:' || url.username || url.password) return '';
      if(!['matchora.to','matchora.pro','es.matchora.pro'].includes(url.hostname.toLowerCase()))return '';
      if(!/^\/embed\/(?:match|channel)\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname))return '';
      return url.href;
    } catch {return '';}
  }

  function matchSources(match){
    const sources = (Array.isArray(match?.sources) ? match.sources : [])
      .map((s,i)=>({provider:'AuraSports',name:`AuraSports · ${String(s.name||`Source ${i+1}`)}`,url:validAuraUrl(s.url)}))
      .filter(s=>s.url);
    const defaultUrl = validAuraUrl(match?.iframeUrl) || validAuraUrl(match?.watchUrl);
    if(!sources.length && defaultUrl) sources.push({provider:'AuraSports',name:'AuraSports · Default stream',url:defaultUrl});
    return [...new Map(sources.map(s=>[s.url,s])).values()];
  }

  function matchLabel(match){
    const away=match?.teams?.away?.name, home=match?.teams?.home?.name;
    return String(match?.title || (away&&home?`${away} at ${home}`:'NBA matchup'));
  }

  async function fetchAuraSchedule(force=false){
    if(!force && auraUpdatedAt && Date.now()-auraUpdatedAt < AURA_TTL_MS) return auraGames;
    if(auraPending) return auraPending;
    auraPending = (async()=>{
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),12000);
      try {
        const response = await fetch(AURA_API,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const categories = await response.json();
        if(!Array.isArray(categories)) throw new Error('Unexpected AuraSports schedule format');
        const nba = categories.filter(c=>String(c.category_name||'').toLowerCase()==='nba')
          .flatMap(c=>Array.isArray(c.schedule)?c.schedule:[]);
        const byId = new Map();
        for(const match of nba){
          if(match.category && String(match.category).toLowerCase()!=='nba') continue;
          const id = /^espn-(\d+)$/.exec(String(match.match_id||''))?.[1];
          if(id) byId.set(id,match);
        }
        auraGames=byId;
        auraUpdatedAt=Date.now();
        return auraGames;
      } finally { clearTimeout(timeout); }
    })().finally(()=>{auraPending=null;});
    return auraPending;
  }

  // PPV.st categorizes all basketball together, including NCAA. Treat ESPN's NBA
  // schedule as the authoritative list and only accept events matching BOTH teams.
  function flattenPpvEvents(json){
    const groups=Array.isArray(json) ? json : json?.streams;
    if(!Array.isArray(groups)) throw new Error('Unexpected PPV.st stream index format');
    const output=[];
    for(const group of groups){
      if(!group || typeof group!=='object') continue;
      const category=String(group.category||group.category_name||'').toLowerCase();
      if(category!=='basketball' && category!=='nba') continue;
      if(!Array.isArray(group.streams)) continue;
      for(const event of group.streams){
        if(!event || typeof event!=='object') continue;
        output.push(event);
      }
    }
    return output;
  }

  async function fetchPpvStreams(force=false){
    if(!force && ppvUpdatedAt && Date.now()-ppvUpdatedAt < PPV_TTL_MS) return ppvEvents;
    if(ppvPending) return ppvPending;
    ppvPending = (async()=>{
      let lastError;
      for(const endpoint of PPV_APIS){
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),8500);
        try {
          const response=await fetch(endpoint,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
          if(!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload=await response.json();
          if(payload?.success===false) throw new Error('Provider reported failure');
          const found=flattenPpvEvents(payload);
          ppvEvents=found;
          ppvUpdatedAt=Date.now();
          return ppvEvents;
        }catch(err){lastError=err;
        }finally{clearTimeout(timeout);}
      }
      throw lastError || new Error('Both PPV.st API hosts failed');
    })().finally(()=>{ppvPending=null;});
    return ppvPending;
  }

  async function fetchMatchoraSchedule(force=false){
    if(!force && matchoraUpdatedAt && Date.now()-matchoraUpdatedAt<MATCHORA_TTL_MS)return matchoraEvents;
    if(matchoraPending)return matchoraPending;
    matchoraPending=(async()=>{
      let lastError;
      for(const endpoint of MATCHORA_APIS){
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),10000);
        try {
          const response=await fetch(endpoint,{signal:controller.signal,cache:'no-store',mode:'cors',headers:{Accept:'application/json'}});
          if(!response.ok)throw new Error(`HTTP ${response.status}`);
          const payload=await response.json();
          if(!Array.isArray(payload?.events))throw new Error('Unexpected Matchora schedule format');
          // Accept the current published shape, and ignore all non-NBA games.
          matchoraEvents=payload.events.filter(event=>event && typeof event==='object' &&
            ['nba','national basketball association'].includes(String(event.league||'').trim().toLowerCase()));
          matchoraUpdatedAt=Date.now();
          return matchoraEvents;
        } catch(error){lastError=error;
        } finally {clearTimeout(timeout);}
      }
      throw lastError||new Error('Both Matchora API hosts failed');
    })().finally(()=>{matchoraPending=null;});
    return matchoraPending;
  }

  const normalized = text => String(text||'').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const nicknames = {
    ATL:['hawks'],BOS:['celtics'],BKN:['nets','brooklyn nets'],CHA:['hornets'],CHI:['bulls'],CLE:['cavaliers','cavs'],
    DAL:['mavericks','mavs'],DEN:['nuggets'],DET:['pistons'],GS:['warriors'],GSW:['warriors'],HOU:['rockets'],
    IND:['pacers'],LAC:['clippers'],LAL:['lakers'],MEM:['grizzlies'],MIA:['heat'],MIL:['bucks'],MIN:['timberwolves','wolves'],
    NOP:['pelicans','pels'],NY:['knicks'],NYK:['knicks'],OKC:['thunder'],ORL:['magic'],PHI:['76ers','sixers','seventy sixers'],
    PHX:['suns'],POR:['trail blazers','blazers'],SAC:['kings'],SA:['spurs'],SAS:['spurs'],TOR:['raptors'],UTA:['jazz'],WAS:['wizards']
  };
  function getGameTeams(game){
    const competitors=game?.competitions?.[0]?.competitors||[];
    return [competitors.find(c=>c.homeAway==='away')?.team,competitors.find(c=>c.homeAway==='home')?.team];
  }
  function teamAliases(team){
    if(!team)return [];
    const abbr=String(team.abbreviation||'').toUpperCase();
    const list=[team.displayName,team.shortDisplayName,team.name,...(nicknames[abbr]||[])];
    if(abbr.length===3)list.push(abbr);
    return [...new Set(list.map(normalized).filter(s=>s && s.length>=3))];
  }
  function hasAlias(haystack,aliases){
    const padded=` ${normalized(haystack)} `;
    return aliases.some(token=>padded.includes(` ${token} `));
  }
  function ppvEventMatches(event,game){
    const [away,home]=getGameTeams(game);
    if(!away||!home)return false;
    const name=[event.name,event.title,event.uri_name].filter(Boolean).join(' ');
    if(!hasAlias(name,teamAliases(away)) || !hasAlias(name,teamAliases(home)))return false;
    // Prevent a similarly named game from a previous date being treated as live.
    const scheduled=Date.parse(game.date||'');
    const starts=Number(event.starts_at);
    if(Number.isFinite(scheduled) && starts>0 && Math.abs(scheduled-starts*1000)>9*3600000) return false;
    return true;
  }
  function ppvSourcesForGame(game){
    if(!game)return [];
    const sources=[];
    for(const event of ppvEvents){
      if(!ppvEventMatches(event,game))continue;
      const primary=validPpvUrl(event.iframe || event.embed_url);
      if(primary)sources.push({provider:'PPV.st',name:`PPV.st · ${String(event.tag||'Main broadcast')}`,url:primary});
      if(Array.isArray(event.substreams)){
        for(const [i,sub] of event.substreams.entries()){
          const url=validPpvUrl(sub?.iframe || sub?.embed_url);
          if(!url)continue;
          const name=sub.source_tag||sub.name||sub.label||sub.tag||`Alternative ${i+1}`;
          sources.push({provider:'PPV.st',name:`PPV.st · ${String(name)}`,url});
        }
      }
    }
    return [...new Map(sources.map(s=>[s.url,s])).values()];
  }
  function matchoraEventMatches(event,game){
    const [away,home]=getGameTeams(game);
    if(!away||!home)return false;
    if(!['nba','national basketball association'].includes(String(event.league||'').trim().toLowerCase()))return false;
    // Require the right teams in the right home/away roles. This excludes NBA G League
    // and other basketball fixtures, even if the provider categorizes them together.
    if(!hasAlias(event.away,teamAliases(away))||!hasAlias(event.home,teamAliases(home)))return false;
    const scheduled=Date.parse(game.date||'');
    const kickoff=Number(event.kickoff)*1000;
    // Reject entries that cannot be dated; stale or similarly named listings must
    // never be associated with a different ESPN game.
    if(!Number.isFinite(scheduled)||!Number.isFinite(kickoff)||kickoff<=0)return false;
    return Math.abs(scheduled-kickoff)<=6*3600000;
  }
  function matchoraSourcesForGame(game){
    if(!game)return [];
    const sources=[];
    for(const event of matchoraEvents){
      if(!matchoraEventMatches(event,game))continue;
      const primary=validMatchoraUrl(event.embed_url);
      if(primary)sources.push({provider:'Matchora',name:'Matchora · Match player (choose channel)',url:primary});
      if(Array.isArray(event.channels)){
        for(const [i,ch] of event.channels.slice(0,60).entries()){
          if(!ch||ch.dead===true)continue;
          const url=validMatchoraUrl(ch.embed_url);
          if(!url)continue;
          const channelName=String(ch.name||`Channel ${i+1}`).slice(0,80);
          const quality=String(ch.quality||'').trim().slice(0,12);
          const language=String(ch.lang||'').trim().slice(0,24);
          const extras=[quality,language].filter(Boolean).join(' · ');
          sources.push({provider:'Matchora',name:`Matchora · ${channelName}${extras?' · '+extras:''}`,url});
        }
      }
    }
    return [...new Map(sources.map(source=>[source.url,source])).values()];
  }
  function combinedSourcesForId(id){
    const espn=state.games.find(g=>String(g.id)===String(id));
    const ppv=ppvSourcesForGame(espn);
    const aura=matchSources(auraGames.get(String(id)));
    const matchora=matchoraSourcesForGame(espn);
    // PPV.st is the default when available. Manual source changes are retained
    // because paintPlayer() only replaces a URL that's no longer in the list.
    return [...ppv,...aura,...matchora];
  }


function viewerGameTitle(id){
  const espn=state.games.find(g=>String(g.id)===String(id));
  if(espn){const [away,home]=getGameTeams(espn);return `${away?.displayName||away?.name||'Away'} at ${home?.displayName||home?.name||'Home'}`;}
  const match=auraGames.get(String(id));
  return match?matchLabel(match):'NBA game';
}
function formatTickerGame(game){
  const [away,home]=getGameTeams(game);
  const comp=game.competitions?.[0];
  const a=comp?.competitors?.find(c=>c.homeAway==='away');
  const h=comp?.competitors?.find(c=>c.homeAway==='home');
  const phase=game._phase;
  const status=phase==='live'?getStatus(game):phase==='final'?'FINAL':formatStart(game.date);
  const label=`${away?.abbreviation||'AWY'} at ${home?.abbreviation||'HME'} · ${status}`;
  const html=`<span class="ticker-teams"><span>${safe(away?.abbreviation||'AWY')} @ ${safe(home?.abbreviation||'HME')}</span><span class="ticker-meta">${safe(status)}</span></span><span class="ticker-score">${phase==='upcoming'?'—':`${safe(a?.score??'—')}–${safe(h?.score??'—')}`}</span>`;
  return {id:String(game.id),html,label,live:phase==='live'};
}
// One controller per mounted ticker; both the scoreboard and video overlay use it.
const tickerControllers=new Map();
const tickerReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const tickerDesktopHover=window.matchMedia('(hover: hover) and (pointer: fine)');
function tickerDispose(el){
  const c=tickerControllers.get(el);
  if(!c)return;
  c.abort.abort();c.observer?.disconnect();tickerControllers.delete(el);
}
function tickerNormalize(c){
  if(!c.unit||!c.ready)return;
  const x=c.window.scrollLeft;
  // An extra identical copy on either side makes wrapping visually seamless.
  if(x<c.unit)c.window.scrollLeft=x+c.unit;
  else if(x>=c.unit*2)c.window.scrollLeft=x-c.unit;
}
function tickerEnsureCopies(c){
  if(!c.window.isConnected||!c.window.clientWidth||!c.count)return;
  const buttons=c.track.querySelectorAll(':scope > .ticker-item');
  if(buttons.length<c.count*3)return;
  const unit=buttons[c.count].offsetLeft-buttons[0].offsetLeft;
  if(!(unit>0))return;
  // Three complete cycles plus enough copies to cover a large desktop viewport.
  const required=Math.max(3,Math.ceil(c.window.clientWidth/unit)+3);
  const oldUnit=c.unit,oldScroll=c.window.scrollLeft;
  while(c.track.children.length<c.count*required){
    for(let i=0;i<c.count;i++){
      const copy=c.track.children[i].cloneNode(true);
      copy.setAttribute('aria-hidden','true');copy.tabIndex=-1;
      c.track.appendChild(copy);
    }
  }
  while(c.track.children.length>c.count*required)c.track.lastElementChild.remove();
  c.unit=unit;
  if(!c.ready){c.window.scrollLeft=unit;c.ready=true;}
  else if(Math.abs(oldUnit-unit)>.5)c.window.scrollLeft=unit+((oldScroll-oldUnit)/oldUnit)*unit;
  tickerNormalize(c);
}
function tickerPause(c){c.pauseUntil=performance.now()+6000;}
function tickerInitialize(el,count){
  const win=el.querySelector('.ticker-window');
  const track=el.querySelector('.ticker-track');
  if(!win||!track){tickerDispose(el);return;}
  let c=tickerControllers.get(el);
  if(c?.window===win){c.count=count;tickerEnsureCopies(c);return;}
  tickerDispose(el);
  const abort=new AbortController();
  c={el,window:win,track,count,unit:0,ready:false,dragging:false,candidate:null,
    pauseUntil:0,lastTime:0,abort,observer:null,suppressClick:false};
  tickerControllers.set(el,c);
  const signal=abort.signal;
  win.tabIndex=0;
  win.setAttribute('aria-label','Scores ticker. Drag or swipe horizontally, or use left and right arrow keys. Select a score to open its game.');
  win.addEventListener('scroll',()=>tickerNormalize(c),{signal,passive:true});
  win.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='mouse'||event.button!==0)return;
    c.candidate={pointerId:event.pointerId,startX:event.clientX,lastX:event.clientX};
    c.dragging=false;tickerPause(c);
  },{signal});
  win.addEventListener('pointermove',event=>{
    if(!c.candidate||c.candidate.pointerId!==event.pointerId)return;
    const distance=Math.abs(event.clientX-c.candidate.startX);
    if(!c.dragging&&distance>6){
      c.dragging=true;win.classList.add('is-dragging');
      try{win.setPointerCapture(event.pointerId);}catch{}
    }
    if(c.dragging){
      event.preventDefault();
      win.scrollLeft-=event.clientX-c.candidate.lastX;
      tickerNormalize(c);tickerPause(c);
    }
    c.candidate.lastX=event.clientX;
  },{signal});
  const finish=event=>{
    if(!c.candidate||c.candidate.pointerId!==event.pointerId)return;
    if(c.dragging){
      // A mouse press on a game button gives it focus. Clear focus from a drag
      // (not a click), otherwise :focus-within would pause auto-scroll forever.
      if(win.contains(document.activeElement))document.activeElement.blur();
      c.suppressClick=true;
      // Click is dispatched after pointerup; suppress that one, not future clicks.
      setTimeout(()=>{c.suppressClick=false;},0);
      try{if(win.hasPointerCapture(event.pointerId))win.releasePointerCapture(event.pointerId);}catch{}
    }
    c.dragging=false;c.candidate=null;win.classList.remove('is-dragging');tickerPause(c);
  };
  win.addEventListener('pointerup',finish,{signal});
  win.addEventListener('pointercancel',finish,{signal});
  win.addEventListener('lostpointercapture',event=>{
    if(c.candidate?.pointerId===event.pointerId)finish(event);
  },{signal});
  win.addEventListener('click',event=>{
    if(c.suppressClick){event.preventDefault();event.stopImmediatePropagation();c.suppressClick=false;}
  },{capture:true,signal});
  win.addEventListener('touchstart',()=>tickerPause(c),{passive:true,signal});
  win.addEventListener('touchend',()=>tickerPause(c),{passive:true,signal});
  win.addEventListener('wheel',event=>{
    if(!event.shiftKey)return; // Normal vertical page scrolling stays available.
    event.preventDefault();win.scrollLeft+=event.deltaY||event.deltaX;
    tickerNormalize(c);tickerPause(c);
  },{passive:false,signal});
  win.addEventListener('keydown',event=>{
    if(event.target!==win||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();win.scrollLeft+=event.key==='ArrowRight'?130:-130;
    tickerNormalize(c);tickerPause(c);
  },{signal});
  if(typeof ResizeObserver!=='undefined'){
    c.observer=new ResizeObserver(()=>tickerEnsureCopies(c));c.observer.observe(win);
  }
  tickerEnsureCopies(c);
}
// A single animation loop drives both tickers, avoiding animation resets on score updates.
let tickerFrame=0;
function tickerFrameStep(time){
  for(const c of tickerControllers.values()){
    const delta=c.lastTime?Math.min(80,time-c.lastTime):0;c.lastTime=time;
    if(!settingsPrefs.autoScroll||!c.ready||!c.window.clientWidth||document.hidden||tickerReducedMotion.matches||c.dragging||time<c.pauseUntil||
       (tickerDesktopHover.matches&&c.el.matches(':hover'))||c.el.matches(':focus-within'))continue;
    const duration=Math.max(22,c.count*7)/(settingsPrefs.tickerSpeed==='slow'?.6:settingsPrefs.tickerSpeed==='fast'?1.8:1);
    // Accumulate fractional pixels; scrollLeft rounds subpixel writes in some
    // browsers, otherwise a slow auto-scroll can appear completely frozen.
    c.autoRemainder=(c.autoRemainder||0)+c.unit/duration*(delta/1000);
    if(c.autoRemainder>=1){
      const step=Math.floor(c.autoRemainder);
      c.autoRemainder-=step;c.window.scrollLeft+=step;
      tickerNormalize(c);
    }
  }
  tickerFrame=requestAnimationFrame(tickerFrameStep);
}
tickerFrame=requestAnimationFrame(tickerFrameStep);
function paintTicker(el){
  if(!el)return;
  if(!state.games.length){
    tickerDispose(el);
    const markup='<div class="score-ticker-label">NBA SCORES</div><span class="ticker-empty">No games listed for this date</span>';
    if(el.innerHTML!==markup)el.innerHTML=markup;
    return;
  }
  const games=[...state.games].sort((a,b)=>({live:0,upcoming:1,final:2}[a._phase]-({live:0,upcoming:1,final:2}[b._phase]))||new Date(a.date)-new Date(b.date));
  const entries=games.map(formatTickerGame);
  const existing=[...el.querySelectorAll('.ticker-track > .ticker-item')];
  // Preserve scrollLeft and gesture state when the day's game order is unchanged.
  if(existing.length>=entries.length*3&&existing.length%entries.length===0&&
     existing.every((button,i)=>button.dataset.tickerGame===entries[i%entries.length].id)){
    for(const [i,button] of existing.entries()){
      const item=entries[i%entries.length],nextClass=`ticker-item ${item.live?'is-live':''}`;
      if(button.className!==nextClass)button.className=nextClass;
      if(button.getAttribute('aria-label')!==item.label)button.setAttribute('aria-label',item.label);
      if(button.innerHTML!==item.html)button.innerHTML=item.html;
    }
    tickerInitialize(el,entries.length);
    return;
  }
  const buttons=(copy=false)=>entries.map(item=>`<button type="button" class="ticker-item ${item.live?'is-live':''}" data-ticker-game="${safe(item.id)}" aria-label="${safe(item.label)}" ${copy?'tabindex="-1" aria-hidden="true"':''}>${item.html}</button>`).join('');
  el.innerHTML=`<div class="score-ticker-label"><span class="dot"></span>NBA SCORES</div><div class="ticker-window"><div class="ticker-track">${buttons()}${buttons(true)}${buttons(true)}</div></div>`;
  tickerInitialize(el,entries.length);
}
function renderTickers(){paintTicker($('scoreTicker'));paintTicker($('viewerTicker'));}
// Only actual live NBA games enter the nav list. PPV events must match ESPN teams and date.
function updateLiveGamePicker(){
  const choices=new Map();
  for(const [id,match] of auraGames){
    if(String(match.status||'').toLowerCase()==='live' && matchSources(match).length){
      choices.set(id,{id,title:matchLabel(match),time:Number(match.date||0)});
    }
  }
  for(const game of state.games){
    if(game._phase!=='live')continue;
    const id=String(game.id);
    if(!combinedSourcesForId(id).length)continue;
    choices.set(id,{id,title:viewerGameTitle(id),time:Date.parse(game.date||'')||0});
  }
  viewerState.liveGames=[...choices.values()].sort((a,b)=>a.time-b.time||a.title.localeCompare(b.title));
}
function availableSlotGames(){
  // Show the ESPN day's full schedule, plus live provider-only ESPN IDs.
  const games=new Map();
  for(const game of state.games){
    const id=String(game.id||'');
    if(id)games.set(id,{id,title:`${viewerGameTitle(id)} · ${game._phase==='live'?'LIVE':game._phase==='final'?'FINAL':'UPCOMING'}`});
  }
  for(const game of viewerState.liveGames){
    if(!games.has(game.id))games.set(game.id,{id:game.id,title:`${game.title} · LIVE`});
  }
  return [...games.values()];
}
function paintPlayer(){
  const visible=viewerState.layout;
  const gameChoices=availableSlotGames();
  const grid=$('multiviewGrid');
  grid.className=`multiview-grid layout-${visible}`;
  for(let i=0;i<4;i++){
    const slot=viewerState.slots[i],tile=$(`streamTile${i}`),frame=$(`playerFrame${i}`),message=$(`playerMessage${i}`);
    const isVisible=i<visible,isActive=i===viewerState.activeTile;
    tile.hidden=!isVisible;
    tile.classList.toggle('is-active',isActive);
    const focus=$(`streamFocus${i}`);
    focus.setAttribute('aria-pressed',String(isActive));
    focus.innerHTML=`SCREEN ${i+1}<span class="stream-active-pill" ${isActive?'':'hidden'}>● STATS</span>`;
    const options=gameChoices.slice();
    if(slot.gameId&&!options.some(g=>g.id===slot.gameId))options.unshift({id:slot.gameId,title:viewerGameTitle(slot.gameId)});
    const gamePicker=$(`slotGame${i}`);
    const gameSignature=options.map(g=>`${g.id}:${g.title}`).join('|');
    if(gamePicker.dataset.signature!==gameSignature){
      gamePicker.replaceChildren(new Option('Choose game…',''),...options.map(g=>new Option(g.title,g.id)));
      gamePicker.dataset.signature=gameSignature;
    }
    gamePicker.value=slot.gameId||'';
    const sources=slot.gameId?combinedSourcesForId(slot.gameId):[];
    slot.sources=sources;
    if(!sources.some(s=>s.url===slot.sourceUrl))slot.sourceUrl=sources[0]?.url||null;
    const sourcePicker=$(`slotSource${i}`);
    const sourceSignature=sources.map(s=>`${s.url}:${s.name}`).join('|');
    if(sourcePicker.dataset.signature!==sourceSignature){
      sourcePicker.replaceChildren(...(sources.length?sources.map(s=>new Option(s.name,s.url)):[new Option('No sources','')]));
      sourcePicker.dataset.signature=sourceSignature;
    }
    sourcePicker.disabled=!sources.length;
    sourcePicker.value=slot.sourceUrl||'';
    const selected=sources.find(s=>s.url===slot.sourceUrl);
    const overlay=$(`focusOverlay${i}`);
    overlay.hidden=!isVisible||isActive||!selected;
    // Never leave an off-screen iframe playing audio. Preserve its assigned game
    // and stream URL for when that tile becomes visible again.
    if(!isVisible||!selected){
      if(frame.hasAttribute('src'))frame.removeAttribute('src');
      frame.hidden=true;
      message.hidden=!isVisible;
      message.textContent=!slot.gameId?`Choose a game for screen ${i+1}.`:'No stream listed for this game. Use ↻ Streams to refresh.';
    }else{
      if(frame.getAttribute('src')!==selected.url)frame.src=selected.url;
      frame.title=`Screen ${i+1}: ${viewerGameTitle(slot.gameId)} — ${selected.name}`;
      frame.hidden=false;
      message.hidden=true;
    }
  }
  const active=viewerState.slots[viewerState.activeTile];
  viewerState.gameId=active.gameId;
  viewerState.sourceUrl=active.sourceUrl;
  viewerState.sources=active.sources;
  const sources=active.sources;
  const selected=sources.find(s=>s.url===active.sourceUrl);
  $('viewerExternal').hidden=!selected;
  if(selected)$('viewerExternal').href=selected.url;
  $('selectedScreenLabel').textContent=`SCREEN ${viewerState.activeTile+1}`;
}
function paintViewer(){
  $('theaterToggle').setAttribute('aria-pressed',String(viewerState.theater));
  $('theaterToggle').textContent=viewerState.theater?'⛶ Exit theater':'⛶ Theater';
  $('statsToggle').setAttribute('aria-pressed',String(viewerState.statsOpen));
  $('statsToggle').textContent=viewerState.statsOpen?'▤ Hide stats':'▤ Show stats';
  $('viewer').classList.toggle('theater',viewerState.theater);
  $('viewerWorkspace').classList.toggle('no-sidebar',!viewerState.statsOpen);
  $('viewerTicker').hidden=!viewerState.tickerOpen;
  alertsRenderToasts();
  $('tickerToggle').setAttribute('aria-pressed',String(viewerState.tickerOpen));
  $('tickerToggle').textContent=viewerState.tickerOpen?'▤ Hide ticker':'▤ Show ticker';
  $('viewerWorkspace').classList.toggle('multi-mode',viewerState.layout>1);
  $('viewerWorkspace').classList.toggle('box-wide',viewerState.statsOpen && viewerState.statsTab==='box' && viewerState.boxWide);
  $('statsSidebar').hidden=!viewerState.statsOpen;
  for(const button of document.querySelectorAll('[data-layout]')){
    button.setAttribute('aria-pressed',String(Number(button.dataset.layout)===viewerState.layout));
  }
  paintPlayer();
  updateGameCenterTeamLinks();
  const statsKey=viewerState.statsOpen?`${viewerState.gameId||''}|${viewerState.statsTab}`:null;
  if(viewerState.statsOpen && statsKey!==viewerState.statsDisplayKey){
    viewerState.statsDisplayKey=statsKey;
    resetStatsPollFor(viewerState.gameId);
    updateStatsSidebar(); // Only selection/tab changes, not ordinary score/stream repaints.
  }else if(!viewerState.statsOpen){
    viewerState.statsDisplayKey=null;
  }
}
function setActiveTile(index){
  if(index<0||index>=viewerState.layout)return;
  const id=viewerState.slots[index].gameId;
  if(index===viewerState.activeTile)return;
  const changed=viewerState.gameId!==id;
  viewerState.activeTile=index;
  if(changed){
    viewerState.boxTeam=null;viewerState.statsError='';resetChartGame();
    ++viewerState.statsSeq;
    $('statsContent').scrollTop=0;
  }
  paintViewer();
}
function setViewerLayout(count){
  if(![1,2,4].includes(count)||count===viewerState.layout)return;
  viewerState.layout=count;
  if(viewerState.activeTile>=count){
    viewerState.activeTile=0;
    viewerState.boxTeam=null;viewerState.statsError='';resetChartGame();
    ++viewerState.statsSeq;
    $('statsContent').scrollTop=0;
  }
  paintViewer();
}
function changeViewerGame(id,index=viewerState.activeTile){
  const gameId=String(id||'');
  if(index<0||index>=viewerState.layout)return;
  if(gameId&&!auraGames.has(gameId)&&!state.games.some(g=>String(g.id)===gameId))return;
  const slot=viewerState.slots[index];
  const changed=slot.gameId!==gameId;
  if(changed){slot.gameId=gameId||null;slot.sourceUrl=null;slot.sources=[];}
  if(index!==viewerState.activeTile){
    viewerState.activeTile=index;
  }
  if(viewerState.gameId!==slot.gameId){
    viewerState.gameId=slot.gameId;viewerState.boxTeam=null;viewerState.statsError='';
    resetChartGame();++viewerState.statsSeq;
    $('statsContent').scrollTop=0;
  }
  paintViewer();
}
function changeViewerSource(url,index=viewerState.activeTile){
  const slot=viewerState.slots[index];
  if(!slot||!slot.sources.some(s=>s.url===url))return;
  slot.sourceUrl=url;
  if(index!==viewerState.activeTile){
    const oldId=viewerState.gameId;
    viewerState.activeTile=index;
    if(oldId!==slot.gameId){viewerState.boxTeam=null;viewerState.statsError='';resetChartGame();++viewerState.statsSeq;}
  }
  paintViewer();
}
async function lookupViewerGame(force=false){
  const token=++viewerState.request;
  $('viewerRetry').disabled=true;
  $('viewerRetry').textContent='↻ Checking…';
  const results=await Promise.allSettled([fetchPpvStreams(force),fetchAuraSchedule(force),fetchMatchoraSchedule(force)]);
  if(token!==viewerState.request || $('viewer').hidden)return;
  const providers=['PPV.st','AuraSports','Matchora'];
  const failures=results.flatMap((r,i)=>r.status==='rejected'?[providers[i]]:[]);
  $('viewerNote').hidden=!failures.length;
  $('viewerNote').textContent=failures.length?`${failures.join(' and ')} could not be refreshed. Showing available or cached sources from other providers. Browser CORS restrictions may apply.`:'';
  updateLiveGamePicker();
  paintViewer();
  $('viewerRetry').disabled=false;
  $('viewerRetry').textContent='↻ Streams';
}
function openViewer(gameId){
  const game=state.games.find(g=>String(g.id)===String(gameId));
  if(!game)return;
  viewerState.previousFocus=document.activeElement;
  viewerState.slots=Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]}));
  viewerState.slots[0].gameId=String(gameId);
  // 1.5.4: apply saved VIEWER defaults only at the start of a new viewer session.
  // Do not modify already-open streams when preferences are edited.
  viewerState.layout=settingsPrefs.defaultLayout;
  viewerState.activeTile=0;
  viewerState.tickerOpen=settingsPrefs.defaultViewerTicker;
  viewerState.statsTab=settingsPrefs.defaultStatsTab;
  viewerState.statsOpen=settingsPrefs.defaultStatsOpen;
  viewerState.gameId=String(gameId);
  viewerState.sourceUrl=null;
  viewerState.boxTeam=null;viewerState.statsError='';
  resetChartGame();
  viewerState.liveGames=[];
  viewerState.statsDisplayKey=null;
  resetStatsPollFor(viewerState.gameId);
  $('viewer').hidden=false;
  document.body.classList.add('viewer-open');
  paintViewer();
  renderTickers();
  $('viewerClose').focus();
  lookupViewerGame();
}
function closeViewer(){
  if($('viewer').hidden)return;
  ++viewerState.request;
  ++viewerState.statsSeq;
  viewerState.gameId=null;
  viewerState.statsDisplayKey=null;
  resetStatsPollFor(null);
  viewerState.sourceUrl=null;
  // Discard every iframe URL: hidden streams must never continue playing audio.
  for(let i=0;i<4;i++){
    const frame=$(`playerFrame${i}`);
    frame.removeAttribute('src');frame.hidden=true;
    viewerState.slots[i].sourceUrl=null;
  }
  $('viewer').hidden=true;
  alertsRenderToasts();
  document.body.classList.remove('viewer-open');
  const prev=viewerState.previousFocus;
  if(prev?.isConnected)prev.focus();
}
async function refreshViewerGameList(){
  if($('viewer').hidden || document.hidden || !viewerState.slots.some(slot=>slot.gameId))return;
  await Promise.allSettled([fetchPpvStreams(),fetchAuraSchedule(),fetchMatchoraSchedule()]);
  if(!$('viewer').hidden){updateLiveGamePicker();paintViewer();}
}
function gameStatValues(summary){
  const rows=summary?.boxscore?.teams||[];
  const result={};
  for(const team of rows){
    const key=team.homeAway||((team.team?.homeAway)||'');
    const abbr=team.team?.abbreviation||'';
    const stats={};
    for(const stat of team.statistics||[]){
      const k=String(stat.name||stat.label||'').toLowerCase().replace(/[^a-z0-9]/g,'');
      stats[k]=stat.displayValue??stat.value;
    }
    result[key||abbr]=stats;
  }
  return result;
}
function findSummaryStat(statMap,keys){
  for(const k of keys){const v=statMap?.[k];if(v!==undefined && v!==null && v!=='')return String(v);}
  return '—';
}

// The columns match the approved mockup. The compact table keeps the six
// essential stats; wide mode displays the entire player box score.
const BOX_COLUMNS=[
  ['name','PLAYER'],['min','MIN'],['pts','PTS'],['reb','REB'],['ast','AST'],
  ['fg','FG'],['tp','3PT'],['ft','FT'],['stl','STL'],['blk','BLK'],
  ['to','TO'],['pf','PF'],['pm','+/-']
];
const COMPACT_BOX_KEYS=new Set(['name','min','pts','reb','ast','pm']);
const boxKeyAliases={
  min:['min','minutes'],pts:['pts','points'],reb:['reb','rebounds','totalrebounds'],
  ast:['ast','assists'],fg:['fg','fieldgoalsmadefieldgoalsattempted','fieldgoalsmadeattempted'],
  tp:['3pt','3p','threepointfieldgoalsmadeattempted','threepointfieldgoalsmadethreepointfieldgoalsattempted','threepointfieldgoals','threepointfieldgoalsmadethreepointfieldgoalsattempted'],
  ft:['ft','freethrowsmadefreethrowsattempted','freethrowsmadeattempted'],
  stl:['stl','steals'],blk:['blk','blocks'],to:['to','turnovers','totalturnovers'],
  pf:['pf','fouls','personalfouls'],pm:['+/-','plusminus','plusminusrating']
};
function normalizeBoxKey(value){
  const s=String(value??'').toLowerCase().trim();
  return s==='+/-'||s==='±'?'plusminus':s.replace(/[^a-z0-9]/g,'');
}
function boxStatKey(...candidateNames){
  for(const candidate of candidateNames){
    const key=normalizeBoxKey(candidate);
    if(!key)continue;
    for(const [col,aliases] of Object.entries(boxKeyAliases)){
      if(aliases.some(a=>normalizeBoxKey(a)===key))return col;
    }
  }
  return null;
}
function parsePlayerBoxscore(summary){
  // ESPN's boxscore.players is an array of team groups. Each group contains
  // statistics[].athletes plus parallel keys / labels / names and stats values.
  const groups=Array.isArray(summary?.boxscore?.players)?summary.boxscore.players:[];
  const result=[];
  for(const group of groups){
    const players=[];
    for(const statGroup of (Array.isArray(group.statistics)?group.statistics:[])){
      const keys=Array.isArray(statGroup.keys)?statGroup.keys:[];
      const names=Array.isArray(statGroup.names)?statGroup.names:[];
      const labels=Array.isArray(statGroup.labels)?statGroup.labels:[];
      const athletes=Array.isArray(statGroup.athletes)?statGroup.athletes:[];
      for(const athlete of athletes){
        const raw=athlete?.stats;
        const stats=Array.isArray(raw)?raw:(Array.isArray(athlete?.statistics)?athlete.statistics:[]);
        const row={
          id:simpleId(athlete?.athlete?.id||athlete?.id),
          teamId:simpleId(group.team?.id),
          headshot:safeLogo(athlete?.athlete?.headshot?.href||athlete?.athlete?.headshot||''),
          jersey:String(athlete?.athlete?.jersey||''),
          name:String(athlete?.athlete?.displayName||athlete?.athlete?.fullName||athlete?.displayName||'Player'),
          pos:String(athlete?.athlete?.position?.abbreviation||athlete?.athlete?.position?.name||''),
          starter:athlete?.starter===true,dnp:athlete?.didNotPlay===true,
          reason:String(athlete?.reason||athlete?.didNotPlayReason||''),
          statsAvailable:stats.length>0
        };
        for(let i=0;i<stats.length;i++){
          const col=boxStatKey(labels[i],keys[i],names[i]);
          if(!col)continue;
          const value=stats[i];
          if(value!==null && value!==undefined && String(value).trim()!=='')row[col]=String(value);
        }
        // Some versions return keyed objects instead of parallel arrays.
        if(!Array.isArray(raw)&&raw&&typeof raw==='object'){
          for(const [k,v] of Object.entries(raw)){
            const col=boxStatKey(k);
            if(col && v!==null && v!==undefined && String(v).trim()!=='')row[col]=String(v);
          }
        }
        if(row.dnp || (!row.statsAvailable && row.reason))row.dnp=true;
        players.push(row);
      }
    }
    if(players.length)result.push({teamId:String(group.team?.id||''),abbr:String(group.team?.abbreviation||''),name:String(group.team?.displayName||''),players});
  }
  return result;
}
function getBoxTeams(game,summary){
  const comp=game?.competitions?.[0];
  const competitors=[comp?.competitors?.find(c=>c.homeAway==='away'),comp?.competitors?.find(c=>c.homeAway==='home')];
  const playerGroups=parsePlayerBoxscore(summary);
  return competitors.filter(Boolean).map((c,i)=>{
    const teamId=String(c.team?.id||c.id||'');
    const abbr=String(c.team?.abbreviation||'');
    const group=playerGroups.find(g=>teamId&&g.teamId===teamId)||playerGroups.find(g=>g.abbr.toLowerCase()===abbr.toLowerCase())||null;
    return {side:c.homeAway||(['away','home'][i]),id:teamId,abbr,name:String(c.team?.shortDisplayName||c.team?.name||abbr),score:c.score,lines:c.linescores||[],players:group?.players||[],hasGroup:!!group};
  });
}
function boxSortValue(row,key){
  if(key==='name')return row.name.toLowerCase();
  const value=row[key];
  if(value===undefined||value===null||value===''||value==='—')return null;
  if(['fg','tp','ft'].includes(key))return Number(String(value).split('-')[0]);
  if(key==='min'&&String(value).includes(':')){
    const p=String(value).split(':');return Number(p[0])+Number(p[1]||0)/60;
  }
  const n=Number(String(value).replace(/[^0-9.+-]/g,''));
  return Number.isFinite(n)?n:null;
}
function sortedBoxPlayers(players){
  const key=viewerState.boxSort,desc=viewerState.boxSortDesc;
  return [...players].sort((a,b)=>{
    const av=boxSortValue(a,key),bv=boxSortValue(b,key);
    if(av===null)return bv===null?0:1;
    if(bv===null)return -1;
    const compare=typeof av==='string'?av.localeCompare(bv):av-bv;
    return compare*(desc?-1:1);
  });
}
function boxCell(player,key){
  if(key==='name')return `<td><div class="bs-player">${player.id?`<button type="button" class="cs-player-link" data-player-profile="${safe(player.id)}" data-player-name="${safe(player.name)}" data-player-team="${safe(player.teamId||'')}" data-player-pos="${safe(player.pos)}" title="Open ${safe(player.name)} player profile">${safe(player.name)}</button>`:`<strong>${safe(player.name)}</strong>`}<span>${safe(player.pos||'—')}</span></div></td>`;
  const value=player[key];
  let label=value===undefined?'—':String(value);
  const number=Number(value);
  if(key==='pm'&&Number.isFinite(number)&&number>0)label='+'+label.replace(/^\+/, '');
  const cls=key==='pts'&&number>=20?'bs-high':key==='pm'&&number>0?'bs-positive':key==='pm'&&number<0?'bs-negative':'';
  return `<td class="${cls}">${safe(label)}</td>`;
}
function boxScoreMarkup(game,summary){
  const teams=getBoxTeams(game,summary);
  if(!teams.length)return '<p class="bs-empty">ESPN game details are not available for this matchup yet.</p>';
  const options=teams.map(t=>`<button type="button" class="bs-team-button" data-bs-team="${safe(t.side)}" aria-pressed="${t.side===(viewerState.boxTeam||'away')}">${safe(t.abbr||t.name)}</button>`).join('');
  const selected=teams.find(t=>t.side===viewerState.boxTeam)||teams[0];
  if(!teams.some(t=>t.side===viewerState.boxTeam))viewerState.boxTeam=selected.side;
  const cols=BOX_COLUMNS.filter(([key])=>viewerState.boxWide||COMPACT_BOX_KEYS.has(key));
  const headers=cols.map(([key,label])=>`<th scope="col"><button type="button" data-bs-sort="${key}" aria-label="Sort by ${safe(label)}">${safe(label)} ${key===viewerState.boxSort?(viewerState.boxSortDesc?'↓':'↑'):''}</button></th>`).join('');
  const metadata=viewerState.statsCache.get(viewerState.gameId);
  const last=metadata?.at?new Date(metadata.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',second:'2-digit'}):'Waiting for update';
  let rows='';
  if(selected.players.length){
    const groups=[['STARTERS',sortedBoxPlayers(selected.players.filter(p=>p.starter&&!p.dnp))],['BENCH',sortedBoxPlayers(selected.players.filter(p=>!p.starter&&!p.dnp))],['DID NOT PLAY',selected.players.filter(p=>p.dnp)]];
    for(const [group,people] of groups){
      if(!people.length)continue;
      rows+=`<tr class="bs-group"><td colspan="${cols.length}">${group}</td></tr>`;
      for(const player of people){
        if(player.dnp)rows+=`<tr class="bs-dnp"><td>${boxCell(player,'name').slice(4,-5)}</td><td colspan="${cols.length-1}">${safe(player.reason||'DNP')}</td></tr>`;
        else rows+=`<tr>${cols.map(([key])=>boxCell(player,key)).join('')}</tr>`;
      }
    }
  }
  if(!rows)rows=`<tr><td class="bs-empty" colspan="${cols.length}">${summary?'Player statistics are not posted for this game yet.':'Loading player statistics from ESPN…'}</td></tr>`;
  const sortedLabel=BOX_COLUMNS.find(([key])=>key===viewerState.boxSort)?.[1]||'PTS';
  const caution=viewerState.statsError?`<div class="bs-warning">ESPN refresh failed. ${metadata?'Showing last available player statistics.':'Player statistics could not be loaded.'}</div>`:'';
  return `<div class="bs-actions"><div class="bs-team-switch" role="group" aria-label="Choose team">${options}</div>
    <button type="button" class="bs-wide-toggle" id="bsWideToggle" aria-pressed="${viewerState.boxWide}">${viewerState.boxWide?'↤ Compact table':'⤢ Wide table'}</button></div>
    <p class="bs-hint">Click a heading to sort players. <strong>Wide table</strong> reveals FG, 3PT, FT, steals, blocks, turnovers and fouls.</p>
    ${caution}
    <div class="bs-table-scroll" tabindex="0" role="region" aria-label="Scrollable player box score"><table class="bs-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="bs-table-footer"><span class="bs-sort-status" aria-live="polite">Sorted by ${safe(sortedLabel)} ${viewerState.boxSortDesc?'↓':'↑'} · ${safe(selected.abbr)}</span><span class="bs-update-label">${safe(last)}</span></div>
    <div class="bs-note"><strong>Starters, bench and DNP</strong> are separated automatically. Missing values display as a dash, not a zero. ${viewerState.boxWide?'The complete table stays alongside the video on wide screens.':''}</div>`;
}
function summaryTeamMap(summary,teams){
  const groups=summary?.boxscore?.teams||[];
  return teams.map(t=>{
    const found=groups.find(g=>t.id&&String(g.team?.id||'')===t.id)||groups.find(g=>String(g.team?.abbreviation||'').toLowerCase()===t.abbr.toLowerCase())||groups.find(g=>g.homeAway===t.side);
    const map={};
    for(const stat of found?.statistics||[]){
      const key=normalizeBoxKey(stat.name||stat.label||'');
      map[key]=stat.displayValue??stat.value;
    }
    return map;
  });
}
const TEAM_COMPARISONS=[
  ['FIELD GOAL %',['fieldgoalpct','fieldgoalpercentage','fgpct']],
  ['3-POINT %',['threepointfieldgoalpct','threepointpct','threepointfieldgoalpercentage']],
  ['FREE THROW %',['freethrowpct','freethrowpercentage']],
  ['REBOUNDS',['totalrebounds','rebounds','reb']],
  ['ASSISTS',['assists','ast']],
  ['TURNOVERS',['turnovers','totalturnovers']],
  ['STEALS',['steals','stl']],
  ['BLOCKS',['blocks','blk']]
];
function scoreBoxMarkup(game){
  const teams=getBoxTeams(game,null);
  if(teams.length!==2)return '<p class="bs-empty">Game score is not available.</p>';
  return `<div class="bs-score">
    ${teams.map(t=>`<div class="bs-score-line"><button class="cs-profile-link" type="button" data-team-profile="${safe(t.id)}" title="Open ${safe(t.name)} team profile">${safe(t.abbr)} · ${safe(t.name)}</button><strong>${safe(t.score??'—')}</strong></div>`).join('')}
    <div class="bs-score-state">${safe(getStatus(game))}</div>
  </div>`;
}
function compareMarkup(t1,t2,label,keys){
  return `<div class="bs-compare"><b>${safe(findSummaryStat(t1,keys))}</b><span>${safe(label)}</span><b>${safe(findSummaryStat(t2,keys))}</b></div>`;
}
function statsTeamMarkup(game,summary){
  if(!game)return '<p class="bs-empty">Select a game to view team statistics.</p>';
  const teams=getBoxTeams(game,summary);
  const maps=summaryTeamMap(summary,teams);
  const comparisons=teams.length===2?TEAM_COMPARISONS.map(([label,keys])=>compareMarkup(maps[0],maps[1],label,keys)).join(''):'';
  const hasData=maps.some(m=>Object.keys(m).length);
  return scoreBoxMarkup(game)+`<div class="bs-subhead">Team comparison</div>${comparisons}${!hasData?'<p class="stats-help">ESPN team statistics are pending or temporarily unavailable.</p>':''}`;
}
function statsOverviewMarkup(game,summary){
  if(!game)return '<p class="bs-empty">Select a game to view its overview.</p>';
  const teams=getBoxTeams(game,summary);
  if(teams.length!==2)return '<p class="bs-empty">No scoreboard data is available for this game.</p>';
  let html=scoreBoxMarkup(game);
  const allPlayers=teams.flatMap(t=>t.players.map(p=>({...p,team:t.abbr})));
  const realPlayers=allPlayers.filter(p=>!p.dnp&&p.pts!==undefined);
  const leaders=[...realPlayers].sort((a,b)=>Number(b.pts||0)-Number(a.pts||0)).slice(0,3);
  if(leaders.length){
    html+='<div class="bs-subhead">Top performers</div>'+leaders.map(p=>`<div class="bs-performer"><div>${p.id?`<button type="button" class="cs-player-link" data-player-profile="${safe(p.id)}" data-player-name="${safe(p.name)}" data-player-team="${safe(p.teamId||'')}" data-player-pos="${safe(p.pos)}">${safe(p.name)}</button>`:`<strong>${safe(p.name)}</strong>`}<br><small>${safe(p.team)} · ${safe(p.pos||'Player')}</small></div><span class="bs-number">${safe(p.pts)} PTS</span></div>`).join('');
  }else{
    // Scoreboard leaders are retained as a fallback when player detail is absent.
    const comps=game.competitions?.[0]?.competitors||[];
    const listed=comps.flatMap(c=>{
      const lead=(c.leaders||[]).find(l=>l.name==='points')?.leaders?.[0];
      return lead?[{id:simpleId(lead.athlete?.id),teamId:simpleId(c.team?.id),name:lead.athlete?.displayName||'Player',team:c.team?.abbreviation||'',pts:lead.displayValue}]:[];
    });
    if(listed.length)html+='<div class="bs-subhead">Scoring leaders</div>'+listed.map(p=>`<div class="bs-performer"><div>${p.id?`<button type="button" class="cs-player-link" data-player-profile="${safe(p.id)}" data-player-name="${safe(p.name)}" data-player-team="${safe(p.teamId)}">${safe(p.name)}</button>`:`<strong>${safe(p.name)}</strong>`}<br><small>${safe(p.team)}</small></div><span class="bs-number">${safe(p.pts)} PTS</span></div>`).join('');
  }
  const linesA=teams[0].lines,linesH=teams[1].lines;
  if(linesA.length||linesH.length){
    html+='<div class="bs-subhead">Quarter scores</div>';
    for(let i=0;i<Math.min(8,Math.max(linesA.length,linesH.length));i++){
      const period=i<4?'Q'+(i+1):'OT'+(i-3);
      html+=`<div class="bs-compare"><b>${safe(linesA[i]?.displayValue??linesA[i]?.value??'—')}</b><span>${period}</span><b>${safe(linesH[i]?.displayValue??linesH[i]?.value??'—')}</b></div>`;
    }
  }
  return html;
}
// Charts share the existing summary cache. No chart action navigates the iframe.
let activeChart = null;
function resetChartGame(){
  viewerState.shotTeam='all';viewerState.shotPlayer='all';viewerState.shotPeriod='all';
  viewerState.chartSelections={lead:null,prob:null,shots:null};activeChart=null;
}
function chartNumber(value){
  if(value===null||value===undefined||typeof value==='boolean'||String(value).trim()==='')return null;
  const n=Number(typeof value==='object'?(value.value??value.displayValue):value);
  return Number.isFinite(n)?n:null;
}
function chartClock(value){
  const text=String(value?.displayValue??value??'').trim();
  if(!/^\d+(?::\d{1,2}(?:\.\d+)?)?(?:\.\d+)?$/.test(text))return null;
  const parts=text.split(':').map(Number);
  if(parts.length===2&&parts[1]>=60)return null;
  return parts.length===2?parts[0]*60+parts[1]:parts[0];
}
function chartPeriodLabel(period){return period<=4?'Q'+period:'OT'+(period-4);}
function chartModel(game,summary){
  const comp=summary?.header?.competitions?.[0]||game?.competitions?.[0]||{};
  const competitors=comp.competitors||[];
  const teams=['away','home'].map((side,index)=>{
    const c=competitors.find(c=>c.homeAway===side)||{};
    return {side,id:String(c.team?.id||c.id||side),abbr:String(c.team?.abbreviation||side.toUpperCase()),name:String(c.team?.displayName||side),score:chartNumber(c.score),color:index?'var(--orange)':'var(--green)'};
  });
  const players=new Map();
  for(const group of summary?.boxscore?.players||[]){
    for(const stats of group.statistics||[]){
      for(const row of stats.athletes||[]){
        const a=row.athlete||{};
        if(a.id)players.set(String(a.id),String(a.displayName||a.fullName||'Player'));
      }
    }
  }
  const plays=[];
  for(const [index,p] of (Array.isArray(summary?.plays)?summary.plays:[]).entries()){
    if(!p||typeof p!=='object')continue;
    const period=chartNumber(p.period?.number),seconds=chartClock(p.clock);
    if(!Number.isInteger(period)||period<1||period>30||seconds===null||seconds<0||seconds>(period<=4?720:300))continue;
    const time=period<=4?(period-1)*720+720-seconds:2880+(period-5)*300+300-seconds;
    const home=chartNumber(p.homeScore),away=chartNumber(p.awayScore);
    const sequence=chartNumber(p.sequenceNumber)??index;
    plays.push({id:String(p.id??'play-'+index),time,period,clock:String(p.clock?.displayValue??p.clock),home,away,lead:home===null||away===null?null:home-away,text:String(p.text||p.type?.text||'Play'),sequence,raw:p});
  }
  plays.sort((a,b)=>a.time-b.time||a.sequence-b.sequence);
  const byId=new Map(plays.map(p=>[p.id,p]));
  const lead=plays.filter(p=>p.home!==null&&p.away!==null&&p.home>=0&&p.away>=0);
  const probability=[];
  for(const row of Array.isArray(summary?.winprobability)?summary.winprobability:[]){
    if(!row||typeof row!=='object')continue;
    const play=byId.get(String(row.playId)),home=chartNumber(row.homeWinPercentage);
    const tie=chartNumber(row.tiePercentage)??0;
    if(!play||home===null||home<0||home>1||tie<0||home+tie>1.000001)continue;
    probability.push({...play,homeChance:home*100,awayChance:Math.max(0,1-home-tie)*100});
  }
  probability.sort((a,b)=>a.time-b.time||a.sequence-b.sequence);
  const shots=plays.filter(p=>p.raw.shootingPlay===true&&[2,3].includes(chartNumber(p.raw.pointsAttempted))).map(p=>{
    const raw=p.raw,x=chartNumber(raw.coordinate?.x),y=chartNumber(raw.coordinate?.y);
    const playerId=String(raw.participants?.[0]?.athlete?.id||'unknown');
    return {...p,x,y,located:x!==null&&y!==null&&x>=0&&x<=50&&y>=-5.25&&y<=88.75,teamId:String(raw.team?.id||''),playerId,player:players.get(playerId)||String(raw.participants?.[0]?.athlete?.displayName||'Unlisted player'),made:raw.scoringPlay===true,points:chartNumber(raw.pointsAttempted),heave:/heave/i.test(raw.type?.text||'')};
  });
  const status=comp.status?.type||game?.status?.type||{};
  const last=lead[lead.length-1];
  const final=status.state==='post'||game?._phase==='final';
  const mismatch=!!(final&&last&&teams[0].score!==null&&teams[1].score!==null&&(last.away!==teams[0].score||last.home!==teams[1].score));
  const maxPeriod=Math.max(4,Number(comp.status?.period)||0,...plays.map(p=>p.period));
  const duration=(48+Math.max(0,maxPeriod-4)*5)*60;
  return {teams,players,plays,lead,probability,shots,comp,duration,mismatch,final,pre:status.state==='pre'||(!summary&&game?._phase==='upcoming'),partial:!!(lead[0]&&lead[0].time>90)};
}
function chartWidth(){
  const panel=$('statsContent');
  const css=window.getComputedStyle(panel);
  return Math.max(220,Math.round(panel.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0)||360));
}
function chartTeamLegend(model,probability=false){
  return `<div class="cs-chart-legend">${model.teams.map((t,i)=>`<span><i class="cs-team-swatch ${i?'cs-home':'cs-away'} ${probability&&!i?'cs-dashed':''}" aria-hidden="true"></i>${safe(t.abbr)}${probability?` <b id="csChance${i}"></b>`:''}</span>`).join('')}</div>`;
}
function chartSelected(rows,kind){
  const id=viewerState.chartSelections[kind];
  const found=id===null?-1:rows.findIndex(p=>p.id===id);
  return found<0?rows.length-1:found;
}
function chartDetail(row,model,kind){
  const teams=model.teams;
  const score=row.away===null||row.home===null?'Score unavailable':`${teams[0].abbr} ${row.away} – ${teams[1].abbr} ${row.home}`;
  const extra=kind==='prob'?`<span>${safe(teams[0].abbr)} ${row.awayChance.toFixed(1)}% · ${safe(teams[1].abbr)} ${row.homeChance.toFixed(1)}%</span>`:'';
  return `<strong>${safe(chartPeriodLabel(row.period))} · ${safe(row.clock)} · ${safe(score)}</strong>${extra}<span>${safe(row.text)}</span>`;
}
function chartStepPath(rows,value,x,y){
  return rows.map((p,i)=>`${i?'H'+x(p.time).toFixed(2)+'V':'M'+x(p.time).toFixed(2)+' '}${y(value(p)).toFixed(2)}`).join('');
}
function lineChartMarkup(model,kind){
  const probability=kind==='prob';
  const rows=probability?model.probability:model.lead;
  if(!rows.length){
    const message=model.pre?'Charts will appear after tipoff.':probability?'Win probability is not available for this game yet.':'Play history is not available for this game yet.';
    return `<p class="bs-empty">${message}</p>`;
  }
  const width=chartWidth(),height=256,left=43,right=12,top=25,bottom=44;
  let min=0,max=100;
  if(!probability){
    min=Math.floor((Math.min(0,...rows.map(p=>p.lead))-1)/5)*5;
    max=Math.ceil((Math.max(0,...rows.map(p=>p.lead))+1)/5)*5;
  }
  const x=time=>left+4+(width-left-right-8)*time/model.duration;
  const y=value=>top+4+(height-top-bottom-8)*(max-value)/(max-min);
  const ticks=probability?[0,25,50,75,100]:Array.from(new Set([min,Math.round(min/2),0,Math.round(max/2),max])).sort((a,b)=>a-b);
  const timeTicks=width<330?[0,model.duration/2,model.duration]:[0,720,1440,2160,2880,...Array.from({length:Math.max(0,Math.round((model.duration-2880)/300))},(_,i)=>3180+i*300)].filter(t=>t<=model.duration);
  const frame=`<rect x="${left}" y="${top}" width="${width-left-right}" height="${height-top-bottom}" fill="none" stroke="#373d48"/>`;
  const grid=ticks.map(v=>`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="${v===0&&!probability?'#727987':'#2a303a'}"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end">${v}${probability?'%':''}</text>`).join('');
  const times=timeTicks.map(t=>`<text x="${x(t)}" y="${height-bottom+19}" text-anchor="${t===0?'start':t===model.duration?'end':'middle'}">${Number((t/60).toFixed(1))}</text>`).join('');
  const quarters=[720,1440,2160,2880,...Array.from({length:Math.max(0,Math.round((model.duration-2880)/300))},(_,i)=>3180+i*300)].filter(t=>t<model.duration).map(t=>`<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${height-bottom}" stroke="#343a44"/>`).join('');
  const index=chartSelected(rows,kind),selected=rows[index];
  const leadPath=probability?'':chartStepPath(rows,p=>p.lead,x,y);
  const lines=probability?`<path d="${chartStepPath(rows,p=>p.homeChance,x,y)}" fill="none" stroke="var(--orange)" stroke-width="2.2"/><path d="${chartStepPath(rows,p=>p.awayChance,x,y)}" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 3"/>`:
    `<defs><clipPath id="csLeadPositive"><rect x="${left}" y="${top}" width="${width-left-right}" height="${y(0)-top}"/></clipPath><clipPath id="csLeadNegative"><rect x="${left}" y="${y(0)}" width="${width-left-right}" height="${height-bottom-y(0)}"/></clipPath></defs><path d="${leadPath}" fill="none" stroke="var(--orange)" stroke-width="2.4" clip-path="url(#csLeadPositive)"/><path d="${leadPath}" fill="none" stroke="var(--green)" stroke-width="2.4" clip-path="url(#csLeadNegative)"/>`;
  activeChart={kind,model,rows,index,width,height,left,right,top,bottom,min,max,x,y};
  const warning=model.mismatch?'<div class="bs-warning">The final score and the recorded play scores differ. This graph shows the available play history; the game score above remains the official total.</div>':model.partial?'<div class="bs-warning">Play history starts after tipoff. Only available events are shown.</div>':'';
  return `<div class="cs-chart-heading"><strong>${probability?'Win probability':'Lead over time'}</strong><span>${probability?'ESPN Analytics estimate':`Above zero: ${safe(model.teams[1].abbr)} · Below zero: ${safe(model.teams[0].abbr)}`}</span></div>
    ${chartTeamLegend(model,probability)}${warning}
    <svg class="cs-line-chart cs-chart-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="csChartTitle csChartDescription" data-cs-linechart="${kind}">
      <title id="csChartTitle">${probability?'ESPN win probability':'Score difference'}: ${safe(model.teams[0].abbr)} at ${safe(model.teams[1].abbr)}</title>
      <desc id="csChartDescription">${rows.length} recorded observations. ${probability?'The solid line is the home team and the dashed line is the away team.':'Positive values mean the home team leads; negative values mean the away team leads.'} Use the Inspect plays slider below to read each observation.</desc>
      ${grid}${quarters}${frame}<text x="${left}" y="14">${probability?'Win chance (%)':'Lead (points)'}</text>${times}<text x="${(left+width-right)/2}" y="${height-5}" text-anchor="middle">Game time (minutes elapsed)</text>${lines}
      <line id="csChartCursor" x1="${x(selected.time)}" x2="${x(selected.time)}" y1="${top}" y2="${height-bottom}" stroke="#e1e4eb" stroke-opacity=".6"/>
      <circle id="csChartMarkerHome" cx="${x(selected.time)}" cy="${y(probability?selected.homeChance:selected.lead)}" r="4" fill="${!probability&&selected.lead<0?'var(--green)':'var(--orange)'}"/>
      ${probability?`<circle id="csChartMarkerAway" cx="${x(selected.time)}" cy="${y(selected.awayChance)}" r="4" fill="var(--green)"/>`:''}
      <rect x="${left}" y="${top}" width="${width-left-right}" height="${height-top-bottom}" fill="transparent"/>
    </svg>
    <label class="cs-scrubber-label" for="csPlayRange"><span>Inspect plays</span><span id="csPlayPosition">${index+1} / ${rows.length}</span></label>
    <input class="cs-play-range" type="range" id="csPlayRange" min="0" max="${rows.length-1}" step="1" value="${index}" aria-label="Inspect recorded plays" aria-valuetext="${safe(chartPeriodLabel(selected.period)+' '+selected.clock+' '+selected.text)}"/>
    <div class="cs-chart-detail" id="csChartDetail" aria-live="polite">${chartDetail(selected,model,kind)}</div>
    <p class="cs-chart-note">${probability?'Probabilities are ESPN model estimates, not guarantees.':'The line follows recorded scores. A scoring run is visible as consecutive steps toward one team.'} Move over the graph, tap a moment, or use the slider to inspect a play.</p>`;
}
function shotDetail(row,model){
  const team=model.teams.find(t=>t.id===row.teamId);
  return `<strong>${safe(row.player)} · ${safe(team?.abbr||'NBA')} · ${row.made?'Made':'Missed'} ${row.points}PT${row.heave?' · Heave':''}</strong><span>${safe(chartPeriodLabel(row.period))} · ${safe(row.clock)}</span><span>${safe(row.text)}</span>`;
}
function shotChartMarkup(model){
  const availableTeams=new Set(model.teams.map(t=>t.id));
  if(viewerState.shotTeam!=='all'&&!availableTeams.has(viewerState.shotTeam))viewerState.shotTeam='all';
  const teamShots=model.shots.filter(p=>viewerState.shotTeam==='all'||p.teamId===viewerState.shotTeam);
  const players=[...new Map(teamShots.map(p=>[p.playerId,p.player])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  if(viewerState.shotPlayer!=='all'&&!players.some(([id])=>id===viewerState.shotPlayer))viewerState.shotPlayer='all';
  const periods=[...new Set(model.shots.map(p=>p.period))].sort((a,b)=>a-b);
  if(viewerState.shotPeriod!=='all'&&!periods.includes(Number(viewerState.shotPeriod)))viewerState.shotPeriod='all';
  const filtered=teamShots.filter(p=>(viewerState.shotPlayer==='all'||p.playerId===viewerState.shotPlayer)&&(viewerState.shotPeriod==='all'||p.period===Number(viewerState.shotPeriod)));
  const rows=filtered.filter(p=>p.located),missing=filtered.length-rows.length;
  const controls=`<div class="cs-shot-filters"><label for="csShotTeam">Team<select id="csShotTeam"><option value="all">Both teams</option>${model.teams.map(t=>`<option value="${safe(t.id)}" ${t.id===viewerState.shotTeam?'selected':''}>${safe(t.abbr)}</option>`).join('')}</select></label><label for="csShotPeriod">Quarter<select id="csShotPeriod"><option value="all">All quarters</option>${periods.map(p=>`<option value="${p}" ${String(p)===viewerState.shotPeriod?'selected':''}>${chartPeriodLabel(p)}</option>`).join('')}</select></label><label class="cs-player-filter" for="csShotPlayer">Player<select id="csShotPlayer"><option value="all">All players</option>${players.map(([id,name])=>`<option value="${safe(id)}" ${id===viewerState.shotPlayer?'selected':''}>${safe(name)}</option>`).join('')}</select></label></div>`;
  if(!model.shots.length)return `<p class="bs-empty">${model.pre?'Shot charts will appear after tipoff.':'Shot locations are not available for this game yet.'}</p>`;
  if(!rows.length)return controls+`<p class="bs-empty">${missing?'No usable locations are available for these shot events.':'No shots match these filters yet.'}</p>`;
  const width=chartWidth(),pad=16,scale=(width-pad*2)/50;
  const yMin=-5.25,yMax=Math.max(41.75,...rows.map(p=>p.y+2));
  const height=Math.ceil((yMax-yMin)*scale+pad*2),x=v=>pad+v*scale,y=v=>pad+(yMax-v)*scale;
  const path=pts=>pts.map((p,i)=>(i?'L':'M')+x(p[0]).toFixed(2)+' '+y(p[1]).toFixed(2)).join('');
  const courtRect=(a,b,w,h)=>`<rect x="${x(a)}" y="${y(b+h)}" width="${w*scale}" height="${h*scale}"/>`;
  const cornerY=Math.sqrt(23.75**2-22**2),theta=Math.atan2(cornerY,22);
  const arc=Array.from({length:65},(_,i)=>{const angle=theta+(Math.PI-2*theta)*i/64;return [25+23.75*Math.cos(angle),23.75*Math.sin(angle)];});
  const court=`<g fill="none" stroke="#68717f" stroke-width="1.15">${courtRect(0,yMin,50,yMax-yMin)}${courtRect(17,-5.25,16,19)}<circle cx="${x(25)}" cy="${y(13.75)}" r="${6*scale}"/><circle cx="${x(25)}" cy="${y(0)}" r="${.75*scale}"/><path d="${path([[22,-1.25],[28,-1.25]])}"/><path d="${path([[3,-5.25],[3,cornerY]])}"/><path d="${path(arc)}"/><path d="${path([[47,cornerY],[47,-5.25]])}"/><line x1="${x(0)}" x2="${x(50)}" y1="${y(41.75)}" y2="${y(41.75)}"/><path d="${path(Array.from({length:33},(_,i)=>{const a=Math.PI*i/32;return [25+4*Math.cos(a),4*Math.sin(a)];}))}"/></g>`;
  const index=chartSelected(rows,'shots'),selected=rows[index];
  const marks=rows.map(row=>{
    const color=model.teams.find(t=>t.id===row.teamId)?.color||'#b8c0ce',px=x(row.x),py=y(row.y);
    const mark=row.made?`<circle cx="${px}" cy="${py}" r="4.2" fill="${color}"/>`:`<path d="M${px-3.5} ${py-3.5}L${px+3.5} ${py+3.5}M${px+3.5} ${py-3.5}L${px-3.5} ${py+3.5}" stroke="${color}" stroke-width="1.6"/>`;
    return `<g data-cs-shot="${safe(row.id)}"><title>${safe(row.player+' · '+chartPeriodLabel(row.period)+' '+row.clock+' · '+row.text)}</title>${mark}<circle cx="${px}" cy="${py}" r="10" fill="transparent"/></g>`;
  }).join('');
  activeChart={kind:'shots',model,rows,index,x,y,width,height};
  const made=rows.filter(p=>p.made).length;
  return `${controls}<div class="cs-chart-heading"><strong>Shot locations</strong><span>${rows.length} shown · ${made} made · ${rows.length-made} missed</span></div>${chartTeamLegend(model)}
    <div class="cs-shot-key"><span>● Made</span><span>× Missed</span>${rows.some(p=>p.heave)?'<span>Includes logged heaves</span>':''}</div>
    ${missing?`<div class="bs-warning">${missing} shot event${missing===1?' has':'s have'} no usable location and ${missing===1?'is':'are'} omitted.</div>`:''}
    <svg class="cs-chart-svg cs-shot-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="csShotTitle csShotDescription"><title id="csShotTitle">Shot locations for ${safe(model.teams[0].abbr)} and ${safe(model.teams[1].abbr)}</title><desc id="csShotDescription">${rows.length} located shot events. Filled circles are made shots; crosses are misses. Use team, quarter and player filters, and the Shot details menu below.</desc>${court}${marks}<circle id="csShotSelection" cx="${x(selected.x)}" cy="${y(selected.y)}" r="8" fill="none" stroke="#f2f2f5" stroke-width="1.5" pointer-events="none"/></svg>
    <label class="cs-shot-picker" for="csShotSelect">Shot details<select id="csShotSelect">${rows.map((p,i)=>`<option value="${safe(p.id)}" ${i===index?'selected':''}>${safe(chartPeriodLabel(p.period)+' '+p.clock+' · '+p.player+' · '+(p.made?'Made':'Missed')+' '+p.points+'PT')}</option>`).join('')}</select></label>
    <div class="cs-chart-detail" id="csChartDetail" aria-live="polite">${shotDetail(selected,model)}</div>
    <p class="cs-chart-note">Tap a shot or choose it from Shot details. Locations are approximate. Logged heaves may appear here without counting as individual attempts; use Box Score for official shooting totals.</p>`;
}
function chartsMarkup(game,summary){
  activeChart=null;
  const views=[['lead','Lead'],['shots','Shots'],['prob','Win Probability']];
  const tabs=`<div class="cs-chart-tabs" role="tablist" aria-label="Chart type">${views.map(([key,label])=>`<button type="button" role="tab" id="csView${key}" data-cs-view="${key}" aria-controls="csChartBody" aria-selected="${viewerState.chartView===key}" tabindex="${viewerState.chartView===key?0:-1}">${label}</button>`).join('')}</div>`;
  const model=chartModel(game,summary);
  const error=viewerState.statsError?`<div class="bs-warning">Chart refresh failed. ${summary?'Showing the last available data.':'Use Refresh to try again.'}</div>`:'';
  let content='';
  if(!summary&&!model.pre)content='<p class="bs-empty">'+(viewerState.statsError?'Game history could not be loaded.':'Loading game history…')+'</p>';
  else content=viewerState.chartView==='shots'?shotChartMarkup(model):lineChartMarkup(model,viewerState.chartView);
  const score=model.teams.every(t=>t.score!==null)&&!model.pre?`<div class="cs-official-score">${safe(model.teams[0].abbr)} <strong>${model.teams[0].score}</strong><span>–</span>${safe(model.teams[1].abbr)} <strong>${model.teams[1].score}</strong><small>${safe(model.comp.status?.type?.shortDetail||model.comp.status?.type?.description||'')}</small></div>`:'';
  return tabs+`<div id="csChartBody" role="tabpanel" aria-labelledby="csView${viewerState.chartView}">${score}${error}${content}</div>`;
}
function setChartView(kind){
  if(!['lead','shots','prob'].includes(kind))return;
  if(viewerState.chartView!==kind)$('statsContent').scrollTop=0;
  viewerState.chartView=kind;
  renderStats(state.games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
}
function inspectChart(index,announce=false){
  const chart=activeChart;
  if(!chart||!chart.rows.length||chart.kind==='shots')return;
  index=Math.max(0,Math.min(chart.rows.length-1,Math.round(Number(index)||0)));
  const row=chart.rows[index];chart.index=index;
  viewerState.chartSelections[chart.kind]=index===chart.rows.length-1?null:row.id;
  const cursor=$('csChartCursor'),marker=$('csChartMarkerHome'),detail=$('csChartDetail');
  if(cursor){cursor.setAttribute('x1',chart.x(row.time));cursor.setAttribute('x2',chart.x(row.time));}
  if(marker){marker.setAttribute('cx',chart.x(row.time));marker.setAttribute('cy',chart.y(chart.kind==='prob'?row.homeChance:row.lead));marker.setAttribute('fill',chart.kind==='lead'&&row.lead<0?'var(--green)':'var(--orange)');}
  const away=$('csChartMarkerAway');
  if(away){away.setAttribute('cx',chart.x(row.time));away.setAttribute('cy',chart.y(row.awayChance));}
  if(detail){detail.setAttribute('aria-live',announce?'polite':'off');detail.innerHTML=chartDetail(row,chart.model,chart.kind);}
  if($('csPlayRange')){$('csPlayRange').value=String(index);$('csPlayRange').setAttribute('aria-valuetext',chartPeriodLabel(row.period)+' '+row.clock+' '+row.text);}
  if($('csPlayPosition'))$('csPlayPosition').textContent=`${index+1} / ${chart.rows.length}`;
  if(chart.kind==='prob')chart.model.teams.forEach((t,i)=>{if($('csChance'+i))$('csChance'+i).textContent=(i?row.homeChance:row.awayChance).toFixed(1)+'%';});
}
function inspectShot(id,announce=true){
  const chart=activeChart;if(chart?.kind!=='shots')return;
  const index=chart.rows.findIndex(p=>p.id===id);if(index<0)return;
  const row=chart.rows[index];chart.index=index;
  viewerState.chartSelections.shots=index===chart.rows.length-1?null:id;
  if($('csShotSelection')){$('csShotSelection').setAttribute('cx',chart.x(row.x));$('csShotSelection').setAttribute('cy',chart.y(row.y));}
  if($('csShotSelect'))$('csShotSelect').value=id;
  if($('csChartDetail')){$('csChartDetail').setAttribute('aria-live',announce?'polite':'off');$('csChartDetail').innerHTML=shotDetail(row,chart.model);}
}
function inspectChartPointer(event){
  const svg=event.target.closest?.('[data-cs-linechart]'),chart=activeChart;
  if(!svg||!chart||chart.kind==='shots'||(event.type==='pointermove'&&event.pointerType==='touch'))return;
  const bounds=svg.getBoundingClientRect();if(!bounds.width)return;
  const pixel=(event.clientX-bounds.left)*chart.width/bounds.width;
  const time=Math.max(0,Math.min(chart.model.duration,(pixel-chart.left-4)/(chart.width-chart.left-chart.right-8)*chart.model.duration));
  let lo=0,hi=chart.rows.length-1;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(chart.rows[mid].time<time)lo=mid+1;else hi=mid;}
  if(lo>0&&Math.abs(chart.rows[lo-1].time-time)<Math.abs(chart.rows[lo].time-time))lo--;
  while(lo+1<chart.rows.length&&chart.rows[lo+1].time===chart.rows[lo].time)lo++;
  inspectChart(lo,event.type==='pointerdown');
}
function chartInput(event){
  if(event.target.id==='csPlayRange'){inspectChart(event.target.value,true);return;}
  if(event.type!=='change')return;
  const fields={csShotTeam:'shotTeam',csShotPlayer:'shotPlayer',csShotPeriod:'shotPeriod'};
  if(event.target.id==='csShotSelect'){inspectShot(event.target.value);return;}
  const key=fields[event.target.id];if(!key)return;
  viewerState[key]=event.target.value;
  if(key==='shotTeam')viewerState.shotPlayer='all';
  viewerState.chartSelections.shots=null;
  renderStats(state.games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
}
function chartKeydown(event){
  const tab=event.target.closest('[data-cs-view]');
  if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const views=['lead','shots','prob'];
  const next=event.key==='Home'?'lead':event.key==='End'?'prob':views[(views.indexOf(tab.dataset.csView)+(event.key==='ArrowRight'?1:-1)+views.length)%views.length];
  setChartView(next);$('csView'+next)?.focus();
}

function renderStats(game,summary){
  const panel=$('statsContent');
  const focused=panel.contains(document.activeElement)?document.activeElement?.id:null;
  activeChart=null;
  const scrollTop=panel.scrollTop;
  const oldTable=panel.querySelector('.bs-table-scroll');
  const scrollLeft=oldTable?.scrollLeft||0;
  const selected=viewerState.statsTab;
  panel.setAttribute('aria-live',selected==='charts'?'off':'polite');
  for(const tab of $('statsSidebar').querySelectorAll('[data-bs-tab]')){
    const active=tab.dataset.bsTab===selected;
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
    if(active)panel.setAttribute('aria-labelledby',tab.id);
  }
  $('viewerWorkspace').classList.toggle('box-wide',viewerState.statsOpen&&selected==='box'&&viewerState.boxWide);
  $('viewerWorkspace').classList.toggle('charts-open',viewerState.statsOpen&&selected==='charts');
  if(selected==='overview')panel.innerHTML=statsOverviewMarkup(game,summary);
  else if(selected==='team')panel.innerHTML=statsTeamMarkup(game,summary);
  else if(selected==='charts')panel.innerHTML=chartsMarkup(game,summary);
  else panel.innerHTML=boxScoreMarkup(game,summary);
  // Updating player data must neither reset the video nor jump the table scroll.
  panel.scrollTop=scrollTop;
  if(selected==='box'){const next=panel.querySelector('.bs-table-scroll');if(next)next.scrollLeft=scrollLeft;}
  if(selected==='charts'&&activeChart?.kind==='prob')inspectChart(activeChart.index);
  if(focused&&$(focused))$(focused).focus({preventScroll:true});
  const cache=viewerState.statsCache.get(viewerState.gameId);
  const when=cache?.at?`Updated ${new Date(cache.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`:'Waiting for ESPN';
  $('boxStatsStatus').textContent=viewerState.statsError?`${when} · Cached / unavailable`:when;
}
async function fetchGameSummary(id,force=false){
  const cached=viewerState.statsCache.get(id);
  if(!force&&!statsNeedsRequest(id))return cached?.data;
  if(viewerState.statsPending.has(id))return viewerState.statsPending.get(id);
  if(Date.now()<espnPoll.sharedUntil)throw new Error('ESPN rate limit cooldown in progress');
  if(!force&&statsPoll.gameId===id&&Date.now()<statsPoll.nextAt)
    throw new Error('ESPN statistics are waiting for retry');
  const phaseAtRequest=phaseForGameId(id);
  let summaryResponse=null;
  const fetchPromise=(async()=>{
    const controller=new AbortController();let timer;
    try{
      const data=await auditESPNJob({source:'Game Center',resource:`Game ${id}`,url:`${SUMMARY_API}?event=${encodeURIComponent(id)}`,priority:1},async report=>{
        if(Date.now()<espnPoll.sharedUntil)throw new Error('ESPN statistics rate-limit cooldown in progress');
        timer=setTimeout(()=>controller.abort(),9000);
        const r=await fetch(`${SUMMARY_API}?event=${encodeURIComponent(id)}`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
        report(r);
        if(!r.ok){noteEspnResponseError(r,'stats');throw new Error(`ESPN statistics HTTP ${r.status}`);}
        return await r.json();
      });
      summaryResponse=data;
      if(!data || typeof data!=='object')throw new Error('Unexpected game summary');
      dataLogObserve(data,`summary:${id}`,()=>dataLogSummaryRecords(data));
      viewerState.statsCache.set(id,{at:Date.now(),data,phase:phaseAtRequest});
      if(statsPoll.gameId===id){statsPoll.failures=0;statsPoll.nextAt=0;}
      return data;
    }catch(error){
      if(summaryResponse)dataLogInvalid(summaryResponse,error);
      if(statsPoll.gameId===id){
        statsPoll.failures++;
        statsPoll.nextAt=Date.now()+exponentialBackoff(statsPoll.failures);
      }
      throw error;
    }finally{clearTimeout(timer);}
  })();
  viewerState.statsPending.set(id,fetchPromise);
  try{return await fetchPromise;}
  finally{if(viewerState.statsPending.get(id)===fetchPromise)viewerState.statsPending.delete(id);}
}
async function updateStatsSidebar(force=false,{showCache=true}={}){
  if($('viewer').hidden||!viewerState.statsOpen)return;
  const id=viewerState.gameId,token=++viewerState.statsSeq;
  if(!id){$('statsContent').innerHTML='<p class="bs-empty">Choose an NBA game to view player statistics.</p>';return;}
  resetStatsPollFor(id);
  const game=state.games.find(g=>String(g.id)===id);
  const cache=viewerState.statsCache.get(id);
  if(showCache)renderStats(game,cache?.data);
  if(!statsNeedsRequest(id,force))return;
  if(!force&&Date.now()<statsPoll.nextAt)return;
  // Respect shared ESPN cooldown even when the user asks for a manual refresh.
  if(Date.now()<espnPoll.sharedUntil){
    viewerState.statsError='ESPN rate limited';
    if(showCache)renderStats(game,cache?.data);
    return;
  }
  try{
    const summary=await fetchGameSummary(id,force);
    if(token===viewerState.statsSeq&&viewerState.gameId===id&&viewerState.statsOpen&&!$('viewer').hidden){
      viewerState.statsError='';
      renderStats(state.games.find(g=>String(g.id)===id),summary);
    }
  }catch(err){
    if(token===viewerState.statsSeq&&viewerState.gameId===id&&!$('viewer').hidden){
      viewerState.statsError=err?.message||'Unavailable';
      renderStats(state.games.find(g=>String(g.id)===id),viewerState.statsCache.get(id)?.data);
    }
  }
}
function setStatsTab(tab){
  if(!['overview','box','team','charts'].includes(tab))return;
  if(viewerState.statsTab!==tab)$('statsContent').scrollTop=0;
  viewerState.statsTab=tab;
  viewerState.statsOpen=true;
  paintViewer();
}

  function classify(game){const s=game.status?.type?.state ?? game.competitions?.[0]?.status?.type?.state;return s==='in'?'live':s==='post'?'final':'upcoming';}
  function parseGames(json){
    if (!json || !Array.isArray(json.events)) throw new Error('Unexpected data format from the scoreboard provider.');
    return json.events.map(g=>({...g,_phase:classify(g)}));
  }
  function updateStatus(){
    const limited=Date.now()<espnPoll.sharedUntil;
    const connected=state.lastUpdated && !state.error && !limited;
    $('connection').innerHTML=`<span class="dot ${state.loading?'loading':connected?'':'error'}"></span>${state.loading?'UPDATING SCORES':limited?'ESPN RATE LIMITED':connected?'LIVE DATA CONNECTED':'DATA UNAVAILABLE'}`;
    $('updated').textContent=state.lastUpdated?`Last updated ${state.lastUpdated.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',second:'2-digit'})}${state.error||limited?' · cached scores':''}`:'Waiting for first update…';
    $('refreshBtn').classList.toggle('spin',state.loading);
    $('refreshBtn').disabled=state.loading;
    const countdown=ms=>`${Math.max(0,Math.ceil((ms-Date.now())/1000))}s`;
    const scoreText=!Number.isFinite(state.nextAt)?'Historical results · manual refresh':
      `Scores: ${state.games.some(g=>g._phase==='live')?'Live 10s':'Idle 60s'} · next in ${countdown(Math.max(state.nextAt,espnPoll.sharedUntil))}`;
    const statsDue=selectedStatsDueAt();
    const statsText=$('viewer').hidden||!viewerState.statsOpen||!viewerState.gameId?'Game Center: inactive':
      !Number.isFinite(statsDue)?'Game Center: final · manual refresh':
      `Game Center: next in ${countdown(statsDue)}`;
    const cooldown=limited?`\nESPN cooling down: ${countdown(espnPoll.sharedUntil)} remaining`:'';
    $('nextRefresh').textContent=`${scoreText}\n${statsText}${cooldown}`;
  }
  async function fetchScores(force=false){
    // Ordinary ticks never cancel an existing request; selecting a different date may.
    if(state.loading){
      if(state.fetchDate===state.date)return;
      if(state.controller)state.controller.abort();
    }
    if(Date.now()<espnPoll.sharedUntil){
      alertsResetBaseline();
      state.nextAt=Math.max(state.nextAt,espnPoll.sharedUntil);
      if(force){state.error='ESPN has temporarily rate-limited requests. Waiting before retrying.';state.firstLoaded=true;render();}
      updateStatus();
      return;
    }
    if(!force&&!Number.isFinite(state.nextAt))return;
    const seq=++state.requestSeq;
    const controller=new AbortController();state.controller=controller;
    let timer;
    state.loading=true;state.error='';state.fetchDate=state.date;updateStatus();
    const requested=state.date;
    let scoreResponse=null;
    try{
      const endpoint=`${API}?dates=${requested.replaceAll('-','')}&limit=100`;
      const json=await auditESPNJob({source:'Scoreboard',resource:requested,url:endpoint,priority:0},async report=>{
        if(controller.signal.aborted)throw new DOMException('Score request cancelled','AbortError');
        if(Date.now()<espnPoll.sharedUntil)throw new Error('ESPN rate limit cooldown in progress');
        timer=setTimeout(()=>controller.abort(),14000);
        const res=await fetch(endpoint,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
        report(res);
        if(!res.ok){noteEspnResponseError(res,'scores');throw new Error(`Score provider returned HTTP ${res.status}.`);}
        return await res.json();
      });
      if(seq!==state.requestSeq)return;
      scoreResponse=json;
      state.games=parseGames(json);
      dataLogObserve(json,`scores:${requested}`,()=>dataLogScoreRecords(state.games));
      try{alertsObserveScoreboard(state.games,requested);}catch(error){console.warn('Courtside alert comparison skipped:',error);}
      seedTeamDirectoryFromScores();
      state.lastUpdated=new Date();state.firstLoaded=true;state.error='';
      espnPoll.scoreFailures=0;
      render();
      renderTickers();
      if(!$('viewer').hidden){updateLiveGamePicker();paintViewer();}
    }catch(err){
      if(seq!==state.requestSeq)return;
      if(scoreResponse)dataLogInvalid(scoreResponse,err);
      espnPoll.scoreFailures++;
      alertsResetBaseline();
      state.error=err.name==='AbortError'?'The request timed out. Please retry.':err.message;
      state.firstLoaded=true;
      render();
    }finally{
      clearTimeout(timer);
      if(seq===state.requestSeq){
        state.loading=false;state.controller=null;state.fetchDate=null;
        state.nextAt=Number.isFinite(scoresRefreshMs())?Date.now()+(state.error?exponentialBackoff(espnPoll.scoreFailures):scoresRefreshMs()):Infinity;
        state.nextAt=Math.max(state.nextAt,espnPoll.sharedUntil);
        updateStatus();
      }
    }
  }
  function changeDay(offset){const d=dateFromString(state.date);d.setDate(d.getDate()+offset);selectDay(fmtDate(d));}
  function selectDay(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return;alertsResetBaseline();state.date=day;state.games=[];state.expanded.clear();state.error='';state.firstLoaded=false;state.lastUpdated=null;state.nextAt=0;$('datePicker').value=day;render();renderTickers();fetchScores(true);}
  const formatStart = iso => {const d=new Date(iso);return Number.isNaN(d.getTime())?'Time TBA':d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});};
  function getStatus(game){const phase=game._phase;if(phase==='final')return game.status?.type?.shortDetail || 'FINAL';if(phase==='live')return game.status?.type?.shortDetail || 'IN PROGRESS';return formatStart(game.date);}
  function teamData(c){return {id:String(c?.team?.id||''),name:c?.team?.displayName||c?.team?.name||'Team',short:c?.team?.shortDisplayName||c?.team?.name||'Team',abbr:c?.team?.abbreviation||'NBA',logo:safeLogo(c?.team?.logoDark || c?.team?.logo),score:c?.score,record:c?.records?.find(r=>r.name==='overall')?.summary || c?.records?.[0]?.summary || '',lines:c?.linescores || [],leaders:c?.leaders || []};}
  function logoHTML(t){return `<div class="logo-wrap"><div class="logo-fallback" aria-hidden="true">${safe(t.abbr)}</div>${t.logo?`<img class="logo" src="${safe(t.logo)}" alt="${safe(t.name)} logo" loading="lazy" onerror="this.style.display='none'">`:``}</div>`;}
  function scoreHTML(t,other,phase){if(phase==='upcoming')return '<span class="score upcoming">—</span>';const n=Number(t.score),o=Number(other.score);return `<span class="score ${phase==='final'&&n<o?'loser':''}">${safe(t.score??'—')}</span>`;}
  function detailHTML(a,h){
    const max=Math.min(8,Math.max(a.lines.length,h.lines.length));
    let html='';
    if(max){
      const headers=Array.from({length:max},(_,i)=>`<th scope="col">${i<4?'Q'+(i+1):'OT'+(i-3)}</th>`).join('');
      const row=t=>`<tr><td>${safe(t.abbr)}</td>${Array.from({length:max},(_,i)=>`<td>${safe(t.lines[i]?.displayValue??t.lines[i]?.value??'—')}</td>`).join('')}</tr>`;
      html+=`<div class="details-label">Quarter-by-quarter</div><table class="quarters"><thead><tr><th scope="col">TEAM</th>${headers}</tr></thead><tbody>${row(a)}${row(h)}</tbody></table>`;
    }
    for (const t of [a,h]) {
      const leader=t.leaders.find(x=>x.name==='points')?.leaders?.[0];
      if(leader)html+=`<div class="leader"><strong>${safe(t.short)} leader:</strong> ${safe(leader.athlete?.displayName||leader.athlete?.fullName||'Player')} — ${safe(leader.displayValue)} PTS</div>`;
    }
    return html||'<div class="leader">Game details will appear as they become available.</div>';
  }
  function gameCard(game){
    const comp=game.competitions?.[0]||{};const teams=comp.competitors||[];
    const away=teamData(teams.find(c=>c.homeAway==='away'));
    const home=teamData(teams.find(c=>c.homeAway==='home'));
    const phase=game._phase,expanded=state.expanded.has(game.id);
    const broadcasts=(comp.broadcasts||[]).flatMap(b=>b.names||[]).filter(Boolean);
    if(!broadcasts.length && comp.broadcast) broadcasts.push(comp.broadcast);
    const note=(comp.notes||[]).map(n=>n.headline).filter(Boolean)[0];
    const sideLabel=note?note:(phase==='upcoming'?'TIPOFF '+formatStart(game.date):'NBA');
    const id=String(game.id||'').replace(/[^0-9]/g,'');
    const link=id?`https://www.espn.com/nba/game?gameId=${id}`:'https://www.espn.com/nba/scoreboard';
    const name=(t,o)=>`<div class="team-row"><button type="button" class="cs-team-action cs-score-team-action" data-team-profile="${safe(t.id)}" title="View ${safe(t.name)} profile" aria-label="Open ${safe(t.name)} team profile">${logoHTML(t)}<div style="min-width:0"><div class="team-name" title="${safe(t.name)}">${safe(t.short)}</div><div class="team-meta">${safe(t.record ? t.record + ' · ' : '')}${o==='away'?'Away':'Home'}</div></div></button></div>`;
    return `<article class="game ${phase}" data-game-id="${safe(game.id)}" tabindex="0" title="Click to watch available NBA streams" aria-label="${safe(away.name)} at ${safe(home.name)}: ${safe(getStatus(game))}. Press Enter to watch.">
      <div class="game-top"><span class="game-status ${phase}">${phase==='live'?'<span class="dot"></span>LIVE · '+safe(getStatus(game)):phase==='final'?safe(getStatus(game)):'UPCOMING · '+safe(getStatus(game))}</span><span class="game-side-label">${safe(sideLabel)}</span></div>
      <div class="teams"><div>${name(away,'away')}${name(home,'home')}</div><div>${scoreHTML(away,home,phase)}<div style="height:31px"></div>${scoreHTML(home,away,phase)}</div></div>
      <div class="game-bottom"><span class="broadcast" title="${safe(broadcasts.join(', '))}">${safe(broadcasts.slice(0,2).join(' · ')||'NBA Basketball')}</span><div class="actions"><button type="button" class="text-btn watch-button" data-watch="${safe(game.id)}" aria-label="Watch ${safe(away.short)} at ${safe(home.short)} ">▶ Watch</button><button type="button" class="text-btn expand-button" data-game="${safe(game.id)}" aria-expanded="${expanded}" aria-label="${expanded?'Hide':'Show'} game details">${expanded?'Hide stats −':'Game stats +'}</button><a class="text-btn arrow" href="${safe(link)}" target="_blank" rel="noopener noreferrer">Gamecast</a></div></div>
      ${expanded?`<div class="details">${detailHTML(away,home)}</div>`:''}
    </article>`;
  }
  function sectionHTML(label,phase,games){if(!games.length)return '';const heading=phase==='live'?'LIVE NOW':phase==='upcoming'?'COMING UP':'FINAL BUZZER';return `<section class="section ${phase}"><div class="section-heading"><h2>${heading}</h2><span class="section-count">${games.length} ${games.length===1?'GAME':'GAMES'}</span></div><div class="cards">${games.map(gameCard).join('')}</div></section>`;}
  // Patch only the actual DOM changes in cards; preserve buttons, focus, logo
  // images, and expanded details while a live game's numbers are refreshed.
  const gameMarkupCache=new WeakMap();
  function patchGameDOM(current,fresh){
    if(current.nodeType!==fresh.nodeType ||
        (current.nodeType===Node.ELEMENT_NODE&&current.tagName!==fresh.tagName)){
      current.replaceWith(fresh.cloneNode(true));return;
    }
    if(current.nodeType===Node.TEXT_NODE){
      if(current.nodeValue!==fresh.nodeValue)current.nodeValue=fresh.nodeValue;
      return;
    }
    if(current.nodeType!==Node.ELEMENT_NODE)return;
    for(const attr of [...current.attributes])if(!fresh.hasAttribute(attr.name))current.removeAttribute(attr.name);
    for(const attr of [...fresh.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
    // Game cards contain no form inputs or streams; positional child patching
    // preserves the interactive card and its bound/focused descendants.
    let i=0;
    while(i<fresh.childNodes.length){
      const newChild=fresh.childNodes[i],oldChild=current.childNodes[i];
      if(!oldChild){current.appendChild(newChild.cloneNode(true));}
      else patchGameDOM(oldChild,newChild);
      i++;
    }
    while(current.childNodes.length>fresh.childNodes.length)current.lastChild.remove();
  }
  function reconcileGameSections(filtered){
    const board=$('scoreboard'),cardMap=new Map(
      [...board.querySelectorAll('.game[data-game-id]')].map(card=>[card.dataset.gameId,card])
    );
    let sectionIndex=0;
    for(const phase of ['live','upcoming','final']){
      const games=filtered.filter(g=>g._phase===phase);
      if(!games.length)continue;
      let section=[...board.children].find(child=>child.classList.contains('section')&&child.classList.contains(phase));
      if(!section){
        // Section headings must exist even if a phase was absent previously.
        const title=phase==='live'?'LIVE NOW':phase==='upcoming'?'COMING UP':'FINAL BUZZER';
        section=document.createElement('section');section.className=`section ${phase}`;
        section.innerHTML=`<div class="section-heading"><h2>${title}</h2><span class="section-count"></span></div><div class="cards"></div>`;
      }
      const count=section.querySelector('.section-count'),label=`${games.length} ${games.length===1?'GAME':'GAMES'}`;
      if(count.textContent!==label)count.textContent=label;
      const grid=section.querySelector('.cards');
      for(const [i,game] of games.entries()){
        const key=String(game.id),markup=gameCard(game);
        let card=cardMap.get(key);
        if(!card){const template=document.createElement('template');template.innerHTML=markup;card=template.content.firstElementChild;}
        else if(gameMarkupCache.get(card)!==markup){
          const template=document.createElement('template');template.innerHTML=markup;
          patchGameDOM(card,template.content.firstElementChild);
        }
        gameMarkupCache.set(card,markup);
        if(grid.children[i]!==card)grid.insertBefore(card,grid.children[i]||null);
      }
      while(grid.children.length>games.length)grid.lastElementChild.remove();
      if(board.children[sectionIndex]!==section)board.insertBefore(section,board.children[sectionIndex]||null);
      sectionIndex++;
    }
    while(board.children.length>sectionIndex)board.lastElementChild.remove();
  }
  function render(){
    const games=state.games;
    $('totalCount').textContent=state.firstLoaded?games.length:'—';
    $('liveCount').textContent=state.firstLoaded?games.filter(g=>g._phase==='live').length:'—';
    $('upcomingCount').textContent=state.firstLoaded?games.filter(g=>g._phase==='upcoming').length:'—';
    $('finalCount').textContent=state.firstLoaded?games.filter(g=>g._phase==='final').length:'—';
    const fb=$('feedback');
    fb.classList.toggle('show',!!state.error);fb.textContent=state.error?`Unable to update: ${state.error}${state.lastUpdated?' Showing the most recently loaded scores.':' Please check your internet connection or try again.'}`:'';
    if(!state.firstLoaded){
      const board=$('scoreboard');
      if(!board.querySelector('.loading-card'))board.innerHTML='<div class="cards"><div class="loading-card"></div><div class="loading-card"></div><div class="loading-card"></div></div>';
      return;
    }
    const q=state.query.toLowerCase().trim();
    const filtered=games.filter(g=>{
      if(state.liveOnly&&g._phase!=='live')return false;
      if(!q)return true;
      const text=(g.competitions?.[0]?.competitors||[]).map(t=>[t.team?.displayName,t.team?.name,t.team?.location,t.team?.abbreviation].join(' ')).join(' ').toLowerCase();return text.includes(q);
    }).sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(!filtered.length){
      const empty=games.length===0?'No NBA games scheduled':state.liveOnly?'No live games match':'No matching games';
      const copy=games.length===0?'There are no matchups listed for this date. Try the previous or next day.':state.liveOnly?'Try switching off “Live only” to see upcoming and completed games.':'Try a different team search.';
      $('scoreboard').innerHTML=`<div class="empty"><div class="empty-symbol" aria-hidden="true">◌</div><h2>${empty}</h2><p>${copy}</p></div>`;return;
    }
    reconcileGameSections(filtered);
  }

  // Standings are loaded on demand. ESPN's /teams endpoint is intentionally avoided
  // because it doesn't consistently allow cross-origin browser requests.
  const STANDINGS_API='https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';
  const TEAM_API='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
  const STANDINGS_TTL_MS=10*60*1000,TEAM_DETAILS_TTL_MS=15*60*1000;
  const teamDirectory=new Map();
  const standingsState={groups:[],at:0,pending:null,error:'',retryAt:0,failures:0,season:null};
  const profileState={id:null,tab:'overview',previousFocus:null,cache:new Map(),pending:new Map()};
  let mainView='scores';
  const simpleId=value=>/^\d{1,12}$/.test(String(value||''))?String(value):'';
  function statNumber(value){const n=Number(value);return Number.isFinite(n)?n:null;}
  function seedTeamDirectoryFromScores(){
    for(const game of state.games)for(const c of game.competitions?.[0]?.competitors||[]){
      const t=c.team||{},id=simpleId(t.id);if(!id)continue;
      const existing=teamDirectory.get(id)||{};
      teamDirectory.set(id,{...existing,id,name:existing.name||t.displayName||t.name||t.abbreviation||'NBA Team',short:existing.short||t.shortDisplayName||t.name||t.abbreviation||'Team',abbr:existing.abbr||t.abbreviation||'',logo:existing.logo||safeLogo(t.logo||t.logos?.[0]?.href),fallbackRecord:c.records?.find(x=>x.name==='overall')?.summary||c.records?.[0]?.summary||existing.fallbackRecord||''});
    }
  }
  function mappedStats(stats){
    const map={};for(const item of stats||[])if(item&&item.name)map[String(item.name).replace(/[^a-z0-9]/gi,'').toLowerCase()]=item.displayValue??item.value;
    return map;
  }
  function standStat(stats,...keys){for(const key of keys){const v=stats[key.toLowerCase().replace(/[^a-z0-9]/g,'')];if(v!==undefined&&v!==null&&v!=='')return String(v);}return '—';}
  function parseStandings(data){
    const found=[];
    const walk=(group,parent='')=>{
      if(!group||typeof group!=='object')return;
      const label=String(group.name||group.displayName||parent||'');
      const entries=group.standings?.entries || group.entries;
      if(Array.isArray(entries)&&entries.length){
        // Group by explicit conference; preserve ESPN's ranking/order when seeds aren't supplied.
        const conference=/eastern|\beast\b/i.test(label)?'Eastern Conference':/western|\bwest\b/i.test(label)?'Western Conference':null;
        if(conference){
          const rows=[];
          for(const [position,entry] of entries.entries()){
            const t=entry.team||{},id=simpleId(t.id);if(!id)continue;
            const values=mappedStats(entry.stats),seed=statNumber(standStat(values,'playoffSeed','rank','overallRank'));
            const prior=teamDirectory.get(id)||{};
            const team={...prior,id,abbr:t.abbreviation||prior.abbr||'',name:t.displayName||t.name||prior.name||'NBA Team',short:t.shortDisplayName||t.name||prior.short||'',logo:safeLogo(t.logos?.[0]?.href||t.logo)||prior.logo||'',conference,values,rank:seed||position+1};
            teamDirectory.set(id,team);rows.push(team);
          }
          rows.sort((a,b)=>a.rank-b.rank);
          found.push({name:conference,entries:rows});
        }
      }
      for(const child of group.children||[])walk(child,label);
    };
    walk(data);
    // ESPN sometimes supplies the conference standings at the root or nested deeper.
    const output=[];
    for(const name of ['Eastern Conference','Western Conference']){
      const matching=found.filter(x=>x.name===name);
      if(matching.length)output.push(matching.sort((a,b)=>b.entries.length-a.entries.length)[0]);
    }
    if(!output.length)throw new Error('ESPN did not provide conference standings in the expected format');
    return output;
  }
  function standingsMetric(t,name,...fallback){return standStat(t.values||{},name,...fallback);}
  function teamLogoMarkup(team,cssClass=''){
    return team?.logo?`<img class="${cssClass}" src="${safe(team.logo)}" alt="${safe(team.name)} logo" loading="lazy" onerror="this.style.display='none'">`:`<strong class="cs-team-logo">${safe(team?.abbr||'NBA')}</strong>`;
  }
  function renderConference(group){
    const rows=group.entries.map((t,i)=>{
      const seed=i+1;
      const w=standingsMetric(t,'wins'),l=standingsMetric(t,'losses');
      const pct=standingsMetric(t,'winPercent','winningPercent');
      const gb=standingsMetric(t,'gamesBehind');
      const last=standingsMetric(t,'lastTenGames','lastTen','last10');
      const home=standingsMetric(t,'home','homeRecord'),away=standingsMetric(t,'road','away','roadRecord');
      const streak=standingsMetric(t,'streak');
      return `<tr class="${seed===7?'cs-standings-cutoff':seed===11?'cs-standings-playin':''}">
        <td class="cs-standings-rank">${seed}</td>
        <td><button class="cs-team-action" type="button" data-team-profile="${safe(t.id)}" title="Open ${safe(t.name)} profile">${teamLogoMarkup(t)}<span>${safe(t.name)}</span></button></td>
        <td><strong>${safe(w)}–${safe(l)}</strong></td><td>${safe(pct)}</td><td>${safe(gb)}</td><td>${safe(home)}</td><td>${safe(away)}</td><td>${safe(last)}</td><td>${safe(streak)}</td>
      </tr>`;
    }).join('');
    return `<section class="cs-conference"><div class="cs-conference-head"><h2>${safe(group.name)}</h2><span>${group.entries.length} teams</span></div><div class="cs-table-scroll"><table class="cs-standings-table"><thead><tr><th>#</th><th>Team</th><th>W–L</th><th>PCT</th><th>GB</th><th>HOME</th><th>AWAY</th><th>L10</th><th>STRK</th></tr></thead><tbody>${rows}</tbody></table></div><div class="cs-standings-legend"><span><b>1–6</b> · Direct playoff positions</span><span><b>7–10</b> · Play-in positions</span><span>Current order; not a playoff qualification guarantee</span></div></section>`;
  }
  function renderStandings(){
    $('standingsRefresh').disabled=!!standingsState.pending;
    const stamp=standingsState.at?`Updated ${new Date(standingsState.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`:'';
    $('standingsStatus').textContent=standingsState.error?(stamp?`ESPN unavailable · showing cached standings (${stamp}). ${standingsState.error}`:standingsState.error):(standingsState.pending?`Updating ESPN standings… ${stamp}`:stamp||'ESPN standings will load when available');
    if(!standingsState.groups.length){$('standingsContent').innerHTML=`<div class="cs-standings-empty">${standingsState.error?`${safe(standingsState.error)}. Try Refresh standings.`:'Loading Eastern and Western Conference standings from ESPN…'}</div>`;return;}
    $('standingsContent').innerHTML=`<div class="cs-conference-grid">${standingsState.groups.map(renderConference).join('')}</div>`;
  }
  async function fetchFeatureJson(url,priority=2){
    if(Date.now()<espnPoll.sharedUntil)throw new Error('ESPN is rate limiting requests. Please try again shortly');
    const controller=new AbortController();let timer;
    try{
      return await auditESPNJob({...dataLogRequestInfo(url),url,priority},async report=>{
        if(Date.now()<espnPoll.sharedUntil)throw new Error('ESPN rate limit cooldown in progress');
        timer=setTimeout(()=>controller.abort(),14000);
        const r=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
        report(r);
        if(!r.ok){
          if(r.status===429||(r.status===503&&r.headers.get('Retry-After'))){
            const delay=Math.max(retryAfterMs(r.headers.get('Retry-After')),exponentialBackoff(Math.max(1,standingsState.failures+1)));
            espnPoll.sharedUntil=Math.max(espnPoll.sharedUntil,Date.now()+delay);
          }
          throw new Error(`ESPN returned HTTP ${r.status}`);
        }
        return await r.json();
      });
    }finally{clearTimeout(timer);}
  }
  async function fetchStandings(force=false){
    if(standingsState.pending)return standingsState.pending;
    if(!force&&standingsState.at&&Date.now()-standingsState.at<STANDINGS_TTL_MS)return standingsState.groups;
    if(Date.now()<standingsState.retryAt&&!force)return standingsState.groups;
    standingsState.error='';
    const work=(async()=>{
      let standingsResponse=null;
      try{
        const json=await fetchFeatureJson(STANDINGS_API);
        standingsResponse=json;
        const groups=parseStandings(json);
        dataLogObserve(json,`standings:${statNumber(json?.season?.year)||profileSeasonYear()}`,()=>dataLogStandingsRecords(groups));
        standingsState.groups=groups;
        standingsState.season=statNumber(json?.season?.year)||statNumber(json?.season?.displayName?.slice(-4));
        standingsState.at=Date.now();standingsState.error='';standingsState.failures=0;standingsState.retryAt=0;
      }catch(err){
        if(standingsResponse)dataLogInvalid(standingsResponse,err);
        standingsState.failures++;
        standingsState.error=err?.message||'Unable to load standings';
        standingsState.retryAt=Math.max(Date.now()+exponentialBackoff(standingsState.failures),espnPoll.sharedUntil);
      }
      return standingsState.groups;
    })();
    standingsState.pending=work;renderStandings();
    try{return await work;}finally{
      if(standingsState.pending===work)standingsState.pending=null;
      if(mainView==='standings')renderStandings();
      if(profileState.id&&!$('teamProfileModal').hidden)renderTeamProfile();
    }
  }
  function setMainView(view){
    mainView=['scores','standings','leaders','log'].includes(view)?view:'scores';
    $('scoresView').hidden=mainView!=='scores';
    $('standingsView').hidden=mainView!=='standings';
    $('leadersView').hidden=mainView!=='leaders';
    $('dataLogView').hidden=mainView!=='log';
    for(const [name,id] of [['scores','csTabScores'],['standings','csTabStandings'],['leaders','csTabLeaders'],['log','csTabLog']]){
      const active=name===mainView;
      $(id).setAttribute('aria-selected',String(active));$(id).tabIndex=active?0:-1;
    }
    if(mainView==='standings'){renderStandings();fetchStandings();}
    if(mainView==='leaders'){renderLeaders();fetchLeaders();}
    if(mainView==='log')renderDataLog();
  }
  function updateGameCenterTeamLinks(){
    const g=state.games.find(game=>String(game.id)===viewerState.gameId),comps=g?.competitions?.[0]?.competitors||[];
    const html=comps.map(c=>{
      const id=simpleId(c.team?.id);if(!id)return '';
      return `<button type="button" class="cs-profile-link" data-team-profile="${safe(id)}" title="Open team profile">${safe(c.team?.abbreviation||c.team?.name||'Team')} ↗</button>`;
    }).join('');
    if($('gcTeamLinks').innerHTML!==html)$('gcTeamLinks').innerHTML=html;
  }
  function profileTeam(){
    const id=profileState.id;
    return teamDirectory.get(id)||{id,name:`NBA Team ${id}`,abbr:'NBA',values:{},logo:''};
  }
  function profileSeasonYear(){
    if(standingsState.season)return standingsState.season;
    const d=new Date();return d.getFullYear()+(d.getMonth()>=8?1:0);
  }
  async function fetchTeamData(kind,force=false){
    if(!profileState.id)return;
    const id=profileState.id,season=profileSeasonYear(),key=`${id}|${kind}|${kind==='schedule'?season:''}`;
    const cached=profileState.cache.get(key);
    if(!force&&cached?.data&&Date.now()-cached.at<TEAM_DETAILS_TTL_MS)return cached.data;
    if(!force&&cached?.error&&Date.now()-cached.at<30000)return cached.data;
    if(profileState.pending.has(key))return profileState.pending.get(key);
    const url=kind==='roster'?`${TEAM_API}/${id}/roster`:`${TEAM_API}/${id}/schedule?season=${season}&limit=100`;
    const request=(async()=>{
      let teamResponse=null;
      try{
        const data=await fetchFeatureJson(url);
        teamResponse=data;
        if(!data||typeof data!=='object')throw new Error('Unexpected team data');
        dataLogObserve(data,`team:${id}:${kind}:${kind==='schedule'?season:''}`,()=>dataLogTeamRecords(kind,data,id));
        profileState.cache.set(key,{at:Date.now(),data,error:''});
        return data;
      }catch(error){
        if(teamResponse)dataLogInvalid(teamResponse,error);
        profileState.cache.set(key,{at:Date.now(),data:cached?.data||null,error:error?.message||'Unable to reach ESPN'});
        return cached?.data||null;
      }
    })();
    profileState.pending.set(key,request);
    try{return await request;}finally{
      if(profileState.pending.get(key)===request)profileState.pending.delete(key);
      if(profileState.id===id&&!$('teamProfileModal').hidden)renderTeamProfile();
    }
  }
  function cachedTeamData(kind){
    const key=`${profileState.id}|${kind}|${kind==='schedule'?profileSeasonYear():''}`;
    return {key,entry:profileState.cache.get(key),loading:profileState.pending.has(key)};
  }
  function profileMetrics(team){
    const v=team.values||{};
    const record=standStat(v,'wins')!=='—'?`${standStat(v,'wins')}–${standStat(v,'losses')}`:(team.fallbackRecord||'—');
    const rank=team.conference?`${team.rank||'—'} / 15`:'—';
    const metrics=[['Record',record],['Conference rank',rank],['Last 10',standStat(v,'lastTenGames','lastTen','last10')],['Streak',standStat(v,'streak')]];
    return `<div class="cs-profile-metrics">${metrics.map(([label,value])=>`<div class="cs-profile-metric"><strong>${safe(value)}</strong><span>${safe(label)}</span></div>`).join('')}</div>`;
  }
  // ESPN's team schedule returns scores as either primitives or objects
  // (for example { value: 105, displayValue: "105" }). Never stringify the
  // object itself, which would display "[object Object]" in the schedule.
  function scheduleScoreNumber(score){
    for(let i=0;i<3&&score!==null&&typeof score==='object';i++){
      score=score.value??score.displayValue??score.score??score.total??null;
    }
    if(score===null||score===undefined||score==='')return null;
    if(typeof score==='string'&&!/^\d+(?:\.\d+)?$/.test(score.trim()))return null;
    const number=Number(score);
    return Number.isFinite(number)&&number>=0?number:null;
  }
  function parseTeamSchedule(payload,teamId){
    const events=Array.isArray(payload?.events)?payload.events:Array.isArray(payload?.schedule?.events)?payload.schedule.events:[];
    return events.map(event=>{
      const comp=event.competitions?.[0]||{},teams=comp.competitors||[];
      const ours=teams.find(c=>String(c.team?.id||c.id)===teamId),opp=teams.find(c=>String(c.team?.id||c.id)!==teamId);
      const date=new Date(event.date||comp.date||'');
      if(Number.isNaN(date.getTime()))return null;
      const state=event.status?.type?.state||comp.status?.type?.state||'';
      const complete=state==='post'||event.status?.type?.completed===true||comp.status?.type?.completed===true;
      const homeAway=ours?.homeAway||'unknown';
      const other=opp?.team?.shortDisplayName||opp?.team?.displayName||opp?.team?.abbreviation||event.shortName||event.name||'Opponent';
      const ourPoints=scheduleScoreNumber(ours?.score);
      const theirPoints=scheduleScoreNumber(opp?.score);
      const hasFinalScore=complete&&ourPoints!==null&&theirPoints!==null;
      const score=hasFinalScore?`${ourPoints}–${theirPoints}`:'';
      const won=hasFinalScore?(ourPoints===theirPoints?null:ourPoints>theirPoints):null;
      return {id:simpleId(event.id),date,complete,homeAway,other,score,won};
    }).filter(Boolean).sort((a,b)=>a.date-b.date);
  }
  function renderScheduleTable(games){
    if(!games.length)return '<p class="cs-profile-note">No games are listed for this section yet.</p>';
    return `<div class="cs-profile-table-scroll"><table class="cs-schedule-table"><thead><tr><th>Date</th><th>Opponent</th><th>Result / time</th><th>Game</th></tr></thead><tbody>${games.map(g=>{
      const date=g.date.toLocaleDateString(undefined,{month:'short',day:'numeric',weekday:'short'});
      const result=g.complete?`${g.won===true?'W':g.won===false?'L':'Final'} ${g.score||''}`:g.date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
      const local=!!g.id&&state.games.some(event=>String(event.id)===g.id);
      const link=g.id?`https://www.espn.com/nba/game?gameId=${g.id}`:'https://www.espn.com/nba/scoreboard';
      return `<tr><td>${safe(date)}</td><td>${g.homeAway==='away'?'@':'vs'} ${safe(g.other)}</td><td class="${g.won===true?'cs-result-win':g.won===false?'cs-result-loss':''}">${safe(result)}</td><td>${local?`<button type="button" class="cs-profile-link" data-profile-watch="${safe(g.id)}">View in Courtside</button>`:`<a href="${safe(link)}" class="cs-profile-action" target="_blank" rel="noopener noreferrer">Gamecast ↗</a>`}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function scheduleSection(overview=false){
    const {entry,loading}=cachedTeamData('schedule');
    if(!entry?.data)return `<p class="cs-profile-note">${loading?'Loading schedule from ESPN…':entry?.error?`${safe(entry.error)}. <button class="cs-profile-link" type="button" data-profile-retry="schedule">Retry schedule</button>`:'Loading team schedule…'}</p>`;
    const games=parseTeamSchedule(entry.data,profileState.id),now=new Date();
    const recent=games.filter(g=>g.complete).slice(-1*(overview?5:12)).reverse();
    const upcoming=games.filter(g=>!g.complete&&g.date>=new Date(now.getTime()-24*3600*1000)).slice(0,overview?5:15);
    return `<h3 class="cs-profile-subhead">Recent results</h3>${renderScheduleTable(recent)}<h3 class="cs-profile-subhead">Upcoming schedule</h3>${renderScheduleTable(upcoming)}`;
  }
  function rosterSection(){
    const {entry,loading}=cachedTeamData('roster');
    if(!entry?.data)return `<p class="cs-profile-note">${loading?'Loading roster from ESPN…':entry?.error?`${safe(entry.error)}. <button class="cs-profile-link" type="button" data-profile-retry="roster">Retry roster</button>`:'Loading team roster…'}</p>`;
    const source=entry.data.athletes||entry.data.players||[];
    const athletes=Array.isArray(source)?source.flatMap(group=>group?.items||group?.athletes||[group]).map(a=>a?.athlete||a).filter(Boolean):[];
    if(!athletes.length)return '<p class="cs-profile-note">No roster was included in ESPN’s response.</p>';
    athletes.sort((a,b)=>(statNumber(a.jersey)??99)-(statNumber(b.jersey)??99)||String(a.displayName||a.fullName||'').localeCompare(String(b.displayName||b.fullName||'')));
    return `<div class="cs-profile-table-scroll"><table class="cs-roster-table"><thead><tr><th>#</th><th>Player</th><th>Position</th><th>Height</th><th>Weight</th><th>Age</th></tr></thead><tbody>${athletes.map(a=>{
      const name=a.displayName||a.fullName||'Player',headshot=safeLogo(a.headshot?.href||a.headshot);
      return `<tr><td>${safe(a.jersey||'—')}</td><td><div class="cs-profile-player">${headshot?`<img src="${safe(headshot)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}${simpleId(a.id)?`<button type="button" class="cs-player-link" data-player-profile="${safe(simpleId(a.id))}" data-player-name="${safe(name)}" data-player-team="${safe(profileState.id)}" data-player-pos="${safe(a.position?.abbreviation||a.position?.displayName||'')}" data-player-jersey="${safe(a.jersey||'')}" data-player-headshot="${safe(headshot)}" data-player-height="${safe(a.displayHeight||'')}" data-player-weight="${safe(a.displayWeight||'')}" data-player-age="${safe(a.age??'')}">${safe(name)}</button>`:`<span>${safe(name)}</span>`}</div></td><td>${safe(a.position?.abbreviation||a.position?.displayName||'—')}</td><td>${safe(a.displayHeight||'—')}</td><td>${safe(a.displayWeight||'—')}</td><td>${safe(a.age??'—')}</td></tr>`;
    }).join('')}</tbody></table></div><p class="cs-profile-note">Roster is provided by ESPN and may change during the season.</p>`;
  }
  function renderTeamProfile(){
    if($('teamProfileModal').hidden||!profileState.id)return;
    const team=profileTeam();
    $('teamProfileTitle').textContent=team.name;
    $('teamProfileSubtitle').textContent=[team.conference,team.conference&&team.rank?`#${team.rank} in conference`:null,`2026–27 NBA`].filter(Boolean).join(' · ');
    $('teamProfileLogo').innerHTML=teamLogoMarkup(team,'cs-team-logo');
    for(const tab of $('teamProfileDialog').querySelectorAll('[data-profile-tab]')){
      const active=tab.dataset.profileTab===profileState.tab;
      tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
    }
    const panel=$('teamProfileContent'),scroll=panel.scrollTop;
    if(profileState.tab==='roster')panel.innerHTML=`<h3 class="cs-profile-subhead">${safe(team.name)} Roster</h3>${rosterSection()}`;
    else if(profileState.tab==='schedule')panel.innerHTML=scheduleSection();
    else panel.innerHTML=`${profileMetrics(team)}<p class="cs-profile-note">Season record and rankings come from ESPN's conference standings.</p>${scheduleSection(true)}`;
    panel.scrollTop=scroll;
  }
  function selectTeamProfileTab(tab){
    if(!['overview','roster','schedule'].includes(tab))return;
    profileState.tab=tab;$('teamProfileContent').scrollTop=0;
    renderTeamProfile();fetchTeamData(tab==='roster'?'roster':'schedule');
  }
  function openTeamProfile(id){
    id=simpleId(id);if(!id)return;
    profileState.previousFocus=document.activeElement;
    profileState.id=id;profileState.tab='overview';
    $('teamProfileModal').hidden=false;document.body.classList.add('team-profile-open');
    renderTeamProfile();$('teamProfileClose').focus();
    fetchTeamData('schedule');
    if(!standingsState.at)fetchStandings();
  }
  function closeTeamProfile(){
    if($('teamProfileModal').hidden)return;
    $('teamProfileModal').hidden=true;document.body.classList.remove('team-profile-open');
    profileState.id=null;
    const previous=profileState.previousFocus;
    if(previous?.isConnected)previous.focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{
    const team=event.target.closest('[data-team-profile]');
    if(team){event.preventDefault();openTeamProfile(team.dataset.teamProfile);return;}
    const watch=event.target.closest('[data-profile-watch]');
    if(watch){
      const id=watch.dataset.profileWatch;
      if(state.games.some(g=>String(g.id)===id)){
        closeTeamProfile();
        if($('viewer').hidden)openViewer(id);else changeViewerGame(id);
      }
    }
  });
  $('teamProfileClose').addEventListener('click',closeTeamProfile);
  $('teamProfileBackdrop').addEventListener('click',closeTeamProfile);
  $('teamProfileDialog').addEventListener('click',event=>{
    const button=event.target.closest('[data-profile-tab]');
    if(button){selectTeamProfileTab(button.dataset.profileTab);return;}
    const retry=event.target.closest('[data-profile-retry]');
    if(retry)fetchTeamData(retry.dataset.profileRetry,true);
  });
  // Capturing prevents the existing video viewer's Escape key handler from closing
  // the whole multiview when the team profile is the topmost dialog.
  document.addEventListener('keydown',event=>{
    if($('teamProfileModal').hidden)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();closeTeamProfile();return;
    }
    if(event.key!=='Tab')return;
    const focusable=Array.from($('teamProfileDialog').querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)'))
      .filter(el=>!el.hidden&&!el.closest('[hidden]'));
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  },true);
  $('csTabScores').addEventListener('click',()=>setMainView('scores'));
  $('csTabStandings').addEventListener('click',()=>setMainView('standings'));
  $('csTabLeaders').addEventListener('click',()=>setMainView('leaders'));
  $('csTabLog').addEventListener('click',()=>setMainView('log'));
  $('standingsRefresh').addEventListener('click',()=>fetchStandings(true));
  $('csTabScores').addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();setMainView('standings');$('csTabStandings').focus();}});
  $('csTabStandings').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();setMainView('scores');$('csTabScores').focus();}if(e.key==='ArrowRight'){e.preventDefault();setMainView('leaders');$('csTabLeaders').focus();}});
  $('csTabLeaders').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();setMainView('standings');$('csTabStandings').focus();}if(e.key==='ArrowRight'){e.preventDefault();setMainView('log');$('csTabLog').focus();}});
  $('csTabLog').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();setMainView('leaders');$('csTabLeaders').focus();}});

  $('scoreboard').addEventListener('click',e=>{
    const watch=e.target.closest('button[data-watch]');
    if(watch){openViewer(watch.dataset.watch);return;}
    const stats=e.target.closest('button[data-game]');
    if(stats){const id=stats.dataset.game;state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);render();return;}
    // Normal links/buttons remain independent of the game-card click target.
    if(e.target.closest('a,button,input,select,textarea'))return;
    const card=e.target.closest('article.game[data-game-id]');
    if(card)openViewer(card.dataset.gameId);
  });
  $('scoreboard').addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const card=e.target.closest('article.game[data-game-id]');
    if(e.target!==card)return;
    e.preventDefault();openViewer(card.dataset.gameId);
  });

$('viewerClose').addEventListener('click',closeViewer);
$('viewerBackdrop').addEventListener('click',closeViewer);
$('viewerRetry').addEventListener('click',()=>lookupViewerGame(true));
$('multiviewGrid').addEventListener('click',e=>{
  const button=e.target.closest('[data-focus-tile]');
  if(button)setActiveTile(Number(button.dataset.focusTile));
});
$('multiviewGrid').addEventListener('change',e=>{
  const game=e.target.closest('[data-slot-game]');
  if(game){changeViewerGame(game.value,Number(game.dataset.slotGame));return;}
  const source=e.target.closest('[data-slot-source]');
  if(source)changeViewerSource(source.value,Number(source.dataset.slotSource));
});
document.querySelectorAll('[data-layout]').forEach(button=>button.addEventListener('click',()=>setViewerLayout(Number(button.dataset.layout))));
$('tickerToggle').addEventListener('click',()=>{viewerState.tickerOpen=!viewerState.tickerOpen;paintViewer();});
$('theaterToggle').addEventListener('click',()=>{viewerState.theater=!viewerState.theater;paintViewer();});
$('statsToggle').addEventListener('click',()=>{viewerState.statsOpen=!viewerState.statsOpen;paintViewer();});
$('statsRefresh').addEventListener('click',()=>updateStatsSidebar(true));
$('statsSidebar').addEventListener('click',event=>{
  const tab=event.target.closest('button[data-bs-tab]');
  if(tab){setStatsTab(tab.dataset.bsTab);return;}
  const chartView=event.target.closest('button[data-cs-view]');
  if(chartView){setChartView(chartView.dataset.csView);return;}
  const shot=event.target.closest('[data-cs-shot]');
  if(shot){inspectShot(shot.dataset.csShot);return;}
  const team=event.target.closest('button[data-bs-team]');
  if(team){viewerState.boxTeam=team.dataset.bsTeam;renderStats(state.games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);return;}
  const sort=event.target.closest('button[data-bs-sort]');
  if(sort){
    if(viewerState.boxSort===sort.dataset.bsSort)viewerState.boxSortDesc=!viewerState.boxSortDesc;
    else{viewerState.boxSort=sort.dataset.bsSort;viewerState.boxSortDesc=viewerState.boxSort!=='name';}
    renderStats(state.games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
    return;
  }
  if(event.target.closest('#bsWideToggle')){
    viewerState.boxWide=!viewerState.boxWide;
    renderStats(state.games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
  }
});
$('statsSidebar').addEventListener('input',chartInput);
$('statsSidebar').addEventListener('change',chartInput);
$('statsSidebar').addEventListener('pointermove',inspectChartPointer);
$('statsSidebar').addEventListener('pointerdown',inspectChartPointer);
let chartResizeWidth=0,chartResizeFrame=0;
if(typeof ResizeObserver!=='undefined'){
  const chartResizeObserver=new ResizeObserver(entries=>{
    const width=entries[0]?.contentRect.width||0;
    if(Math.abs(width-chartResizeWidth)<1)return;
    chartResizeWidth=width;
    if(viewerState.statsTab!=='charts'||!viewerState.statsOpen||$('viewer').hidden)return;
    cancelAnimationFrame(chartResizeFrame);
    chartResizeFrame=requestAnimationFrame(()=>{
      if(viewerState.statsTab==='charts'&&viewerState.statsOpen&&!$('viewer').hidden)
        renderStats(state.games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
    });
  });
  chartResizeObserver.observe($('statsContent'));
}
$('statsSidebar').addEventListener('keydown',event=>{
  chartKeydown(event);
  const active=event.target.closest('[data-bs-tab]');
  if(!active||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();const tabs=['overview','box','team','charts'];
  const next=tabs[(tabs.indexOf(active.dataset.bsTab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
  setStatsTab(next);$('statsSidebar').querySelector(`[data-bs-tab="${next}"]`)?.focus();
});
function onTickerClick(e){
  const b=e.target.closest('button[data-ticker-game]');
  if(!b)return;
  if($('viewer').hidden)openViewer(b.dataset.tickerGame);
  else changeViewerGame(b.dataset.tickerGame);
}
$('scoreTicker').addEventListener('click',onTickerClick);
$('viewerTicker').addEventListener('click',onTickerClick);

  document.addEventListener('keydown',e=>{
    if($('viewer').hidden)return;
    if(e.key==='Escape'){e.preventDefault();closeViewer();}
    if(e.key==='Tab'){
      const focusables=Array.from($('viewerDialog').querySelectorAll('button:not(:disabled),a[href]:not([hidden]),select:not([disabled]),input:not([disabled])'))
        .filter(el=>!el.hidden&&!el.closest('[hidden]'));
      if(!focusables.length)return;
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  $('prevDay').addEventListener('click',()=>changeDay(-1));
  $('nextDay').addEventListener('click',()=>changeDay(1));
  $('todayBtn').addEventListener('click',()=>selectDay(today()));
  $('homeLink').addEventListener('click',e=>{e.preventDefault();setMainView('scores');selectDay(today());});
  $('datePicker').addEventListener('change',e=>{if(e.target.value)selectDay(e.target.value);});
  $('teamSearch').addEventListener('input',e=>{state.query=e.target.value;render();});
  $('liveOnly').addEventListener('change',e=>{state.liveOnly=e.target.checked;render();});
  $('refreshBtn').addEventListener('click',()=>fetchScores(true));
  // Settings events are registered near the end after leaderboard definitions.
  $('refreshSettingsToggle').addEventListener('click',()=>openAppSettings('data'));

  // Courtside 1.4: player profiles are on-demand and never modify stream slots.
  const PLAYER_API='https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes';
  const PLAYER_TTL_MS=15*60*1000;
  const playerState={id:null,tab:'overview',meta:{},previousFocus:null,fromTeam:false,fromTeamScroll:0,
    cache:new Map(),pending:new Map(),sort:'date',sortDesc:true,error:''};
  const playerValue=value=>{
    if(value===null||value===undefined||value==='')return '—';
    if(typeof value==='object')return String(value.displayValue??value.value??'—');
    return String(value);
  };
  const playerNumber=value=>{
    if(value===null||value===undefined)return null;
    const n=Number(typeof value==='object'?(value.value??value.displayValue):value);
    return Number.isFinite(n)?n:null;
  };
  const playerMetricAlias={
    gp:['gp','gamesplayed','games'],gs:['gs','gamesstarted'],min:['min','minutes','minutespergame','mpg'],
    pts:['pts','points','pointspergame','ppg'],reb:['reb','rebounds','totalrebounds','reboundspergame','rpg'],
    ast:['ast','assists','assistspergame','apg'],stl:['stl','steals','stealspergame'],
    blk:['blk','blocks','blockspergame'],to:['to','turnovers','tov','turnoverspergame'],
    fg:['fg','fieldgoals','fieldgoalsmade'],tp:['3pt','3p','3ptfg','3ptmade','threepointers'],
    ft:['ft','freethrows'],fgpct:['fg%','fgpct','fieldgoalpct','fieldgoalpercentage'],
    tppct:['3p%','3pt%','3ptpct','threepointpct','threepointfieldgoalpct'],
    ftpct:['ft%','ftpct','freethrowpct','freethrowpercentage']
  };
  const playerStatKey=raw=>{
    const str=String(raw||'').toLowerCase().replace(/[^a-z0-9%]/g,'');
    for(const [key,aliases] of Object.entries(playerMetricAlias))if(aliases.some(a=>a.replace(/[^a-z0-9%]/g,'')===str))return key;
    return null;
  };
  function playerStatsFromLabels(labels,values,base={}){
    const out={...base};
    if(!Array.isArray(labels)||!Array.isArray(values))return out;
    for(let i=0;i<labels.length;i++){
      const key=playerStatKey(labels[i]);
      if(key&&values[i]!==undefined&&values[i]!==null&&values[i]!=='')out[key]=playerValue(values[i]);
    }
    return out;
  }
  function extractPlayerStats(data){
    if(!data||typeof data!=='object')return {};
    const groups=[];
    const push=cat=>{if(cat&&typeof cat==='object')groups.push(cat);};
    if(Array.isArray(data.categories))data.categories.forEach(push);
    if(Array.isArray(data.statistics))data.statistics.forEach(push);
    if(Array.isArray(data.stats?.categories))data.stats.categories.forEach(push);
    for(const split of data.splits?.categories||[]){push(split);for(const item of split.statistics||[])push(item);}
    for(const split of data.splits?.statistics||[])push(split);
    for(const split of data.statistics?.splits||[])push(split);
    if(data.stats&&typeof data.stats==='object')push(data.stats);
    push(data);
    let best={},bestScore=-1;
    for(const group of groups){
      const labels=group.labels||group.displayNames||group.names||group.keys||[];
      const valueOptions=[group.averages,group.perGame,group.totals,group.stats,group.values,group.displayValues];
      if(Array.isArray(group.statistics)&&group.statistics.every(x=>x?.value!==undefined||x?.displayValue!==undefined)){
        const obj={};for(const x of group.statistics){const key=playerStatKey(x.name||x.abbreviation||x.label);if(key)obj[key]=playerValue(x.displayValue??x.value);}
        const score=Object.keys(obj).length;if(score>bestScore){best=obj;bestScore=score;}
      }
      for(const vals of valueOptions){
        let mapped={};
        if(Array.isArray(vals))mapped=playerStatsFromLabels(labels,vals);
        else if(vals&&typeof vals==='object')for(const [k,v] of Object.entries(vals)){const key=playerStatKey(k);if(key)mapped[key]=playerValue(v);}
        const score=Object.keys(mapped).length+(/per.game|average/i.test(String(group.name||group.displayName||''))?2:0);
        if(score>bestScore){best=mapped;bestScore=score;}
      }
    }
    // Some ESPN responses use season totals rather than averages.
    const gp=playerNumber(best.gp);
    for(const key of ['pts','reb','ast','stl','blk','to']){
      const n=playerNumber(best[key]);
      if(gp&&gp>0&&n!==null&&(key==='pts'?n>70:n>40))best[key]=String(Math.round(n/gp*10)/10);
    }
    return best;
  }
  function parsePlayerGameLog(data){
    if(!data||typeof data!=='object')return [];
    const metadata=new Map(),candidates=[];
    const events=data.events;
    if(Array.isArray(events)){for(const x of events)if(x?.id||x?.eventId)metadata.set(String(x.id||x.eventId),x);}
    else if(events&&typeof events==='object')for(const [id,x] of Object.entries(events))if(x&&typeof x==='object')metadata.set(String(x.id||x.eventId||id),x);
    const rootLabels=data.labels||data.displayNames||data.names||[];
    const add=(item,labels)=>{if(item&&typeof item==='object')candidates.push({item,labels});};
    if(Array.isArray(events))events.forEach(x=>add(x,rootLabels));
    for(const type of data.seasonTypes||[]){
      if(/preseason/i.test(String(type.displayName||type.name||'')))continue;
      for(const category of type.categories||[]){
        const labels=category.labels||category.names||rootLabels;
        for(const e of category.events||[])add(e,labels);
      }
      for(const e of type.events||[])add(e,rootLabels);
    }
    for(const category of data.categories||[]){for(const e of category.events||[])add(e,category.labels||rootLabels);}
    const season=profileSeasonYear(),games=new Map();
    for(const {item,labels} of candidates){
      const id=simpleId(item.eventId||item.id||item.event?.id);
      const meta=metadata.get(id)||item.event||{};
      const day=item.date||meta.date||meta.gameDate||'';
      // ESPN sometimes encodes a game date at 00:00 UTC as a date-only marker.
      // Preserve that calendar day instead of showing the preceding day in US time zones.
      const date=/^\d{4}-\d{2}-\d{2}T00:00(?::00)?(?:\.\d+)?Z$/.test(String(day))
        ?new Date(String(day).slice(0,10)+'T12:00:00'):new Date(day);
      if(Number.isNaN(date.getTime()))continue;
      const y=date.getFullYear(),mo=date.getMonth();
      if(!((y===season-1&&mo>=7)||(y===season&&mo<7)))continue;
      const raw=item.stats||item.statistics||item.values||[];
      let stats=playerStatsFromLabels(labels,raw);
      if(raw&&!Array.isArray(raw)&&typeof raw==='object')for(const [k,v] of Object.entries(raw)){
        const key=playerStatKey(k);if(key)stats[key]=playerValue(v);
      }
      for(const [k,v] of Object.entries(item)){
        const key=playerStatKey(k);if(key&&v!==undefined&&v!==null&&!stats[key])stats[key]=playerValue(v);
      }
      const opponent=item.opponent||meta.opponent||{},abbr=String(opponent.abbreviation||opponent.shortDisplayName||opponent.displayName||meta.shortName||'—');
      const result=String(item.gameResult||item.result||meta.gameResult||meta.result||'').replace(/\s+/g,' ').trim();
      const record={id,date,opponent:abbr,result,stats};
      const previous=games.get(id||day);
      if(!previous||Object.keys(previous.stats).length<Object.keys(stats).length)games.set(id||day,record);
    }
    return [...games.values()].sort((a,b)=>b.date-a.date);
  }
  const playerCacheKey=(kind,id=playerState.id)=>`${id}|${profileSeasonYear()}|${kind}`;
  function playerCached(kind){
    const key=playerCacheKey(kind),entry=playerState.cache.get(key);
    return {entry,loading:playerState.pending.has(key),key};
  }
  async function fetchPlayerKind(kind,force=false){
    if(!playerState.id||!['overview','stats','gamelog'].includes(kind))return null;
    const id=playerState.id,key=playerCacheKey(kind,id),cached=playerState.cache.get(key);
    if(!force&&cached?.data&&Date.now()-cached.at<PLAYER_TTL_MS)return cached.data;
    if(!force&&cached?.error&&Date.now()-cached.at<30000)return cached.data;
    if(playerState.pending.has(key))return playerState.pending.get(key);
    const url=`${PLAYER_API}/${id}/${kind}?season=${profileSeasonYear()}&seasontype=2`;
    const request=(async()=>{
      let playerResponse=null;
      try{
        const data=await fetchFeatureJson(url);
        playerResponse=data;
        if(!data||typeof data!=='object')throw new Error('Unexpected ESPN player response');
        dataLogObserve(data,`player:${id}:${kind}:${profileSeasonYear()}`,()=>dataLogPlayerRecords(kind,data,id));
        playerState.cache.set(key,{data,at:Date.now(),error:''});
        return data;
      }catch(error){
        if(playerResponse)dataLogInvalid(playerResponse,error);
        playerState.cache.set(key,{data:cached?.data||null,at:Date.now(),error:error?.message||'ESPN player data unavailable'});
        return cached?.data||null;
      }
    })();
    playerState.pending.set(key,request);
    try{return await request;}finally{
      if(playerState.pending.get(key)===request)playerState.pending.delete(key);
      if(playerState.id===id&&!$('playerProfileModal').hidden)renderPlayerProfile();
    }
  }
  function playerStatDisplay(stats,key){
    const v=stats[key];if(v===undefined||v===null||v==='')return '—';
    let n=playerNumber(v);
    if(n===null)return playerValue(v);
    if(['fgpct','tppct','ftpct'].includes(key)){
      if(n>=0&&n<=1)n*=100;
      return `${Math.round(n*10)/10}%`;
    }
    if(['gp','gs'].includes(key))return String(Math.round(n));
    return (Math.round(n*10)/10).toFixed(1);
  }
  function playerProfileMetrics(stats){
    const metrics=[['Points','pts'],['Rebounds','reb'],['Assists','ast'],['FG %','fgpct']];
    return `<div class="cs-player-profile-metrics">${metrics.map(([label,key])=>`<div class="cs-profile-metric"><strong>${safe(playerStatDisplay(stats,key))}</strong><span>${safe(label)}${key==='fgpct'?'':' / game'}</span></div>`).join('')}</div>`;
  }
  function playerDataStatus(kinds){
    const errors=kinds.map(kind=>({kind,...playerCached(kind)})).filter(c=>c.entry?.error);
    const waiting=kinds.some(k=>playerCached(k).loading);
    if(errors.length)return `<div class="cs-player-notice">Some ESPN player data could not be loaded. ${safe(errors[0].entry.error)}. <button class="cs-profile-action cs-player-profile-link" type="button" data-player-retry="${safe(errors[0].kind)}">Retry</button></div>`;
    return waiting?'<p class="cs-player-data-note">Loading current-season data from ESPN…</p>':'';
  }
  function playerGameLogTable(rows,compact=false){
    if(!rows.length)return '<p class="cs-player-data-note">No current-season game-by-game results were provided by ESPN.</p>';
    const sorted=[...rows].sort((a,b)=>{
      const key=playerState.sort;
      if(key==='date')return (a.date-b.date)*(playerState.sortDesc?-1:1);
      const av=playerNumber(a.stats[key]),bv=playerNumber(b.stats[key]);
      if(av===null)return bv===null?0:1;if(bv===null)return -1;
      return (av-bv)*(playerState.sortDesc?-1:1);
    });
    const show=compact?sorted.slice(0,5):sorted;
    const columns=[['date','Date'],['opponent','OPP'],['result','W/L'],['min','MIN'],['pts','PTS'],['reb','REB'],['ast','AST'],['fg','FG'],['tp','3PT']];
    const hdr=columns.map(([key,label])=>{
      const sortable=['date','min','pts','reb','ast'].includes(key);
      return `<th scope="col" ${sortable&&key===playerState.sort?`aria-sort="${playerState.sortDesc?'descending':'ascending'}"`:''}>${sortable?`<button type="button" data-player-sort="${key}">${label}${key===playerState.sort?(playerState.sortDesc?' ↓':' ↑'):''}</button>`:label}</th>`;
    }).join('');
    return `<div class="cs-profile-table-scroll"><table class="cs-player-stats-table"><thead><tr>${hdr}</tr></thead><tbody>${show.map(row=>{
      const date=row.date.toLocaleDateString(undefined,{month:'short',day:'numeric'});
      return `<tr><td>${row.id?`<button type="button" class="cs-player-profile-link" data-player-game="${safe(row.id)}" data-player-game-date="${safe(fmtDate(row.date))}" title="Open this game in Courtside">${safe(date)}</button>`:safe(date)}</td><td>${safe(row.opponent)}</td><td>${safe(row.result||'—')}</td>${['min','pts','reb','ast','fg','tp'].map(k=>`<td>${safe(row.stats[k]??'—')}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function playerSeasonTable(stats){
    const rows=[['Games played','gp'],['Games started','gs'],['Minutes / game','min'],['Points / game','pts'],['Rebounds / game','reb'],['Assists / game','ast'],['Steals / game','stl'],['Blocks / game','blk'],['Turnovers / game','to'],['Field goal %','fgpct'],['Three-point %','tppct'],['Free throw %','ftpct']];
    return `<div class="cs-profile-table-scroll"><table class="cs-player-stats-table"><thead><tr><th>${profileSeasonYear()-1}–${String(profileSeasonYear()).slice(-2)} regular season</th><th>Value</th></tr></thead><tbody>${rows.map(([label,key])=>`<tr><td>${safe(label)}</td><td>${safe(playerStatDisplay(stats,key))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderPlayerProfile(){
    if($('playerProfileModal').hidden||!playerState.id)return;
    const base=playerState.meta||{},overview=playerCached('overview').entry?.data;
    const athlete=overview?.athlete||overview?.player||overview?.header?.athlete||{};
    const name=base.name||athlete.displayName||athlete.fullName||`NBA Player ${playerState.id}`;
    $('playerProfileTitle').textContent=name;
    const teamId=simpleId(base.teamId||athlete.team?.id),team=teamDirectory.get(teamId);
    const teamName=team?.name||athlete.team?.displayName||athlete.team?.name||base.teamName||'NBA';
    const profilePos=base.pos||athlete.position?.abbreviation||athlete.position?.displayName||'';
    const jersey=base.jersey||athlete.jersey||'';
    const extra=[base.height||athlete.displayHeight,base.weight||athlete.displayWeight,base.age||athlete.age&&`${athlete.age} years old`].filter(Boolean).join(' · ');
    $('playerProfileSubtitle').textContent=[teamName,profilePos,jersey?`#${jersey}`:null,`${profileSeasonYear()-1}–${String(profileSeasonYear()).slice(-2)} season`,extra].filter(Boolean).join(' · ');
    const headshot=safeLogo(base.headshot||athlete.headshot?.href||athlete.headshot||'')||`https://a.espncdn.com/i/headshots/nba/players/full/${playerState.id}.png`;
    $('playerProfilePortrait').innerHTML=`<span aria-hidden="true">NBA</span><img class="cs-player-headshot" src="${safe(headshot)}" alt="" onerror="this.style.display='none'">`;
    $('playerBackTeam').hidden=!playerState.fromTeam;
    for(const tab of $('playerProfileDialog').querySelectorAll('[data-player-tab]')){
      const active=tab.dataset.playerTab===playerState.tab;
      tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
      if(active)$('playerProfileContent').setAttribute('aria-labelledby',tab.id);
    }
    const statsData=playerCached('stats').entry?.data;
    const logData=playerCached('gamelog').entry?.data;
    const stats=extractPlayerStats(statsData),rows=parsePlayerGameLog(logData);
    const panel=$('playerProfileContent'),scroll=panel.scrollTop;
    let output='';
    if(playerState.tab==='overview'){
      output=`${playerDataStatus(['stats','gamelog'])}<h3 class="cs-profile-subhead">Season averages</h3>${playerProfileMetrics(stats)}<h3 class="cs-profile-subhead">Recent performances</h3>${playerGameLogTable(rows,true)}<p class="cs-player-data-note">Only the current NBA regular season is shown. Select a date to open that game in Courtside.</p>`;
    }else if(playerState.tab==='season'){
      output=`${playerDataStatus(['stats'])}<h3 class="cs-profile-subhead">Current-season statistics</h3><p class="cs-player-season-caption">Stats provided by ESPN. Unavailable metrics display as a dash rather than zero.</p>${playerSeasonTable(stats)}`;
    }else{
      output=`${playerDataStatus(['gamelog'])}<h3 class="cs-profile-subhead">${profileSeasonYear()-1}–${String(profileSeasonYear()).slice(-2)} game log</h3>${playerGameLogTable(rows)}<p class="cs-player-data-note">Click a date to open the corresponding game's Courtside Game Center.</p>`;
    }
    panel.innerHTML=output;panel.scrollTop=scroll;
  }
  function openPlayerProfile(button){
    const id=simpleId(button?.dataset.playerProfile);if(!id)return;
    const fromTeam=!$('teamProfileModal').hidden;
    playerState.previousFocus=document.activeElement;
    playerState.fromTeam=fromTeam;
    playerState.fromTeamScroll=fromTeam?$('teamProfileContent').scrollTop:0;
    playerState.id=id;playerState.tab='overview';playerState.sort='date';playerState.sortDesc=true;
    playerState.meta={name:button.dataset.playerName||'',teamId:button.dataset.playerTeam||'',
      teamName:button.dataset.playerTeamName||'',pos:button.dataset.playerPos||'',jersey:button.dataset.playerJersey||'',
      headshot:button.dataset.playerHeadshot||'',height:button.dataset.playerHeight||'',weight:button.dataset.playerWeight||'',age:button.dataset.playerAge||''};
    if(fromTeam)$('teamProfileModal').hidden=true;
    $('playerProfileModal').hidden=false;document.body.classList.add('team-profile-open');
    renderPlayerProfile();$('playerProfileClose').focus();
    for(const kind of ['overview','stats','gamelog'])fetchPlayerKind(kind);
  }
  function closePlayerProfile(returnToTeam=true){
    if($('playerProfileModal').hidden)return;
    $('playerProfileModal').hidden=true;
    playerState.id=null;
    const focus=playerState.previousFocus;
    if(playerState.fromTeam&&returnToTeam){
      $('teamProfileModal').hidden=false;
      $('teamProfileContent').scrollTop=playerState.fromTeamScroll;
      (focus?.isConnected?focus:$('teamProfileClose')).focus({preventScroll:true});
    }else{
      document.body.classList.remove('team-profile-open');
      if(focus?.isConnected)focus.focus({preventScroll:true});
      else if(!$('viewer').hidden)$('viewerDialog').focus({preventScroll:true});
    }
    playerState.fromTeam=false;
  }
  async function playerOpenGame(gameId,day){
    gameId=simpleId(gameId);
    if(!gameId||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day))return;
    const fromTeam=playerState.fromTeam;
    closePlayerProfile(false);
    if(fromTeam){$('teamProfileModal').hidden=false;closeTeamProfile();}
    setMainView('scores');
    if(state.date!==day){state.date=day;$('datePicker').value=day;state.nextAt=0;await fetchScores(true);}
    if(!state.games.some(g=>String(g.id)===gameId)){
      state.error='That game could not be found in ESPN’s selected-day scoreboard. Try its ESPN Gamecast.';
      render();return;
    }
    if($('viewer').hidden)openViewer(gameId);else changeViewerGame(gameId);
    viewerState.statsTab='box';viewerState.statsOpen=true;
    paintViewer();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-player-profile]');
    if(button){event.preventDefault();openPlayerProfile(button);return;}
    const game=event.target.closest('[data-player-game]');
    if(game){event.preventDefault();playerOpenGame(game.dataset.playerGame,game.dataset.playerGameDate);return;}
  });
  $('playerProfileClose').addEventListener('click',()=>closePlayerProfile());
  $('playerProfileBackdrop').addEventListener('click',()=>closePlayerProfile());
  $('playerBackTeam').addEventListener('click',()=>closePlayerProfile());
  $('playerProfileDialog').addEventListener('click',event=>{
    const tab=event.target.closest('[data-player-tab]');
    if(tab){playerState.tab=tab.dataset.playerTab;$('playerProfileContent').scrollTop=0;renderPlayerProfile();return;}
    const sort=event.target.closest('[data-player-sort]');
    if(sort){const key=sort.dataset.playerSort;playerState.sortDesc=playerState.sort===key?!playerState.sortDesc:true;
      playerState.sort=key;renderPlayerProfile();return;}
    const retry=event.target.closest('[data-player-retry]');
    if(retry){fetchPlayerKind(retry.dataset.playerRetry,true);return;}
  });
  document.addEventListener('keydown',event=>{
    if($('playerProfileModal').hidden)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();closePlayerProfile();return;
    }
    if(event.key!=='Tab')return;
    const focusable=Array.from($('playerProfileDialog').querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)'))
      .filter(el=>!el.hidden&&!el.closest('[hidden]'));
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  },true);


  // ========================================================================
  // Courtside 1.5.4 release notes: persisted Live Only startup and Game Center
  // defaults (tab, 1/2/4-screen layout, sidebar, viewer ticker). The settings
  // are only applied when the relevant page/viewer starts, preserving any
  // temporary viewer adjustments and active streams.
  // Courtside 1.5.3 release notes: app-wide settings dialog, persisted startup/ticker/leaderboard preferences,
  // integrated ESPN refresh diagnostics; no changes to polling frequencies or stream behavior.
  // Courtside 1.5.2 release notes: draggable / touch-scrollable dual tickers,
  // accessible glossary tooltips for statistical table headings; preserves
  // 1.5.1 scheduler and incremental rendering.
  // Courtside 1.5.1: full-body request accounting, high-priority
  // dispatch past slow leaderboard pages, stable ticker animation, incremental
  // scoreboard DOM updates, and focus-preserving leaderboard rendering.
  // Courtside 1.5 release notes: complete ESPN-paginated NBA statistical
  // leaderboard, six local categories, local sorting/filtering/ties, lazy load,
  // 30-minute cache, and priority-aware requests. Stream slots are unchanged.
  // ========================================================================
  const LEADERS_API='https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete';
  const LEADERS_TTL_MS=30*60*1000;
  const NBA_TEAMS=[
    ['1','ATL','Atlanta Hawks'],['2','BOS','Boston Celtics'],['17','BKN','Brooklyn Nets'],
    ['30','CHA','Charlotte Hornets'],['4','CHI','Chicago Bulls'],['5','CLE','Cleveland Cavaliers'],
    ['6','DAL','Dallas Mavericks'],['7','DEN','Denver Nuggets'],['8','DET','Detroit Pistons'],
    ['9','GS','Golden State Warriors'],['10','HOU','Houston Rockets'],['11','IND','Indiana Pacers'],
    ['12','LAC','LA Clippers'],['13','LAL','Los Angeles Lakers'],['29','MEM','Memphis Grizzlies'],
    ['14','MIA','Miami Heat'],['15','MIL','Milwaukee Bucks'],['16','MIN','Minnesota Timberwolves'],
    ['3','NO','New Orleans Pelicans'],['18','NY','New York Knicks'],['25','OKC','Oklahoma City Thunder'],
    ['19','ORL','Orlando Magic'],['20','PHI','Philadelphia 76ers'],['21','PHX','Phoenix Suns'],
    ['22','POR','Portland Trail Blazers'],['23','SAC','Sacramento Kings'],['24','SA','San Antonio Spurs'],
    ['28','TOR','Toronto Raptors'],['26','UTAH','Utah Jazz'],['27','WSH','Washington Wizards']
  ];
  const leaderTeamMap=new Map(NBA_TEAMS.map(([id,abbr,name])=>[id,{id,abbr,name}]));
  const leaderStats={
    gp:{label:'GP',aliases:['gamesPlayed','games','gp'],groups:['general','offensive','defensive']},
    mpg:{label:'MPG',aliases:['avgMinutes','minutesPerGame','avgMinutesPlayed','avgMin'],groups:['general','offensive']},
    minutes:{label:'MIN',aliases:['minutes','totalMinutes','minutesPlayed'],groups:['general','offensive']},
    ppg:{label:'PPG',aliases:['avgPoints','pointsPerGame'],groups:['offensive','general']},
    points:{label:'PTS',aliases:['points','totalPoints'],groups:['offensive','general']},
    fgm:{label:'FGM/G',aliases:['avgFieldGoalsMade','fieldGoalsMadePerGame'],groups:['offensive','shooting']},
    fga:{label:'FGA/G',aliases:['avgFieldGoalsAttempted','fieldGoalsAttemptedPerGame'],groups:['offensive','shooting']},
    fgPct:{label:'FG%',aliases:['fieldGoalPct','fieldGoalPercentage','fieldGoalsPct','fgPct'],groups:['offensive','shooting']},
    threeMade:{label:'3PM/G',aliases:['avgThreePointFieldGoalsMade','avgThreePointMade','threePointFieldGoalsMadePerGame'],groups:['offensive','shooting']},
    threeAtt:{label:'3PA/G',aliases:['avgThreePointFieldGoalsAttempted','avgThreePointAttempted','threePointFieldGoalsAttemptedPerGame'],groups:['offensive','shooting']},
    threePct:{label:'3P%',aliases:['threePointFieldGoalPct','threePointPct','threePointFieldGoalPercentage','threePointFieldGoalsPct','threePointShootingPct'],groups:['offensive','shooting']},
    ftMade:{label:'FTM/G',aliases:['avgFreeThrowsMade','freeThrowsMadePerGame'],groups:['offensive','shooting']},
    ftAtt:{label:'FTA/G',aliases:['avgFreeThrowsAttempted','freeThrowsAttemptedPerGame'],groups:['offensive','shooting']},
    ftPct:{label:'FT%',aliases:['freeThrowPct','freeThrowPercentage','freeThrowsPct'],groups:['offensive','shooting']},
    apg:{label:'APG',aliases:['avgAssists','assistsPerGame'],groups:['offensive','general']},
    assists:{label:'AST',aliases:['assists','totalAssists'],groups:['offensive','general']},
    topg:{label:'TOPG',aliases:['avgTurnovers','turnoversPerGame'],groups:['offensive','general']},
    turnovers:{label:'TO',aliases:['turnovers','totalTurnovers'],groups:['offensive','general']},
    rpg:{label:'RPG',aliases:['avgRebounds','reboundsPerGame'],groups:['general','offensive','rebounding','defensive']},
    rebounds:{label:'REB',aliases:['rebounds','totalRebounds'],groups:['general','offensive','rebounding','defensive']},
    dd:{label:'DD',aliases:['doubleDoubles','doubleDouble'],groups:['general','offensive']},
    td:{label:'TD',aliases:['tripleDoubles','tripleDouble'],groups:['general','offensive']},
    spg:{label:'SPG',aliases:['avgSteals','stealsPerGame'],groups:['defensive','general']},
    bpg:{label:'BPG',aliases:['avgBlocks','blocksPerGame','avgBlockedShots'],groups:['defensive','general']},
    steals:{label:'STL',aliases:['steals','totalSteals'],groups:['defensive','general']},
    blocks:{label:'BLK',aliases:['blocks','totalBlocks','blockedShots'],groups:['defensive','general']},
    pfg:{label:'PF/G',aliases:['avgFouls','avgPersonalFouls','personalFoulsPerGame'],groups:['general','defensive']},
    astto:{label:'AST/TO',aliases:[],groups:[]}
  };
  const leaderCategorySpec={
    scoring:{label:'Scoring',columns:['gp','mpg','ppg','points','fgm','fga'],options:['ppg','points','fgm','fga']},
    shooting:{label:'Shooting',columns:['gp','fgPct','fga','threeMade','threeAtt','threePct','ftPct','ftMade'],options:['threeMade','fgPct','threePct','ftPct','threeAtt','ftMade']},
    playmaking:{label:'Playmaking',columns:['gp','apg','topg','assists','turnovers','astto'],options:['apg','assists','topg','astto']},
    rebounding:{label:'Rebounding',columns:['gp','rpg','rebounds','dd','td'],options:['rpg','rebounds','dd','td']},
    defense:{label:'Defense',columns:['gp','spg','bpg','steals','blocks'],options:['spg','bpg','steals','blocks']},
    general:{label:'General',columns:['gp','mpg','minutes','pfg','dd','td'],options:['mpg','gp','minutes','pfg','dd','td']}
  };
  const leaderState={
    players:[],at:0,season:0,error:'',loading:false,pending:null,progress:'Not loaded',failures:0,
    category:settingsPrefs.leadersCategory,metric:({scoring:'ppg',shooting:'threeMade',playmaking:'apg',rebounding:'rpg',defense:'spg',general:'mpg'})[settingsPrefs.leadersCategory],desc:true,team:'all',position:'all',games:5,minutes:0,gamesCustom:false,minutesCustom:false,
    volume:'auto',volumeCustom:2,query:'',rows:settingsPrefs.leadersRows,page:1,sortKey:'ppg',dataCount:0,
    verifiedGroups:new Set(),missingMetrics:[],missingTeamCount:0,lastScroll:0
  };
  const leaderClean=k=>String(k||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  function leaderNumeric(value){
    if(value===null||value===undefined||value===''||value==='—'||value==='-')return null;
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    const s=String(value).trim().replace(/,/g,'');
    if(/^\d+:\d{2}$/.test(s)){const [m,sec]=s.split(':').map(Number);return m+sec/60;}
    const n=Number(s.endsWith('%')?s.slice(0,-1):s);
    return Number.isFinite(n)?n:null;
  }
  function leaderStatObject(row,categories){
    const result={};
    const categoryNames=new Map((categories||[]).map(c=>[String(c.name||'').toLowerCase(),c.names||[]]));
    for(const block of row.categories||[]){
      const group=String(block.name||'').toLowerCase();
      if(!group)continue;
      const names=categoryNames.get(group)||block.names||[];
      const vals=Array.isArray(block.values)&&block.values.length?block.values:block.totals||[];
      if(Array.isArray(vals)){
        for(let i=0;i<Math.min(names.length,vals.length);i++){
          const key=leaderClean(names[i]);if(!key)continue;
          result[`${group}.${key}`]=leaderNumeric(vals[i]);
        }
      }else if(vals&&typeof vals==='object'){
        for(const [name,value] of Object.entries(vals))result[`${group}.${leaderClean(name)}`]=leaderNumeric(value);
      }
    }
    return result;
  }
  function leaderExtract(raw,stat){
    const spec=leaderStats[stat];if(!spec)return null;
    for(const group of spec.groups)for(const alias of spec.aliases){
      const key=`${group}.${leaderClean(alias)}`;
      if(Object.hasOwn(raw,key)&&raw[key]!==null)return raw[key];
    }
    return null;
  }
  function leaderNormalize(aw,categories){
    const a=aw?.athlete||{},id=simpleId(a.id),name=String(a.displayName||a.fullName||'').trim();
    if(!id||!name)throw new Error('ESPN supplied a leaderboard entry without a usable athlete ID or name.');
    const tid=simpleId(a.teamId||a.team?.id);
    const known=leaderTeamMap.get(tid),teamFromDirectory=teamDirectory.get(tid);
    const teamName=teamFromDirectory?.name||known?.name||a.teamName||a.team?.displayName||'';
    const teamAbbr=teamFromDirectory?.abbr||known?.abbr||a.team?.abbreviation||'';
    const pos=String(a.position?.abbreviation||a.position?.name||a.position||'').toUpperCase();
    const logos=Array.isArray(a.teamLogos)?a.teamLogos:[];
    const raw=leaderStatObject(aw,categories);
    const v={};for(const key of Object.keys(leaderStats))if(key!=='astto')v[key]=leaderExtract(raw,key);
    // Convert per-game stats only from exact season totals when ESPN lacks the average.
    const gp=v.gp;
    const derived={ppg:'points',apg:'assists',rpg:'rebounds',topg:'turnovers',spg:'steals',bpg:'blocks',mpg:'minutes'};
    for(const [avg,total] of Object.entries(derived))if(v[avg]===null&&gp>0&&v[total]!==null)v[avg]=v[total]/gp;
    for(const [avg,total] of [['fgm','fieldGoalsMade'],['fga','fieldGoalsAttempted'],['threeMade','threePointFieldGoalsMade'],['threeAtt','threePointFieldGoalsAttempted'],['ftMade','freeThrowsMade'],['ftAtt','freeThrowsAttempted']]){
      if(v[avg]===null&&gp>0){
        for(const group of ['offensive','shooting']){
          const n=raw[`${group}.${leaderClean(total)}`];
          if(n!==undefined&&n!==null){v[avg]=n/gp;break;}
        }
      }
    }
    for(const k of ['fgPct','threePct','ftPct'])if(v[k]!==null&&v[k]>=0&&v[k]<=1)v[k]*=100;
    if(v.astto===undefined)v.astto=(v.turnovers!==null&&v.turnovers>0&&v.assists!==null)?v.assists/v.turnovers:null;
    return {id,name,teamId:tid,teamName,teamAbbr,pos,jersey:a.jersey||'',
      headshot:safeLogo(a.headshot?.href||a.headshot)||`https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`,
      teamLogo:safeLogo(logos[0]?.href||a.team?.logo)||'',raw,v};
  }
  function leaderPagePayload(json,requestedPage,season){
    if(!json||!Array.isArray(json.athletes)||!Array.isArray(json.categories))throw new Error('Unexpected ESPN leaderboard response (athletes/categories missing).');
    const pg=json.pagination||{};
    const count=leaderNumeric(pg.count),pages=leaderNumeric(pg.pages),page=leaderNumeric(pg.page);
    if(!Number.isInteger(count)||count<1||!Number.isInteger(pages)||pages<1||pages>100||page!==requestedPage)
      throw new Error('ESPN did not return valid pagination metadata; cannot prove rankings are complete.');
    const served=leaderNumeric(json.currentSeason?.year);
    if(served!==season)throw new Error(`ESPN served season ${served??'unknown'}, expected ${season}. Rankings withheld to avoid mixing seasons.`);
    const phase=json.currentSeason?.type;
    const phaseId=leaderNumeric(typeof phase==='object'?phase?.id:phase);
    if(phaseId!==null&&phaseId!==2)throw new Error(`ESPN served season type ${phaseId} instead of regular season (2).`);
    if(json.athletes.length===0)throw new Error('ESPN returned an empty page, so the league dataset is incomplete.');
    return {count,pages,athletes:json.athletes.map(row=>leaderNormalize(row,json.categories))};
  }
  async function fetchLeaders(force=false){
    if(leaderState.pending)return leaderState.pending;
    const season=profileSeasonYear();
    if(!force&&leaderState.at&&leaderState.season===season&&Date.now()-leaderState.at<LEADERS_TTL_MS)return leaderState.players;
    if(document.hidden)return leaderState.players;
    leaderState.loading=true;leaderState.error='';leaderState.progress='Connecting to ESPN...';renderLeaders();
    const task=(async()=>{
      let lastInvalidResponse=null;
      try{
        // Ask for a large first page, but trust the returned pagination, not our requested limit.
        // The default category is intentionally unfiltered: ESPN documents that it includes all stat groups.
        const all=[];let count=0,pages=0,lastLeadersJson=null;
        for(let n=1;n<=100;n++){
          const url=`${LEADERS_API}?season=${season}&seasontype=2&limit=500&page=${n}`;
          const json=await fetchFeatureJson(url,3);
          lastLeadersJson=json;lastInvalidResponse=json;
          const result=leaderPagePayload(json,n,season);
          lastInvalidResponse=null;
          if(n===1){count=result.count;pages=result.pages;}
          else if(result.count!==count||result.pages!==pages)throw new Error('ESPN pagination changed while loading; dataset not published.');
          all.push(...result.athletes);
          leaderState.progress=`Loading ESPN pages: ${n}/${pages} · ${all.length}/${count} player entries`;
          if(mainView==='leaders')renderLeaders();
          if(n===pages)break;
        }
        // Final aggregate checks can invalidate the last page when incomplete.
        lastInvalidResponse=lastLeadersJson;
        // Exact count and ESPN ID uniqueness are required. No partial replacement.
        const players=new Map();
        for(const p of all){if(players.has(p.id))throw new Error(`Duplicate ESPN athlete ${p.id} across pages.`);players.set(p.id,p);}
        if(all.length!==count||players.size!==count)throw new Error(`ESPN returned ${all.length} unique entries but advertised ${count}.`);
        const values=[...players.values()];
        // Require the core population and at least one numerical value in each principal field.
        for(const key of ['gp','ppg','rpg','apg','spg','bpg','fgPct','threePct','ftPct','mpg']){
          if(!values.some(p=>p.v[key]!==null))throw new Error(`ESPN omitted ${leaderStats[key].label}; the selected season cannot support complete six-category rankings.`);
        }
        // Only compare complete, validated leaderboard snapshots, never individual pages.
        dataLogObserve(lastLeadersJson,`leaders:${season}`,()=>dataLogLeadersRecords(values));
        // Only swap in the new data after all validation succeeds.
        for(const p of values)if(p.teamId){
          const prior=teamDirectory.get(p.teamId)||{};
          teamDirectory.set(p.teamId,{...prior,id:p.teamId,name:prior.name||p.teamName,short:prior.short||p.teamName,abbr:prior.abbr||p.teamAbbr,logo:prior.logo||p.teamLogo});
        }
        leaderState.missingMetrics=Object.keys(leaderStats).filter(k=>k!=='astto'&&!values.some(p=>p.v[k]!==null));
        leaderState.missingTeamCount=values.filter(p=>!p.teamId).length;
        leaderState.players=values;leaderState.dataCount=count;leaderState.at=Date.now();leaderState.season=season;
        leaderState.error='';leaderState.failures=0;leaderState.page=1;
        leaderState.progress=`All ${count} ESPN-listed player entries loaded · ${pages} API page${pages===1?'':'s'}.`;
        return values;
      }catch(error){
        if(lastInvalidResponse)dataLogInvalid(lastInvalidResponse,error);
        leaderState.failures++;
        const message=String(error?.message||'Unknown ESPN error');
        leaderState.error=/Failed to fetch|NetworkError|Load failed/i.test(message)
          ?'The ESPN leaderboard request was blocked or failed. Firefox file:// CORS compatibility could not be confirmed. '+message
          :message;
        leaderState.progress='ESPN leaderboard refresh failed.';
        return leaderState.players;
      }finally{leaderState.loading=false;if(mainView==='leaders')renderLeaders();}
    })();
    leaderState.pending=task;
    try{return await task;}finally{if(leaderState.pending===task)leaderState.pending=null;if(mainView==='leaders')renderLeaders();}
  }
  function leaderVolumeMinimum(){
    const key=leaderState.metric;
    const min={fgPct:5,threePct:2,ftPct:2}[key];
    if(min===undefined)return {on:false,min:0,attempt:null};
    const mode=leaderState.volume;
    return {on:mode!=='off',min:mode==='auto'?min:mode==='custom'?leaderState.volumeCustom:Number(mode),attempt:{fgPct:'fga',threePct:'threeAtt',ftPct:'ftAtt'}[key]};
  }
  function leaderMetricValue(p,key){return p?.v?.[key]??null;}
  function leaderFiltered(){
    const s=leaderState,volume=leaderVolumeMinimum(),g=s.games,m=s.minutes;
    const pool=s.players.filter(p=>{
      if(s.team!=='all'&&p.teamId!==s.team)return false;
      if(s.position!=='all'&&!p.pos.includes(s.position))return false;
      if(!(p.v.gp!==null&&p.v.gp>=g))return false;
      if(m>0&&!(p.v.mpg!==null&&p.v.mpg>=m))return false;
      if(volume.on&&!(p.v[volume.attempt]!==null&&p.v[volume.attempt]>=volume.min))return false;
      return true;
    });
    // Missing values are always last, regardless of ascending/descending order.
    pool.sort((a,b)=>{
      const x=leaderMetricValue(a,s.metric),y=leaderMetricValue(b,s.metric);
      if(x===null&&y===null)return a.name.localeCompare(b.name);
      if(x===null)return 1;if(y===null)return -1;
      if(x!==y)return (s.desc?y-x:x-y);
      return a.name.localeCompare(b.name);
    });
    let rank=0,lastValue=null,seen=0;
    const ranked=pool.map(p=>{
      seen++;const v=leaderMetricValue(p,s.metric);
      if(v===null)return {...p,rank:null};
      if(lastValue===null||Math.abs(v-lastValue)>1e-9)rank=seen;
      lastValue=v;
      return {...p,rank};
    });
    const q=leaderClean(s.query);
    return {ranked,visible:q?ranked.filter(p=>leaderClean(p.name).includes(q)):ranked};
  }
  function leaderFormat(p,key){
    const n=leaderMetricValue(p,key);if(n===null)return '—';
    if(['gp','points','assists','turnovers','rebounds','dd','td','steals','blocks','minutes'].includes(key))return Math.round(n).toLocaleString();
    if(['fgPct','threePct','ftPct'].includes(key))return n.toFixed(1)+'%';
    return n.toFixed(key==='astto'?2:1);
  }
  // Static controls are mounted once. Refreshes update only the selected state,
  // preserving focused buttons and the caret while typing search/custom values.
  let leaderControlsInitialized=false,leaderControlsCategory=null;
  function leaderSyncSelect(id,value){
    const el=$(id),next=String(value);
    if(el.value!==next && document.activeElement!==el)el.value=next;
  }
  function leaderRenderControls(){
    const s=leaderState,spec=leaderCategorySpec[s.category];
    $('leadersSeasonHeading').textContent=`${profileSeasonYear()-1}–${String(profileSeasonYear()).slice(-2)} · NBA REGULAR SEASON`;
    if(!leaderControlsInitialized){
      $('leadersCategories').innerHTML=Object.entries(leaderCategorySpec).map(([key,c])=>`<button class="cs-leader-cat" type="button" data-leader-category="${key}">${safe(c.label)}</button>`).join('');
      $('leadersTeam').innerHTML='<option value="all">All 30 teams</option>'+NBA_TEAMS.slice().sort((a,b)=>a[2].localeCompare(b[2])).map(([id,abbr,name])=>`<option value="${id}">${safe(name)}</option>`).join('');
      leaderControlsInitialized=true;
    }
    for(const button of $('leadersCategories').querySelectorAll('[data-leader-category]'))
      button.setAttribute('aria-pressed',String(button.dataset.leaderCategory===s.category));
    if(leaderControlsCategory!==s.category){
      $('leadersMetric').innerHTML=[...new Set([...spec.options,...spec.columns])].map(k=>`<option value="${k}">${safe(leaderStats[k].label)}</option>`).join('');
      leaderControlsCategory=s.category;
    }
    leaderSyncSelect('leadersMetric',s.metric);
    leaderSyncSelect('leadersTeam',s.team);
    leaderSyncSelect('leadersPosition',s.position);
    leaderSyncSelect('leadersVolume',s.volume);
    $('leadersVolumeWrap').hidden=!['fgPct','threePct','ftPct'].includes(s.metric);
    $('leadersVolumeCustomWrap').hidden=$('leadersVolumeWrap').hidden||s.volume!=='custom';
    leaderSyncSelect('leadersGames',!s.gamesCustom&&[0,5,10,15,20].includes(s.games)?s.games:'custom');
    $('leadersGamesCustomWrap').hidden=$('leadersGames').value!=='custom';
    leaderSyncSelect('leadersMinutes',!s.minutesCustom&&[0,10,15,20,25].includes(s.minutes)?s.minutes:'custom');
    $('leadersMinutesCustomWrap').hidden=$('leadersMinutes').value!=='custom';
    leaderSyncSelect('leadersGamesCustom',s.games);
    leaderSyncSelect('leadersMinutesCustom',s.minutes);
    leaderSyncSelect('leadersVolumeCustom',s.volumeCustom);
    leaderSyncSelect('leadersRows',s.rows);
    if(document.activeElement!==$('leadersSearch')&&$('leadersSearch').value!==s.query)$('leadersSearch').value=s.query;
  }
  function leaderUpdateStatus(){
    const s=leaderState,stamp=s.at?new Date(s.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
    let message=s.loading?`${s.progress}${s.at?' · Displaying previous complete cache.':''}`:
      s.error?`${s.error}${stamp?` · Showing complete cached data from ${stamp}.`:''}`:
      s.at?`✓ Complete ESPN response · ${s.dataCount} player entries · last updated ${stamp} · cache 30 minutes.`:
      'Select League Leaders to request ESPN statistics.';
    const status=$('leadersProgress');status.textContent=message;
    status.className='cs-leaders-progress'+(s.error?' cs-error':s.at&&!s.loading?' cs-ok':'');
    $('leadersRefresh').disabled=s.loading;
    $('leadersSummary').innerHTML=s.at?
      `<span class="cs-leader-chip"><b>${s.dataCount}</b> ESPN-listed players</span><span class="cs-leader-chip"><b>30</b> teams</span><span class="cs-leader-chip"><b>${s.season-1}–${String(s.season).slice(-2)}</b> regular season</span>`:'';
  }
  let leaderLastTableKey=null;
  function renderLeaders(){
    leaderRenderControls();leaderUpdateStatus();
    const s=leaderState,spec=leaderCategorySpec[s.category];
    // Loading progress and rate-limit status are not reasons to rebuild rows.
    const tableKey=JSON.stringify([s.at,s.season,s.category,s.metric,s.desc,s.team,s.position,s.games,s.minutes,s.volume,s.volumeCustom,s.query,s.rows,s.page,!s.at&&s.loading,!s.at&&s.error]);
    if(leaderLastTableKey===tableKey){leaderUpdateCaution();return;}
    leaderLastTableKey=tableKey;
    const scroller=$('leadersTableScroll'),left=scroller.scrollLeft;
    let {ranked,visible}=leaderFiltered();
    const statFields=spec.columns;
    const cols=[['rank','#'],['name','PLAYER'],['team','TEAM'],...statFields.map(key=>[key,leaderStats[key].label])];
    const nextHead=`<thead id="leadersTableHead"><tr>${cols.map(([key,title])=>{
      if(key==='rank'||key==='name'||key==='team')return `<th scope="col">${title}</th>`;
      const active=s.metric===key;
      return `<th scope="col"${active?` aria-sort="${s.desc?'descending':'ascending'}"`:''}><button type="button" data-leader-sort="${key}" title="Sort by ${safe(title)}">${safe(title)} ${active?(s.desc?'▼':'▲'):''}</button></th>`;
    }).join('')}</tr></thead>`;
    const headTemplate=document.createElement('table');headTemplate.innerHTML=nextHead;
    patchGameDOM($('leadersTableHead'),headTemplate.querySelector('thead'));
    const nPages=Math.max(1,Math.ceil(visible.length/s.rows));s.page=Math.min(s.page,nPages);
    const start=(s.page-1)*s.rows,chunk=visible.slice(start,start+s.rows);
    $('leadersTableBody').innerHTML=s.at?chunk.map(p=>{
      const head=p.headshot?`<img class="cs-leader-avatar" loading="lazy" src="${safe(p.headshot)}" alt="" onerror="this.style.visibility='hidden'">`:'<span class="cs-leader-avatar"></span>';
      const profile=`data-player-profile="${safe(p.id)}" data-player-name="${safe(p.name)}" data-player-team="${safe(p.teamId)}" data-player-team-name="${safe(p.teamName)}" data-player-pos="${safe(p.pos)}" data-player-jersey="${safe(p.jersey)}" data-player-headshot="${safe(p.headshot)}"`;
      const team=p.teamId?`<button class="cs-leader-team" type="button" data-team-profile="${safe(p.teamId)}" title="${safe(p.teamName)}">${safe(p.teamAbbr||p.teamName||'—')}</button>`:safe(p.teamAbbr||'—');
      return `<tr><td class="cs-leader-rank">${p.rank??'—'}</td><td><div class="cs-leader-player">${head}<div class="cs-leader-person"><button type="button" ${profile}>${safe(p.name)}</button><small>${safe(p.pos||'NBA Player')}</small></div></div></td><td>${team}</td>${statFields.map(key=>`<td class="${key===s.metric?'cs-leader-accent':''}">${safe(leaderFormat(p,key))}</td>`).join('')}</tr>`;
    }).join(''):`<tr><td colspan="${cols.length}" style="text-align:center;padding:45px;color:#acb6c6">${s.error?'Unable to load complete league-wide data. Check the status above.':s.loading?'Validating all ESPN pages...':'Open this tab to load NBA statistics.'}</td></tr>`;
    if(s.at&&!chunk.length)$('leadersTableBody').innerHTML=`<tr><td colspan="${cols.length}" style="text-align:center;padding:40px;color:#abb5c2">No players matched these filters. Try lowering minimum games, minutes, or shooting volume.</td></tr>`;
    $('leadersResults').textContent=s.at?`${visible.length} matching · ${ranked.length} eligible from ${s.dataCount} ESPN-listed players · ranking by ${leaderStats[s.metric].label} ${s.desc?'↓':'↑'}`:'Rankings will appear after ESPN pagination is validated.';
    $('leadersPaging').innerHTML=s.at?`<span>Page ${s.page} of ${nPages} · ${visible.length?start+1:0}–${Math.min(start+s.rows,visible.length)} of ${visible.length}</span><div><button type="button" data-leader-page="prev" ${s.page===1?'disabled':''}>← Previous</button> <button type="button" data-leader-page="next" ${s.page===nPages?'disabled':''}>Next →</button></div>`:'';
    scroller.scrollLeft=left;
    leaderUpdateCaution();
  }
  function leaderUpdateCaution(){
    const s=leaderState;
    $('leadersCaution').textContent='Coverage: every player in ESPN’s completed, paginated statistics response — not independently verified against all NBA rosters. Stats and eligibility may differ from NBA official leader qualifications. Season and completeness checks prevent publishing incomplete responses. Percentages use full supplied precision. ' +(s.at&&s.missingMetrics.length?'ESPN has no usable values for: '+s.missingMetrics.map(k=>leaderStats[k].label).join(', ')+'. ':'')+(s.at&&s.missingTeamCount?`${s.missingTeamCount} ESPN entries lack team IDs and cannot match a team-specific filter. `:'')+(s.error&&s.at?'Refresh failed: showing the last complete dataset.':'');
  }
  function leaderSetCategory(category){
    if(!leaderCategorySpec[category])return;
    leaderState.category=category;leaderState.metric=leaderCategorySpec[category].options[0];leaderState.desc=true;leaderState.page=1;renderLeaders();
  }
  function leaderSetSort(key,flip=false){
    if(!leaderStats[key])return;
    if(flip&&leaderState.metric===key)leaderState.desc=!leaderState.desc;
    else{leaderState.metric=key;leaderState.desc=true;}
    leaderState.page=1;renderLeaders();
  }
  // Delegation reuses Courtside 1.4's [data-player-profile] and [data-team-profile] click handlers.
  $('leadersCategories').addEventListener('click',event=>{const b=event.target.closest('[data-leader-category]');if(b)leaderSetCategory(b.dataset.leaderCategory);});
  $('leadersMetric').addEventListener('change',event=>leaderSetSort(event.target.value));
  $('leadersTableHead').addEventListener('click',event=>{const b=event.target.closest('[data-leader-sort]');if(b)leaderSetSort(b.dataset.leaderSort,true);});
  for(const [name,prop] of [['leadersTeam','team'],['leadersPosition','position']]){
    $(name).addEventListener('change',event=>{leaderState[prop]=event.target.value;leaderState.page=1;renderLeaders();});
  }
  for(const [control,custom,wrap,prop,cap] of [
    ['leadersGames','leadersGamesCustom','leadersGamesCustomWrap','games',100],
    ['leadersMinutes','leadersMinutesCustom','leadersMinutesCustomWrap','minutes',48]
  ]){
    $(control).addEventListener('change',event=>{
      const isCustom=event.target.value==='custom';leaderState[prop+'Custom']=isCustom;
      $(wrap).hidden=!isCustom;
      const v=isCustom?Number($(custom).value):Number(event.target.value);
      leaderState[prop]=Number.isFinite(v)?Math.min(cap,Math.max(0,v)):0;leaderState.page=1;renderLeaders();
    });
    $(custom).addEventListener('input',event=>{
      const v=Number(event.target.value);if(event.target.value!==''&&Number.isFinite(v)){leaderState[prop]=Math.min(cap,Math.max(0,v));leaderState.page=1;renderLeaders();}
    });
  }
  $('leadersVolume').addEventListener('change',event=>{leaderState.volume=event.target.value;leaderState.page=1;renderLeaders();});
  $('leadersVolumeCustom').addEventListener('input',event=>{const v=Number(event.target.value);if(event.target.value!==''&&Number.isFinite(v)){leaderState.volumeCustom=Math.min(40,Math.max(0,v));leaderState.page=1;renderLeaders();}});
  $('leadersSearch').addEventListener('input',event=>{leaderState.query=event.target.value;leaderState.page=1;renderLeaders();$('leadersSearch').focus({preventScroll:true});});
  $('leadersRows').addEventListener('change',event=>{leaderState.rows=Number(event.target.value);settingsPrefs.leadersRows=leaderState.rows;saveSettingsPrefs();syncSettingsControls();leaderState.page=1;renderLeaders();});
  $('leadersPaging').addEventListener('click',event=>{
    const b=event.target.closest('[data-leader-page]');if(!b)return;
    leaderState.page+=b.dataset.leaderPage==='next'?1:-1;renderLeaders();
    $('leadersTableScroll').scrollIntoView({behavior:'auto',block:'nearest'});
  });
  $('leadersRefresh').addEventListener('click',()=>fetchLeaders(true));
  $('leadersReset').addEventListener('click',()=>{
    Object.assign(leaderState,{team:'all',position:'all',games:5,minutes:0,gamesCustom:false,minutesCustom:false,volume:'auto',volumeCustom:2,query:'',rows:settingsPrefs.leadersRows,page:1});renderLeaders();
  });


  // Courtside 1.6.1: embedded, version-selectable release history. No network activity.
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

