  // One lightweight scheduler checks independent due times. No extra fetches on paintViewer().
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

