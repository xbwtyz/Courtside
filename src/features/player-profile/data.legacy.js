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
