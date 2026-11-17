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

