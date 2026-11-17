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
