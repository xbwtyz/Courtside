/** Poll coordinator logic, with all mutable dependencies injected. */
export function createPollingCoordinator({document,Date,state,espnPoll,standingsState,STANDINGS_TTL_MS,$,
  getMainView,fetchScores,refreshSelectedStatsIfDue,fetchStandings,updateStatus}){
  function runAdaptivePolls(){
    if(!document.hidden){
      const now=Date.now();
      if(!state.loading&&now>=state.nextAt&&now>=espnPoll.sharedUntil)fetchScores();
      refreshSelectedStatsIfDue();
      if(getMainView()==='standings'&&$('viewer').hidden&&!standingsState.pending&&(!standingsState.at||now-standingsState.at>=STANDINGS_TTL_MS))fetchStandings();
    }
    updateStatus();
  }
  return {runAdaptivePolls};
}
