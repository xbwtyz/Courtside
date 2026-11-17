  // Preserve the original startup event registration and timers at this position.
  const {runAdaptivePolls}=CourtsidePollCoordinator.createPollingCoordinator({
    document,Date,state,espnPoll,standingsState,STANDINGS_TTL_MS,$,
    getMainView:()=>mainView,fetchScores,refreshSelectedStatsIfDue,fetchStandings,updateStatus
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)runAdaptivePolls();});
  setInterval(runAdaptivePolls,1000);
  setInterval(refreshViewerGameList,AURA_TTL_MS);
  renderLeaders();render();renderTickers();fetchScores(true);

