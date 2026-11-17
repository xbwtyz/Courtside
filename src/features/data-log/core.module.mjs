import { RELEASE_VERSION } from '../../release/version.mjs';
/**
 * Data Log observation and UI reconciliation. This factory is constructed at the
 * original script position, with the existing ESPN queue injected. It never polls
 * or fetches independently; requestESPN is only invoked by auditESPNJob.
 */
export function createDataLog({$,document,window,performance,Date,URL,Blob,Map,WeakMap,setInterval,setTimeout,clearTimeout,requestESPN,parsePlayerBoxscore,gameStatValues,standStat,parseTeamSchedule,extractPlayerStats,parsePlayerGameLog,safe}) {
  // Courtside 1.5.6 release notes: LRU-capped semantic snapshots, optimized
  // visible Data Log reconciliation, batched UI, and local performance diagnostics.
  // Inherits 1.5.5 ESPN-only history, comparisons and JSON export.
  // Courtside 1.5.6 — bounded, ephemeral ESPN-only audit log. The audited
  // request wrapper calls the ORIGINAL priority queue and does no extra I/O.
  const DATA_LOG_LIMIT=2000,DATA_LOG_CHANGE_LIMIT=150;
  // 1.5.6: two independent caps prevent a long browsing session from
  // retaining an unbounded number of unique date / player / game snapshots.
  const DATA_LOG_SNAPSHOT_SCOPES=96,DATA_LOG_SNAPSHOT_RECORDS=8000;
  const DATA_LOG_SNAPSHOT_BYTES=3*1024*1024,DATA_LOG_SNAPSHOT_IDLE_MS=2*60*60*1000;
  const DATA_LOG_UI_BATCH_MS=250,DATA_LOG_PERF_SAMPLE_LIMIT=120;
  const dataLog={entries:[],snapshots:new Map(),snapshotMeta:new Map(),snapshotBytes:0,snapshotRecords:0,
    snapshotEvictions:0,snapshotOversize:0,paused:false,source:'all',outcome:'all',search:'',shown:50,dropped:0,nextId:0,
    uiTimer:null,uiRequests:0,uiRenders:0,uiCoalesced:0,compareMs:[],renderMs:[]};
  const dataLogResponses=new WeakMap();
  const dataLogNow=()=>new Date().toISOString();
  function dataLogVisible(){return !$('dataLogView').hidden;}
  // Only the visible Data Log is scheduled for repaint. Multiple incoming
  // responses and semantic comparisons are coalesced into one update.
  function dataLogRefresh(){
    if(!dataLogVisible())return;
    dataLog.uiRequests++;
    if(dataLog.uiTimer!==null){dataLog.uiCoalesced++;return;}
    dataLog.uiTimer=setTimeout(()=>{
      dataLog.uiTimer=null;
      if(dataLogVisible())renderDataLog();
    },DATA_LOG_UI_BATCH_MS);
  }
  function dataLogPerfSample(bucket,value){
    if(!Number.isFinite(value))return;
    const sample=dataLog[bucket];sample.push(value);
    if(sample.length>DATA_LOG_PERF_SAMPLE_LIMIT)sample.shift();
  }
  function dataLogSnapshotEvict(scope){
    const info=dataLog.snapshotMeta.get(scope);
    if(!info)return;
    dataLog.snapshots.delete(scope);dataLog.snapshotMeta.delete(scope);
    dataLog.snapshotBytes=Math.max(0,dataLog.snapshotBytes-info.bytes);
    dataLog.snapshotRecords=Math.max(0,dataLog.snapshotRecords-info.records);
    dataLog.snapshotEvictions++;
  }
  // A scope becomes the newest Map key when refreshed (LRU ordering). Eviction
  // also drops inactive scopes; a subsequent request starts a new baseline.
  function dataLogStoreSnapshot(scope,current,bytes){
    const count=current.size;
    if(count>DATA_LOG_SNAPSHOT_RECORDS||bytes>DATA_LOG_SNAPSHOT_BYTES){
      dataLogSnapshotEvict(scope);
      dataLog.snapshotOversize++;
      return false;
    }
    if(dataLog.snapshotMeta.has(scope)){
      // Replacing an existing scope is not counted as a memory eviction.
      const old=dataLog.snapshotMeta.get(scope);
      dataLog.snapshotBytes-=old.bytes;dataLog.snapshotRecords-=old.records;
      dataLog.snapshotMeta.delete(scope);dataLog.snapshots.delete(scope);
    }
    const now=Date.now();
    dataLog.snapshotMeta.set(scope,{bytes,records:count,at:now});
    dataLog.snapshots.set(scope,current);
    dataLog.snapshotBytes+=bytes;dataLog.snapshotRecords+=count;
    for(const [key,info] of dataLog.snapshotMeta){
      if(now-info.at>DATA_LOG_SNAPSHOT_IDLE_MS)dataLogSnapshotEvict(key);
    }
    while(dataLog.snapshots.size>DATA_LOG_SNAPSHOT_SCOPES||
      dataLog.snapshotRecords>DATA_LOG_SNAPSHOT_RECORDS||
      dataLog.snapshotBytes>DATA_LOG_SNAPSHOT_BYTES){
      const oldest=dataLog.snapshots.keys().next().value;
      if(oldest===undefined)break;
      dataLogSnapshotEvict(oldest);
    }
    return dataLog.snapshots.has(scope);
  }
  function dataLogPerformanceText(){
    const avg=samples=>samples.length?(samples.reduce((a,b)=>a+b,0)/samples.length).toFixed(2):'0.00';
    const peak=samples=>samples.length?Math.max(...samples).toFixed(2):'0.00';
    const kib=(dataLog.snapshotBytes/1024).toFixed(1);
    return `Comparison baselines: ${dataLog.snapshots.size}/${DATA_LOG_SNAPSHOT_SCOPES} · `+
      `Normalized records: ${dataLog.snapshotRecords.toLocaleString()}/${DATA_LOG_SNAPSHOT_RECORDS.toLocaleString()}\n`+
      `Estimated snapshot text payload: ${kib} KiB / ${(DATA_LOG_SNAPSHOT_BYTES/1048576).toFixed(0)} MiB `+
      `(not total browser memory)\n`+
      `Snapshot evictions: ${dataLog.snapshotEvictions} · oversized skipped: ${dataLog.snapshotOversize}\n`+
      `Comparison time (last ${dataLog.compareMs.length}): avg ${avg(dataLog.compareMs)} ms · max ${peak(dataLog.compareMs)} ms\n`+
      `Log UI updates (last ${dataLog.renderMs.length}): avg ${avg(dataLog.renderMs)} ms · max ${peak(dataLog.renderMs)} ms\n`+
      `UI refreshes: ${dataLog.uiRenders} · coalesced notifications: ${dataLog.uiCoalesced}`;
  }
  function renderDataLogPerformance(){
    const target=$('dataLogPerformance');
    if(target)target.textContent=dataLogPerformanceText();
  }
  // Performance diagnostics are updated only while the relevant settings pane
  // is visible, not by an additional fast background timer.
  setInterval(()=>{
    if(!document.hidden&&!$('appSettingsModal').hidden&&!$('csSettingsData').hidden)renderDataLogPerformance();
  },5000);
  function dataLogAdd(fields){
    if(dataLog.paused)return null;
    const entry={id:++dataLog.nextId,revision:0,at:dataLogNow(),source:'ESPN',resource:'',endpoint:'',http:null,
      queueMs:0,durationMs:0,priority:2,outcome:'received',changes:[],changeCount:0,records:0,message:'',...fields};
    dataLog.entries.unshift(entry);
    if(dataLog.entries.length>DATA_LOG_LIMIT){dataLog.entries.length=DATA_LOG_LIMIT;dataLog.dropped++;}
    dataLogRefresh();return entry;
  }
  function dataLogRequestInfo(url){
    const u=new URL(url),path=u.pathname,seg=path.split('/').filter(Boolean),last=seg.at(-1);
    if(path.includes('/statistics/byathlete'))return {source:'League Leaders',resource:`Season ${u.searchParams.get('season')||'?'} · page ${u.searchParams.get('page')||'1'}`};
    if(path.endsWith('/standings'))return {source:'Standings',resource:'Current NBA standings'};
    if(path.includes('/athletes/'))return {source:'Player Profile',resource:`Player ${seg[seg.indexOf('athletes')+1]||'?'} · ${last} · ${u.searchParams.get('season')||'current'}`};
    if(path.includes('/teams/'))return {source:'Team Profile',resource:`Team ${seg[seg.indexOf('teams')+1]||'?'} · ${last}`};
    return {source:'ESPN',resource:last||'Request'};
  }
  async function auditESPNJob({source,resource,url,priority},work){
    const queued=performance.now();let started=0,http=null;
    try{
      const data=await requestESPN(async()=>{
        started=performance.now();
        return await work(response=>{http=response?.status??null;});
      },priority);
      const end=performance.now();
      const entry=dataLogAdd({source,resource,endpoint:new URL(url).pathname,http,priority,
        queueMs:started?Math.round(started-queued):0,durationMs:started?Math.round(end-started):0,
        outcome:'received',message:'Response received and JSON parsed; awaiting semantic validation.'});
      if(entry&&data&&typeof data==='object')dataLogResponses.set(data,entry);
      return data;
    }catch(error){
      const end=performance.now();
      const canceled=error?.name==='AbortError';
      dataLogAdd({source,resource,endpoint:new URL(url).pathname,http,priority,
        queueMs:started?Math.round(started-queued):Math.round(end-queued),durationMs:started?Math.round(end-started):0,
        outcome:canceled?'canceled':'error',message:String(error?.message||error)});
      throw error;
    }
  }
  function dataLogInvalid(json,error){
    const entry=json&&typeof json==='object'?dataLogResponses.get(json):null;
    if(!entry||entry.outcome!=='received')return;
    entry.outcome='error';entry.message=`Response rejected: ${String(error?.message||error)}`;
    entry.revision=(entry.revision||0)+1;dataLogRefresh();
  }
  // All projectors return stable records with {id,label,fields}. We store only
  // meaningful, normalized fields. Date/game/team/player identity is part of
  // the resource scope; there is no raw JSON snapshot or embed URL storage.
  function dataLogCompare(json,scope,records){
    const entry=json&&typeof json==='object'?dataLogResponses.get(json):null;
    const current=new Map();let footprint=0;
    for(const rec of records||[]){
      if(!rec||rec.id===null||rec.id===undefined)continue;
      const id=String(rec.id),label=String(rec.label||rec.id),fields={};
      // Approximate UTF-16 payload size, not a claim about total JS heap size.
      let bytes=96+2*(id.length+label.length);
      for(const [field,value] of Object.entries(rec.fields||{})){
        if(value===undefined||value===null||typeof value==='object')continue;
        const str=String(value);
        fields[field]=str;bytes+=32+2*(field.length+str.length);
      }
      if(current.has(id))footprint-=current.get(id)._bytes;
      current.set(id,{label,fields,_bytes:bytes});footprint+=bytes;
    }
    const previous=dataLog.snapshots.get(scope);
    // Pause suppresses expensive field-by-field comparisons while preserving
    // up-to-date baselines for accurate resume behavior.
    if(dataLog.paused){dataLogStoreSnapshot(scope,current,footprint);return;}
    const changes=[];let total=0;
    const add=(record,field,oldValue,newValue,type)=>{
      total++;
      if(changes.length<DATA_LOG_CHANGE_LIMIT)changes.push({record,field,old:oldValue??'—',new:newValue??'—',type});
    };
    if(previous){
      for(const [id,rec] of current){
        const old=previous.get(id);
        if(!old){add(rec.label,'Record','—','Added','added');continue;}
        for(const field of new Set([...Object.keys(old.fields),...Object.keys(rec.fields)])){
          const before=old.fields[field],after=rec.fields[field];
          if(before!==after)add(rec.label,field,before,after,'changed');
        }
      }
      for(const [id,rec] of previous)if(!current.has(id))add(rec.label,'Record','Present','Removed','removed');
    }
    const stored=dataLogStoreSnapshot(scope,current,footprint);
    if(!entry)return;
    entry.records=current.size;entry.changes=changes;entry.changeCount=total;
    entry.outcome=!previous?'baseline':total?'changed':'unchanged';
    entry.message=!previous?'First successful snapshot for this resource.':total?`${total} meaningful field change${total===1?'':'s'}.`:'No meaningful changes since the previous snapshot.';
    if(total>changes.length)entry.message+=` Showing first ${changes.length} changes.`;
    if(!stored)entry.message+=' Snapshot exceeded local memory limits and was not retained.';
    entry.revision=(entry.revision||0)+1;
    dataLogRefresh();
  }
  // Semantic logging must never block or corrupt the application's normal
  // scoreboard/statistics processing, even if an ESPN field shape changes.
  function dataLogObserve(json,scope,project){
    const started=performance.now();
    try{dataLogCompare(json,scope,project());}
    catch(error){
      const entry=json&&typeof json==='object'?dataLogResponses.get(json):null;
      if(entry){entry.message=`Comparison unavailable for this response: ${String(error?.message||error)}`;
        entry.revision=(entry.revision||0)+1;dataLogRefresh();}
    }finally{dataLogPerfSample('compareMs',performance.now()-started);}
  }
  function dataLogScoreRecords(games){
    return (games||[]).map(g=>{
      const comps=g.competitions?.[0]?.competitors||[];
      const away=comps.find(c=>c.homeAway==='away')||{},home=comps.find(c=>c.homeAway==='home')||{};
      const period=g.status?.period??g.competitions?.[0]?.status?.period;
      const label=`${away.team?.abbreviation||'Away'} @ ${home.team?.abbreviation||'Home'}`;
      return {id:g.id,label,fields:{'Away score':away.score,'Home score':home.score,
        'Game state':g._phase,'Period':period,'Away team':away.team?.displayName||away.team?.name,'Home team':home.team?.displayName||home.team?.name}};
    });
  }
  function dataLogSummaryRecords(summary){
    const records=[];
    for(const group of parsePlayerBoxscore(summary))for(const player of group.players){
      if(!player.id)continue;
      const fields={};
      for(const key of ['min','pts','reb','ast','fg','tp','ft','stl','blk','to','pf','pm','dnp'])if(player[key]!==undefined)fields[key.toUpperCase()]=player[key];
      records.push({id:`player:${player.id}`,label:`${player.name} (${group.abbr||'NBA'})`,fields});
    }
    const teams=gameStatValues(summary);
    for(const [team,stats] of Object.entries(teams))records.push({id:`team:${team}`,label:`${team} team stats`,fields:stats});
    return records;
  }
  function dataLogStandingsRecords(groups){
    return groups.flatMap(group=>group.entries.map(team=>({id:team.id,label:team.name,
      fields:{Conference:group.name,Rank:team.rank,Wins:standStat(team.values||{},'wins'),Losses:standStat(team.values||{},'losses'),
        'Win percentage':standStat(team.values||{},'winPercent','winningPercent'),
        'Games behind':standStat(team.values||{},'gamesBehind'),
        Streak:standStat(team.values||{},'streak'),'Last 10':standStat(team.values||{},'lastTenGames','lastTen','last10')}})));
  }
  function dataLogTeamRecords(kind,payload,teamId){
    if(kind==='schedule')return parseTeamSchedule(payload,teamId).map(g=>({id:g.id,label:`${g.other} (${g.homeAway})`,
      fields:{Date:g.date.toISOString(),Opponent:g.other,Complete:g.complete,Score:g.score||'',Result:g.won===true?'W':g.won===false?'L':g.complete?'Final':'Upcoming'}}));
    const roster=payload.athletes||payload.players||[];
    if(!Array.isArray(roster))return [];
    return roster.flatMap(group=>group?.items||group?.athletes||[group]).map(row=>row?.athlete||row).filter(a=>a?.id).map(a=>({
      id:a.id,label:a.displayName||a.fullName||`Player ${a.id}`,
      fields:{Name:a.displayName||a.fullName,Team:teamId,Position:a.position?.abbreviation||a.position?.displayName,
        Jersey:a.jersey,Height:a.displayHeight,Weight:a.displayWeight,Age:a.age}}));
  }
  function dataLogPlayerRecords(kind,data,id){
    if(kind==='stats'){return [{id,label:`Player ${id}`,fields:extractPlayerStats(data)}];}
    if(kind==='gamelog')return parsePlayerGameLog(data).map(g=>({id:g.id||g.date.toISOString().slice(0,10),label:`${g.opponent} · ${g.date.toLocaleDateString()}`,
      fields:{Opponent:g.opponent,Result:g.result,...g.stats}}));
    const a=data?.athlete||data?.player||data?.header?.athlete||{};
    return [{id,label:a.displayName||a.fullName||`Player ${id}`,fields:{Name:a.displayName||a.fullName,Team:a.team?.id||a.teamId,
      Position:a.position?.abbreviation||a.position?.displayName,Jersey:a.jersey}}];
  }
  function dataLogLeadersRecords(players){
    return players.map(p=>({id:p.id,label:p.name,fields:{Team:p.teamId,Position:p.pos,...p.v}}));
  }
  function dataLogMatches(entry){
    if(dataLog.source!=='all'&&entry.source!==dataLog.source)return false;
    if(dataLog.outcome!=='all'&&entry.outcome!==dataLog.outcome&&!(dataLog.outcome==='error'&&entry.outcome==='error'))return false;
    if(!dataLog.search)return true;
    const q=dataLog.search.toLowerCase();
    return [entry.source,entry.resource,entry.endpoint,entry.message,String(entry.http),
      ...entry.changes.flatMap(c=>[c.record,c.field,c.old,c.new])].some(x=>String(x||'').toLowerCase().includes(q));
  }
  function dataLogEntryMarkup(entry){
    const date=new Date(entry.at),time=date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',second:'2-digit'});
    const outcome=entry.outcome;
    const badge=outcome==='changed'?`${entry.changeCount} changed`:outcome==='error'?'Error':outcome==='canceled'?'Canceled':outcome==='baseline'?'Baseline':outcome==='unchanged'?'Unchanged':'Page received';
    const rows=entry.changes.map(c=>`<tr><td>${safe(c.record)} · ${safe(c.field)}</td><td>${safe(c.old)}</td><td>${safe(c.new)}</td></tr>`).join('');
    return `<details class="cs-log-entry" data-log-id="${entry.id}" data-log-version="${entry.revision||0}"><summary><time class="cs-log-time" datetime="${safe(entry.at)}">${safe(time)}</time><span class="cs-log-origin">${safe(entry.source)}</span><span class="cs-log-resource">${safe(entry.resource)}</span><span class="cs-log-tag ${outcome==='changed'?'changed':outcome==='error'||outcome==='canceled'?'error':outcome==='baseline'?'baseline':outcome==='unchanged'?'unchanged':''}">${safe(badge)}</span></summary>
      <div class="cs-log-detail"><div class="cs-log-meta"><span>HTTP <b>${safe(entry.http??'—')}</b></span><span>Queue <b>${entry.queueMs} ms</b></span><span>Execution <b>${entry.durationMs} ms</b></span><span>Priority <b>${entry.priority}</b></span><span>Records <b>${entry.records}</b></span><span>Changes <b>${entry.changeCount}</b></span><span>Endpoint <b>${safe(entry.endpoint)}</b></span></div>
      <p>${safe(entry.message||'')}</p>${rows?`<div class="cs-table-scroll"><table class="cs-log-changes"><thead><tr><th>Record / field</th><th>Previous</th><th>New</th></tr></thead><tbody>${rows}</tbody></table></div>`:''}</div></details>`;
  }
  // Reconcile by request ID: untouched entries stay mounted, retaining their
  // disclosure state, keyboard focus and selection. Only fresh or changed
  // entries are constructed, avoiding 50 HTML rebuilds per refresh.
  function dataLogNode(entry){
    const template=document.createElement('template');
    template.innerHTML=dataLogEntryMarkup(entry);
    return template.content.firstElementChild;
  }
  function dataLogReconcile(visible,message){
    const container=$('dataLogEntries');
    if(!visible.length){
      const placeholder=container.firstElementChild;
      if(container.children.length!==1||!placeholder?.classList.contains('cs-log-empty')||placeholder.textContent!==message){
        container.innerHTML=`<div class="cs-log-empty">${safe(message)}</div>`;
      }
      return;
    }
    container.querySelectorAll('.cs-log-empty').forEach(el=>el.remove());
    const existing=new Map([...container.children].filter(el=>el.matches('details[data-log-id]'))
      .map(el=>[el.dataset.logId,el]));
    const needed=new Set(visible.map(e=>String(e.id)));
    // Keep an existing visible row anchored during incoming updates, so a
    // new entry above it doesn't jump the reader's page position.
    const anchor=[...container.querySelectorAll('details[data-log-id]')].find(el=>{
      const rect=el.getBoundingClientRect();
      return rect.bottom>80&&rect.top<window.innerHeight&&rect.top<80;
    });
    const before=anchor?.getBoundingClientRect().top;
    let cursor=container.firstElementChild;
    for(const entry of visible){
      const id=String(entry.id);let element=existing.get(id);
      if(!element||element.dataset.logVersion!==String(entry.revision||0)){
        const fresh=dataLogNode(entry);
        if(element){
          fresh.open=element.open;
          const focused=element.contains(document.activeElement);
          element.replaceWith(fresh);
          if(focused)fresh.querySelector('summary')?.focus({preventScroll:true});
        }
        element=fresh;
      }
      if(element!==cursor)container.insertBefore(element,cursor||null);
      cursor=element.nextElementSibling;
    }
    for(const child of [...container.children]){
      if(!needed.has(child.dataset.logId))child.remove();
    }
    if(anchor?.isConnected&&before!==undefined){
      const delta=anchor.getBoundingClientRect().top-before;
      if(Math.abs(delta)>1)window.scrollBy(0,delta);
    }
  }
  function renderDataLog(){
    if(dataLog.uiTimer!==null){clearTimeout(dataLog.uiTimer);dataLog.uiTimer=null;}
    const started=performance.now();
    const items=dataLog.entries;
    let changed=0,unchanged=0,errors=0;
    for(const entry of items){
      if(entry.outcome==='changed')changed++;
      if(entry.outcome==='unchanged')unchanged++;
      if(entry.outcome==='error'||entry.outcome==='canceled')errors++;
    }
    $('dataLogSummary').innerHTML=`<div><strong>${items.length.toLocaleString()}</strong><span>Retained requests</span></div><div><strong>${changed.toLocaleString()}</strong><span>Changed</span></div><div><strong>${unchanged.toLocaleString()}</strong><span>Unchanged</span></div><div><strong>${errors.toLocaleString()}</strong><span>Errors / canceled</span></div>`;
    $('dataLogStatus').classList.toggle('paused',dataLog.paused);
    $('dataLogStatus').innerHTML=dataLog.paused?'<span class="dot loading"></span> PAUSED':'<span class="dot"></span> RECORDING';
    $('dataLogPause').textContent=dataLog.paused?'▶ Resume':'Ⅱ Pause';
    const filtered=items.filter(dataLogMatches),visible=filtered.slice(0,dataLog.shown);
    dataLogReconcile(visible,items.length?'No records match these filters.':'Waiting for the first ESPN request. Logging is active across Courtside.');
    $('dataLogMore').hidden=filtered.length<=dataLog.shown;
    $('dataLogCount').textContent=`Showing ${visible.length} of ${filtered.length} matching requests · ${dataLog.dropped} older record${dataLog.dropped===1?'':'s'} discarded · ${dataLog.snapshots.size}/${DATA_LOG_SNAPSHOT_SCOPES} comparison baselines · ${dataLog.snapshotEvictions} baseline evictions`;
    dataLog.uiRenders++;
    dataLogPerfSample('renderMs',performance.now()-started);
  }
  function dataLogExport(){
    const payload={app:'Courtside',version:RELEASE_VERSION,exportedAt:dataLogNow(),scope:'ESPN requests only',
      retained:dataLog.entries.length,dropped:dataLog.dropped,paused:dataLog.paused,
      diagnostics:{snapshots:dataLog.snapshots.size,snapshotRecords:dataLog.snapshotRecords,estimatedSnapshotBytes:dataLog.snapshotBytes,snapshotEvictions:dataLog.snapshotEvictions,
        averageCompareMs:dataLog.compareMs.length?dataLog.compareMs.reduce((a,b)=>a+b,0)/dataLog.compareMs.length:null},
      entries:dataLog.entries};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`courtside-data-log-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.json`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  return {
    DATA_LOG_LIMIT,
    DATA_LOG_CHANGE_LIMIT,
    DATA_LOG_SNAPSHOT_SCOPES,
    DATA_LOG_SNAPSHOT_RECORDS,
    DATA_LOG_SNAPSHOT_BYTES,
    DATA_LOG_SNAPSHOT_IDLE_MS,
    DATA_LOG_UI_BATCH_MS,
    DATA_LOG_PERF_SAMPLE_LIMIT,
    dataLog,
    dataLogResponses,
    dataLogNow,
    dataLogVisible,
    dataLogRefresh,
    dataLogPerfSample,
    dataLogSnapshotEvict,
    dataLogStoreSnapshot,
    dataLogPerformanceText,
    renderDataLogPerformance,
    dataLogAdd,
    dataLogRequestInfo,
    auditESPNJob,
    dataLogInvalid,
    dataLogCompare,
    dataLogObserve,
    dataLogScoreRecords,
    dataLogSummaryRecords,
    dataLogStandingsRecords,
    dataLogTeamRecords,
    dataLogPlayerRecords,
    dataLogLeadersRecords,
    dataLogMatches,
    dataLogEntryMarkup,
    dataLogNode,
    dataLogReconcile,
    renderDataLog,
    dataLogExport
  };
}
