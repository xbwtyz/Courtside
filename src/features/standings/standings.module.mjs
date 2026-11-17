/** Standings, shared team directory, ESPN request policy and primary navigation. */
export function createStandings({$,getState,viewerState,espnPoll,AbortController,Date,Map,Math,Number,String,Array,setTimeout,clearTimeout,fetch,safe,safeLogo,auditESPNJob,dataLogRequestInfo,retryAfterMs,exponentialBackoff,dataLogObserve,dataLogStandingsRecords,dataLogInvalid,profileSeasonYear,renderTeamProfile,renderLeaders,fetchLeaders,renderDataLog,getMainView,setMainViewValue}){
  // Standings are loaded on demand. ESPN's /teams endpoint is intentionally avoided
  // because it doesn't consistently allow cross-origin browser requests.
  const STANDINGS_API='https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';
  const TEAM_API='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
  const STANDINGS_TTL_MS=10*60*1000,TEAM_DETAILS_TTL_MS=15*60*1000;
  const teamDirectory=new Map();
  const standingsState={groups:[],at:0,pending:null,error:'',retryAt:0,failures:0,season:null};
  const profileState={id:null,tab:'overview',previousFocus:null,cache:new Map(),pending:new Map()};
  // mainView is retained as an app-level mutable binding via getter/setter.
  const simpleId=value=>/^\d{1,12}$/.test(String(value||''))?String(value):'';
  function statNumber(value){const n=Number(value);return Number.isFinite(n)?n:null;}
  function seedTeamDirectoryFromScores(){
    for(const game of getState().games)for(const c of game.competitions?.[0]?.competitors||[]){
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
      if(getMainView()==='standings')renderStandings();
      if(profileState.id&&!$('teamProfileModal').hidden)renderTeamProfile();
    }
  }
  function setMainView(view){
    setMainViewValue(['scores','standings','leaders','log'].includes(view)?view:'scores');
    $('scoresView').hidden=getMainView()!=='scores';
    $('standingsView').hidden=getMainView()!=='standings';
    $('leadersView').hidden=getMainView()!=='leaders';
    $('dataLogView').hidden=getMainView()!=='log';
    for(const [name,id] of [['scores','csTabScores'],['standings','csTabStandings'],['leaders','csTabLeaders'],['log','csTabLog']]){
      const active=name===getMainView();
      $(id).setAttribute('aria-selected',String(active));$(id).tabIndex=active?0:-1;
    }
    if(getMainView()==='standings'){renderStandings();fetchStandings();}
    if(getMainView()==='leaders'){renderLeaders();fetchLeaders();}
    if(getMainView()==='log')renderDataLog();
  }
  function updateGameCenterTeamLinks(){
    const g=getState().games.find(game=>String(game.id)===viewerState.gameId),comps=g?.competitions?.[0]?.competitors||[];
    const html=comps.map(c=>{
      const id=simpleId(c.team?.id);if(!id)return '';
      return `<button type="button" class="cs-profile-link" data-team-profile="${safe(id)}" title="Open team profile">${safe(c.team?.abbreviation||c.team?.name||'Team')} ↗</button>`;
    }).join('');
    if($('gcTeamLinks').innerHTML!==html)$('gcTeamLinks').innerHTML=html;
  }
  return {STANDINGS_API,TEAM_API,STANDINGS_TTL_MS,TEAM_DETAILS_TTL_MS,teamDirectory,standingsState,profileState,simpleId,statNumber,seedTeamDirectoryFromScores,mappedStats,standStat,parseStandings,standingsMetric,teamLogoMarkup,renderConference,renderStandings,fetchFeatureJson,fetchStandings,setMainView,updateGameCenterTeamLinks};
}
