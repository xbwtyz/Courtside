  function classify(game){const s=game.status?.type?.state ?? game.competitions?.[0]?.status?.type?.state;return s==='in'?'live':s==='post'?'final':'upcoming';}
  function parseGames(json){
    if (!json || !Array.isArray(json.events)) throw new Error('Unexpected data format from the scoreboard provider.');
    return json.events.map(g=>({...g,_phase:classify(g)}));
  }
  function updateStatus(){
    const limited=Date.now()<espnPoll.sharedUntil;
    const connected=state.lastUpdated && !state.error && !limited;
    $('connection').innerHTML=`<span class="dot ${state.loading?'loading':connected?'':'error'}"></span>${state.loading?'UPDATING SCORES':limited?'ESPN RATE LIMITED':connected?'LIVE DATA CONNECTED':'DATA UNAVAILABLE'}`;
    $('updated').textContent=state.lastUpdated?`Last updated ${state.lastUpdated.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',second:'2-digit'})}${state.error||limited?' · cached scores':''}`:'Waiting for first update…';
    $('refreshBtn').classList.toggle('spin',state.loading);
    $('refreshBtn').disabled=state.loading;
    const countdown=ms=>`${Math.max(0,Math.ceil((ms-Date.now())/1000))}s`;
    const scoreText=!Number.isFinite(state.nextAt)?'Historical results · manual refresh':
      `Scores: ${state.games.some(g=>g._phase==='live')?'Live 10s':'Idle 60s'} · next in ${countdown(Math.max(state.nextAt,espnPoll.sharedUntil))}`;
    const statsDue=selectedStatsDueAt();
    const statsText=$('viewer').hidden||!viewerState.statsOpen||!viewerState.gameId?'Game Center: inactive':
      !Number.isFinite(statsDue)?'Game Center: final · manual refresh':
      `Game Center: next in ${countdown(statsDue)}`;
    const cooldown=limited?`\nESPN cooling down: ${countdown(espnPoll.sharedUntil)} remaining`:'';
    $('nextRefresh').textContent=`${scoreText}\n${statsText}${cooldown}`;
  }
  async function fetchScores(force=false){
    // Ordinary ticks never cancel an existing request; selecting a different date may.
    if(state.loading){
      if(state.fetchDate===state.date)return;
      if(state.controller)state.controller.abort();
    }
    if(Date.now()<espnPoll.sharedUntil){
      alertsResetBaseline();
      state.nextAt=Math.max(state.nextAt,espnPoll.sharedUntil);
      if(force){state.error='ESPN has temporarily rate-limited requests. Waiting before retrying.';state.firstLoaded=true;render();}
      updateStatus();
      return;
    }
    if(!force&&!Number.isFinite(state.nextAt))return;
    const seq=++state.requestSeq;
    const controller=new AbortController();state.controller=controller;
    let timer;
    state.loading=true;state.error='';state.fetchDate=state.date;updateStatus();
    const requested=state.date;
    let scoreResponse=null;
    try{
      const endpoint=`${API}?dates=${requested.replaceAll('-','')}&limit=100`;
      const json=await auditESPNJob({source:'Scoreboard',resource:requested,url:endpoint,priority:0},async report=>{
        if(controller.signal.aborted)throw new DOMException('Score request cancelled','AbortError');
        if(Date.now()<espnPoll.sharedUntil)throw new Error('ESPN rate limit cooldown in progress');
        timer=setTimeout(()=>controller.abort(),14000);
        const res=await fetch(endpoint,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
        report(res);
        if(!res.ok){noteEspnResponseError(res,'scores');throw new Error(`Score provider returned HTTP ${res.status}.`);}
        return await res.json();
      });
      if(seq!==state.requestSeq)return;
      scoreResponse=json;
      gameStore.replaceGames(parseGames(json));
      dataLogObserve(json,`scores:${requested}`,()=>dataLogScoreRecords(state.games));
      try{alertsObserveScoreboard(state.games,requested);}catch(error){console.warn('Courtside alert comparison skipped:',error);}
      seedTeamDirectoryFromScores();
      state.lastUpdated=new Date();state.firstLoaded=true;state.error='';
      espnPoll.scoreFailures=0;
      render();
      renderTickers();
      if(!$('viewer').hidden){updateLiveGamePicker();paintViewer();}
    }catch(err){
      if(seq!==state.requestSeq)return;
      if(scoreResponse)dataLogInvalid(scoreResponse,err);
      espnPoll.scoreFailures++;
      alertsResetBaseline();
      state.error=err.name==='AbortError'?'The request timed out. Please retry.':err.message;
      state.firstLoaded=true;
      render();
    }finally{
      clearTimeout(timer);
      if(seq===state.requestSeq){
        state.loading=false;state.controller=null;state.fetchDate=null;
        state.nextAt=Number.isFinite(scoresRefreshMs())?Date.now()+(state.error?exponentialBackoff(espnPoll.scoreFailures):scoresRefreshMs()):Infinity;
        state.nextAt=Math.max(state.nextAt,espnPoll.sharedUntil);
        updateStatus();
      }
    }
  }
  function changeDay(offset){const d=dateFromString(state.date);d.setDate(d.getDate()+offset);selectDay(fmtDate(d));}
  function selectDay(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return;alertsResetBaseline();gameStore.selectDate(day);$('datePicker').value=day;render();renderTickers();fetchScores(true);}
