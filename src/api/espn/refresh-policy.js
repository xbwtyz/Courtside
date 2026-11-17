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

