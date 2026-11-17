/** Shared ESPN configuration and request-status ownership. */
export function createEspnConfig(){
  const SUMMARY_API='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';
  const ESPN_LIVE_SCORES_MS=10*1000;
  const ESPN_LIVE_STATS_MS=15*1000;
  const ESPN_IDLE_MS=60*1000;
  const ESPN_MAX_BACKOFF_MS=5*60*1000;
  const espnPoll={sharedUntil:0,scoreFailures:0};
  const statsPoll={gameId:null,nextAt:0,failures:0};


  return {SUMMARY_API, ESPN_LIVE_SCORES_MS, ESPN_LIVE_STATS_MS, ESPN_IDLE_MS, ESPN_MAX_BACKOFF_MS, espnPoll, statsPoll};
}

/** Keep exactly the original scoreboard status transitions, in one owner.
 * ESPNPoll is intentionally shared with the already-migrated scheduler.
 * No network, UI, timer or stream operation occurs inside this object.
 */
export function createScoreRequestStatus({state, espnPoll, AbortController, Date, getScoresRefreshMs, getBackoff}) {
  function rateLimited(force){
    state.nextAt=Math.max(state.nextAt,espnPoll.sharedUntil);
    if(force){state.error='ESPN has temporarily rate-limited requests. Waiting before retrying.';state.firstLoaded=true;}
  }
  function begin(){
    const seq=++state.requestSeq;
    const controller=new AbortController();state.controller=controller;
    state.loading=true;state.error='';state.fetchDate=state.date;
    return {seq,controller};
  }
  function succeeded(){
    state.lastUpdated=new Date();state.firstLoaded=true;state.error='';
    espnPoll.scoreFailures=0;
  }
  function incrementFailure(){espnPoll.scoreFailures++;}
  function recordError(err){
    state.error=err.name==='AbortError'?'The request timed out. Please retry.':err.message;
    state.firstLoaded=true;
  }
  function complete(seq){
    if(seq!==state.requestSeq)return false;
    state.loading=false;state.controller=null;state.fetchDate=null;
    state.nextAt=Number.isFinite(getScoresRefreshMs())?Date.now()+(state.error?getBackoff(espnPoll.scoreFailures):getScoresRefreshMs()):Infinity;
    state.nextAt=Math.max(state.nextAt,espnPoll.sharedUntil);
    return true;
  }
  return {rateLimited,begin,succeeded,incrementFailure,recordError,complete};
}
