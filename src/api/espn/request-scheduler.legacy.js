  // Courtside 1.5.1 — priority-aware dispatch with full-response accounting.
  // 0: scores, 1: active game, 2: profiles/standings, 3: bulk leaderboards.
  // High-priority requests are serialized. One paced background request may
  // overlap a NEW high-priority request, so a slow leaderboard response never
  // prevents a live score from starting on time. At most two ESPN requests
  // are active, and background pages never start while a high job is active.
  // Callers resolve only after JSON parsing finishes, keeping slots honest.
  const espnJobs=[];
  let espnHighBusy=false,espnLeaderBusy=false,espnJobTimer=null;
  let espnLeaderLastStart=0,espnJobOrdinal=0;
  function requestESPN(work,priority=2){
    return new Promise((resolve,reject)=>{
      espnJobs.push({work,priority,resolve,reject,order:++espnJobOrdinal});
      pumpESPN();
    });
  }
  function startESPNJob(job){
    const leader=job.priority===3;
    if(leader){espnLeaderBusy=true;espnLeaderLastStart=Date.now();}
    else espnHighBusy=true;
    Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(()=>{
      if(leader)espnLeaderBusy=false;
      else espnHighBusy=false;
      pumpESPN();
    });
  }
  function pumpESPN(){
    if(espnJobTimer){clearTimeout(espnJobTimer);espnJobTimer=null;}
    if(!espnJobs.length)return;
    espnJobs.sort((a,b)=>a.priority-b.priority||a.order-b.order);
    if(Date.now()<espnPoll.sharedUntil){
      const until=new Date(espnPoll.sharedUntil).toLocaleTimeString();
      while(espnJobs.length)espnJobs.shift().reject(new Error(`ESPN rate limited until ${until}`));
      return;
    }
    if(!espnHighBusy && espnJobs[0].priority<3){
      startESPNJob(espnJobs.shift());
    }
    // Defer background work until the high-priority lane has drained. A later
    // high-priority arrival can bypass a slow in-flight background fetch.
    if(espnHighBusy||espnLeaderBusy||!espnJobs.length||espnJobs[0].priority<3)return;
    const wait=2600-(Date.now()-espnLeaderLastStart);
    if(wait>0){espnJobTimer=setTimeout(pumpESPN,wait);return;}
    startESPNJob(espnJobs.shift());
  }

  function exponentialBackoff(failures){
    return Math.min(ESPN_MAX_BACKOFF_MS, 30000*Math.pow(2,Math.min(4,Math.max(0,failures-1))));
  }
  function retryAfterMs(value){
    if(!value)return 0;
    const numeric=Number(value.trim());
    if(Number.isFinite(numeric)&&numeric>=0)return numeric*1000;
    const parsed=Date.parse(value);
    return Number.isFinite(parsed)?Math.max(0,parsed-Date.now()):0;
  }
  function noteEspnResponseError(response,channel){
    if(response.status!==429 && !(response.status===503 && response.headers.get('Retry-After')))return;
    const failures=channel==='scores'?espnPoll.scoreFailures+1:statsPoll.failures+1;
    const retry=Math.max(retryAfterMs(response.headers.get('Retry-After')),exponentialBackoff(failures));
    espnPoll.sharedUntil=Math.max(espnPoll.sharedUntil,Date.now()+retry);
  }
