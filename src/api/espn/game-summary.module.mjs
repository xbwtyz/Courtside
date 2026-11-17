/** Original ESPN Game Center summary request: shared cache, cooldown, timeout, dedup and backoff. */
export function createGameSummary({viewerState,statsPoll,espnPoll,SUMMARY_API,Date,AbortController,setTimeout,clearTimeout,encodeURIComponent,statsNeedsRequest,phaseForGameId,auditESPNJob,fetch,noteEspnResponseError,dataLogObserve,dataLogSummaryRecords,dataLogInvalid,exponentialBackoff}){
async function fetchGameSummary(id,force=false){
  const cached=viewerState.statsCache.get(id);
  if(!force&&!statsNeedsRequest(id))return cached?.data;
  if(viewerState.statsPending.has(id))return viewerState.statsPending.get(id);
  if(Date.now()<espnPoll.sharedUntil)throw new Error('ESPN rate limit cooldown in progress');
  if(!force&&statsPoll.gameId===id&&Date.now()<statsPoll.nextAt)
    throw new Error('ESPN statistics are waiting for retry');
  const phaseAtRequest=phaseForGameId(id);
  let summaryResponse=null;
  const fetchPromise=(async()=>{
    const controller=new AbortController();let timer;
    try{
      const data=await auditESPNJob({source:'Game Center',resource:`Game ${id}`,url:`${SUMMARY_API}?event=${encodeURIComponent(id)}`,priority:1},async report=>{
        if(Date.now()<espnPoll.sharedUntil)throw new Error('ESPN statistics rate-limit cooldown in progress');
        timer=setTimeout(()=>controller.abort(),9000);
        const r=await fetch(`${SUMMARY_API}?event=${encodeURIComponent(id)}`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
        report(r);
        if(!r.ok){noteEspnResponseError(r,'stats');throw new Error(`ESPN statistics HTTP ${r.status}`);}
        return await r.json();
      });
      summaryResponse=data;
      if(!data || typeof data!=='object')throw new Error('Unexpected game summary');
      dataLogObserve(data,`summary:${id}`,()=>dataLogSummaryRecords(data));
      viewerState.statsCache.set(id,{at:Date.now(),data,phase:phaseAtRequest});
      if(statsPoll.gameId===id){statsPoll.failures=0;statsPoll.nextAt=0;}
      return data;
    }catch(error){
      if(summaryResponse)dataLogInvalid(summaryResponse,error);
      if(statsPoll.gameId===id){
        statsPoll.failures++;
        statsPoll.nextAt=Date.now()+exponentialBackoff(statsPoll.failures);
      }
      throw error;
    }finally{clearTimeout(timer);}
  })();
  viewerState.statsPending.set(id,fetchPromise);
  try{return await fetchPromise;}
  finally{if(viewerState.statsPending.get(id)===fetchPromise)viewerState.statsPending.delete(id);}
}
  return {fetchGameSummary};
}
