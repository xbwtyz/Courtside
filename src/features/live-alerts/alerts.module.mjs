/**
 * In-app Live Alerts, isolated from the score request scheduler and Data Log.
 * All mutable application state/preferences are accessed lazily to preserve
 * startup order and Restore Defaults object replacement semantics.
 */
export function createLiveAlerts({$,document,window,getState,getViewerState,getPrefs,today,
  classify,safe,saveSettingsPrefs,openAppSettings,openViewer,changeViewerGame,
  alert,confirm,setTimeout,clearTimeout,Date}) {
  // Courtside 1.6 — in-app alerts from already-fetched ESPN scoreboard responses.
  // Source of truth is intentionally independent from the Data Log (which may be paused).
  const ALERT_TEAMS=[
    ['1','Atlanta Hawks'],['2','Boston Celtics'],['17','Brooklyn Nets'],['30','Charlotte Hornets'],
    ['4','Chicago Bulls'],['5','Cleveland Cavaliers'],['6','Dallas Mavericks'],['7','Denver Nuggets'],
    ['8','Detroit Pistons'],['9','Golden State Warriors'],['10','Houston Rockets'],['11','Indiana Pacers'],
    ['12','Los Angeles Clippers'],['13','Los Angeles Lakers'],['29','Memphis Grizzlies'],['14','Miami Heat'],
    ['15','Milwaukee Bucks'],['16','Minnesota Timberwolves'],['3','New Orleans Pelicans'],
    ['18','New York Knicks'],['25','Oklahoma City Thunder'],['19','Orlando Magic'],
    ['20','Philadelphia 76ers'],['21','Phoenix Suns'],['22','Portland Trail Blazers'],
    ['23','Sacramento Kings'],['24','San Antonio Spurs'],['28','Toronto Raptors'],
    ['26','Utah Jazz'],['27','Washington Wizards']
  ];
  const ALERT_TOAST_DURATION=8000,ALERT_HISTORY_LIMIT=50,ALERT_LEAD_COOLDOWN=60000;
  const alertsState={baselineDate:null,seen:new Map(),dedupe:new Set(),leadAt:new Map(),
    history:[],visible:[],sequence:0,needsBaseline:true,historyOpen:false,returnFocus:null,audio:null,lastSoundAt:0};
  const alertIsActive=()=>!document.hidden && getState().date===today() && getPrefs().alertsEnabled;
  const alertShouldOverlay=()=>$('viewer').hidden||getPrefs().alertsOverlay;
  function alertsResetBaseline(){alertsState.needsBaseline=true;alertsState.seen.clear();alertsState.baselineDate=null;}
  function alertsScore(game){
    const comps=game?.competitions?.[0]?.competitors||[];
    const away=comps.find(c=>c.homeAway==='away'),home=comps.find(c=>c.homeAway==='home');
    const score=c=>c?.score!==undefined&&c?.score!==null&&c?.score!==''&&Number.isFinite(Number(c.score))?Number(c.score):null;
    const period=Number(game.status?.period??game.competitions?.[0]?.status?.period??0);
    const clock=String(game.status?.displayClock??game.competitions?.[0]?.status?.displayClock??'').trim();
    let seconds=null;
    if(/^\d{1,2}:\d{2}(?:\.\d+)?$/.test(clock)){
      const [min,sec]=clock.split(':').map(Number);if(sec<60)seconds=min*60+sec;
    }else if(/^\d+(?:\.\d+)?$/.test(clock))seconds=Number(clock);
    const detail=[game.status?.type?.name,game.status?.type?.shortDetail,game.status?.type?.description,
      game.status?.type?.detail,game.status?.type?.displayName,game.status?.type?.state,
      game.status?.type?.shortName,game.status?.type?.name].filter(Boolean).join(' ');
    const halftime=/half[\s_-]*time|halftime|half-time|STATUS_HALFTIME/i.test(detail);
    const a=score(away),h=score(home),leader=a===null||h===null||a===h?0:(a>h?1:2);
    const phase=game._phase||classify(game);
    const teamIds=[String(away?.team?.id||''),String(home?.team?.id||'')];
    const awayName=away?.team?.abbreviation||away?.team?.displayName||'AWAY',homeName=home?.team?.abbreviation||home?.team?.displayName||'HOME';
    return {id:String(game.id||''),phase,period,seconds,halftime,away:a,home:h,leader,
      teamIds,awayName,homeName,scoreLabel:`${awayName} ${a??'—'} — ${homeName} ${h??'—'}`};
  }
  function alertsWatchGame(game){
    if(getPrefs().alertsScope!=='selected')return true;
    const ids=new Set(getPrefs().alertsTeams);
    return ids.size>0 && game.teamIds.some(id=>ids.has(id));
  }
  function alertsAdd(kind,game,detail,period){
    if(!alertsWatchGame(game)||!getPrefs()['alerts'+kind])return;
    const key=`${game.id}|${kind}${kind==='Close'?`|${period}`:''}`;
    if(kind!=='Lead'&&alertsState.dedupe.has(key))return;
    const now=Date.now();
    if(kind==='Lead'&&now-(alertsState.leadAt.get(game.id)??-Infinity)<ALERT_LEAD_COOLDOWN)return;
    if(kind==='Lead')alertsState.leadAt.set(game.id,now);
    else alertsState.dedupe.add(key);
    const labels={Start:'Game Started',Halftime:'Halftime',Final:'Final Score',Lead:'Lead Change',Close:'Close Game'};
    const item={id:++alertsState.sequence,kind,title:labels[kind],gameId:game.id,
      score:game.scoreLabel,detail,date:getState().date,at:now,read:false};
    alertsState.history.unshift(item);
    if(alertsState.history.length>ALERT_HISTORY_LIMIT)alertsState.history.length=ALERT_HISTORY_LIMIT;
    if(alertShouldOverlay()&&$('appSettingsModal').hidden&&!alertsState.historyOpen){
      // Toast visibility is also gated by the modal and viewer at render time.
      alertsState.visible.unshift(item);
      while(alertsState.visible.length>3)alertsDismissToast(alertsState.visible[3].id);
      alertsRenderToasts();
      alertsMaybeSound();
    }
    alertsUpdateBells();
    if(alertsState.historyOpen)alertsRenderHistory();
  }
  function alertsObserveScoreboard(games,requestedDate=getState().date){
    if(!Array.isArray(games))return;
    // No activity for hidden tabs, past/future date views, or disabled alerts.
    if(!alertIsActive()||requestedDate!==today()){
      alertsResetBaseline();return;
    }
    const fresh=new Map();
    for(const raw of games){
      const game=alertsScore(raw);
      if(game.id)fresh.set(game.id,game);
    }
    if(alertsState.needsBaseline||alertsState.baselineDate!==requestedDate){
      for(const game of fresh.values())game.lastLeader=game.leader;
      alertsState.seen=fresh;
      alertsState.baselineDate=requestedDate;alertsState.needsBaseline=false;
      return;
    }
    for(const [id,game] of fresh){
      const previous=alertsState.seen.get(id);
      if(!previous)continue; // Newly listed games are a new baseline, not a game start.
      if(previous.phase==='upcoming'&&game.phase==='live')alertsAdd('Start',game,'The game is underway.');
      if(game.halftime&&!previous.halftime)alertsAdd('Halftime',game,'ESPN reports halftime.');
      if(previous.phase==='live'&&game.phase==='final')alertsAdd('Final',game,'The game has finished.');
      // Track the last outright leader through ties; don't call a tie a lead change.
      if(game.phase==='live'&&game.period>=4&&game.leader&&previous.lastLeader&&
          game.leader!==previous.lastLeader){
        alertsAdd('Lead',game,'A different team has taken the lead in the fourth quarter or overtime.');
      }
      const alreadyClose=previous.phase==='live'&&previous.period===game.period&&previous.seconds!==null&&
        previous.seconds>=0&&previous.seconds<=120&&previous.away!==null&&previous.home!==null&&
        Math.abs(previous.away-previous.home)<=3;
      if(!alreadyClose&&game.phase==='live'&&game.period>=4&&game.seconds!==null&&game.seconds>=0&&game.seconds<=120&&
          game.away!==null&&game.home!==null&&Math.abs(game.away-game.home)<=3){
        alertsAdd('Close',game,`${Math.abs(game.away-game.home)}-point margin with ${Math.floor(game.seconds/60)}:${String(Math.floor(game.seconds%60)).padStart(2,'0')} remaining.`,game.period);
      }
    }
    // Preserve the preceding last non-tied leader (and period) to detect tie -> new leader.
    for(const [id,game] of fresh){
      const prev=alertsState.seen.get(id);
      game.lastLeader=game.leader||prev?.lastLeader||0;
    }
    alertsState.seen=fresh;
    alertsState.baselineDate=requestedDate;
  }
  function alertsUpdateToastVisibility(){
    $('alertsToasts').hidden=!alertShouldOverlay()||!$('appSettingsModal').hidden||alertsState.historyOpen;
  }
  function alertsRenderToasts(){
    const wrap=$('alertsToasts');
    alertsUpdateToastVisibility();
    wrap.innerHTML=alertsState.visible.map(item=>`<article class="cs-alert-toast" data-alert-id="${item.id}" aria-label="${safe(item.title)}">
      <div class="cs-alert-toast-top"><span class="cs-alert-kind">${safe(item.title)}</span><button class="cs-alert-dismiss" type="button" data-alert-dismiss="${item.id}" aria-label="Dismiss ${safe(item.title)}">×</button></div>
      <h3>${safe(item.score)}</h3><p>${safe(item.detail)}</p>
      <div class="cs-alert-toast-actions"><button class="control" type="button" data-alert-game="${safe(item.gameId)}">View Game</button></div>
    </article>`).join('');
    for(const item of alertsState.visible){
      const box=wrap.querySelector(`[data-alert-id="${item.id}"]`);
      if(box){
        box.addEventListener('mouseenter',()=>alertsPauseToast(item));
        box.addEventListener('mouseleave',()=>alertsScheduleToast(item));
        box.addEventListener('focusin',()=>alertsPauseToast(item));
        box.addEventListener('focusout',e=>{if(!box.contains(e.relatedTarget))alertsScheduleToast(item);});
        if(box.matches(':hover')||box.contains(document.activeElement))alertsPauseToast(item);
        else if(!item.timer)alertsScheduleToast(item);
      }
    }
  }
  function alertsPauseToast(item){clearTimeout(item.timer);item.timer=null;}
  function alertsScheduleToast(item){
    alertsPauseToast(item);
    item.timer=setTimeout(()=>alertsDismissToast(item.id),ALERT_TOAST_DURATION);
  }
  function alertsDismissToast(id){
    const index=alertsState.visible.findIndex(x=>x.id===id);
    if(index<0)return;
    alertsPauseToast(alertsState.visible[index]);alertsState.visible.splice(index,1);
    alertsRenderToasts();
  }
  function alertsUpdateBells(){
    const unread=alertsState.history.filter(x=>!x.read).length;
    for(const id of ['alertsMainBell','alertsViewerBell']){
      const bell=$(id),count=bell?.querySelector('.cs-alert-bell-count');
      if(!bell||!count)continue;
      count.hidden=!unread;count.textContent=unread>99?'99+':String(unread);
      bell.setAttribute('aria-label',unread?`${unread} unread game alerts. Open alert history`:'Open live game alert history');
    }
  }
  function alertsStatusText(){
    if(!getPrefs().alertsEnabled)return 'Alerts disabled · Enable in Settings → Live Alerts';
    if(document.hidden)return 'Paused while Courtside is in the background';
    if(getState().date!==today())return 'Paused · Select today on the Scores page to monitor live games';
    if(getPrefs().alertsScope==='selected'&&!getPrefs().alertsTeams.length)return 'No teams selected · Choose at least one team';
    return `Monitoring ${getPrefs().alertsScope==='all'?'all games':getPrefs().alertsTeams.length+' selected teams'} on today's scoreboard`;
  }
  function alertsRenderHistory(){
    $('alertsHistoryStatus').textContent=alertsStatusText();
    $('alertsHistoryEntries').innerHTML=alertsState.history.length?alertsState.history.map(item=>`<article class="cs-alert-history-item">
      <div class="cs-alert-kind">${safe(item.title)}</div><h3>${safe(item.score)}</h3>
      <p>${safe(item.detail)}</p><time datetime="${new Date(item.at).toISOString()}">${new Date(item.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</time>
      <button type="button" class="control" data-alert-game="${safe(item.gameId)}">View Game</button></article>`).join(''):
      '<div class="cs-log-empty">No live game alerts yet this session. Enable alerts in Settings to begin monitoring.</div>';
  }
  function alertsOpenHistory(){
    if(!$('appSettingsModal').hidden)return;
    alertsState.returnFocus=document.activeElement;
    alertsState.historyOpen=true;
    for(const item of [...alertsState.visible])alertsDismissToast(item.id);
    alertsState.history.forEach(x=>x.read=true);
    alertsUpdateBells();alertsRenderHistory();
    $('alertsHistory').hidden=false;alertsRenderToasts();$('alertsHistoryClose').focus({preventScroll:true});
  }
  function alertsCloseHistory(){
    if(!alertsState.historyOpen)return;
    $('alertsHistory').hidden=true;alertsState.historyOpen=false;
    alertsRenderToasts();
    if(alertsState.returnFocus?.isConnected)alertsState.returnFocus.focus({preventScroll:true});
    alertsState.returnFocus=null;
  }
  function alertsViewGame(id){
    const game=getState().games.find(g=>String(g.id)===String(id));
    if(!game){alert('That game is no longer available on the selected scoreboard date.');return;}
    if(!$('viewer').hidden&&getViewerState().gameId!==String(id)){
      if(!confirm('Switch the current viewer to this game? This may replace an active stream.'))return;
    }
    alertsCloseHistory();
    if($('viewer').hidden)openViewer(id);
    else if(getViewerState().gameId!==String(id))changeViewerGame(id);
    else $('viewerDialog').focus({preventScroll:true});
  }
  function alertsMaybeSound(force=false){
    if(!force&&(!getPrefs().alertsSound||!getPrefs().alertsEnabled))return;
    if(document.hidden)return;
    if(!force&&Date.now()-alertsState.lastSoundAt<2400)return;
    alertsState.lastSoundAt=Date.now();
    try{
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextClass)throw new Error('Web Audio is unavailable');
      const ctx=alertsState.audio||new AudioContextClass();alertsState.audio=ctx;
      const play=()=>{
        const gain=ctx.createGain();gain.gain.value=0;gain.connect(ctx.destination);
        const volume={low:.025,medium:.065,high:.12}[getPrefs().alertsVolume]||.025;
        for(const [i,freq] of [660,880].entries()){
          const oscillator=ctx.createOscillator();oscillator.type='sine';oscillator.frequency.value=freq;oscillator.connect(gain);
          const at=ctx.currentTime+i*.17;
          gain.gain.setValueAtTime(0,at);
          gain.gain.linearRampToValueAtTime(volume,at+.018);
          gain.gain.exponentialRampToValueAtTime(.0001,at+.145);
          oscillator.start(at);oscillator.stop(at+.15);
        }
      };
      if(ctx.state==='suspended')ctx.resume().then(play).catch(()=>{});
      else play();
    }catch(error){if(force)$('alertsSettingsStatus').textContent='Audio playback is unavailable in this browser.';}
  }
  function alertsRenderTeamChoices(){
    const query=String($('alertsTeamSearch').value||'').trim().toLowerCase();
    const selected=new Set(getPrefs().alertsTeams);
    $('alertsTeamChoices').innerHTML=ALERT_TEAMS.filter(t=>t[1].toLowerCase().includes(query)).map(([id,name])=>
      `<label><input type="checkbox" data-alert-team="${id}" ${selected.has(id)?'checked':''}>${safe(name)}</label>`).join('')||'<span class="cs-settings-note">No matching teams.</span>';
    $('alertsTeamCount').textContent=`${selected.size} of 30 teams selected${getPrefs().alertsScope==='selected'&&!selected.size?' · No alerts will fire':''}`;
  }
  function alertsSyncSettings(){
    const fields={Enabled:'alertsEnabled',Start:'alertsStart',Halftime:'alertsHalftime',Final:'alertsFinal',Lead:'alertsLead',Close:'alertsClose',Sound:'alertsSound',Overlay:'alertsOverlay'};
    for(const [id,key] of Object.entries(fields))$('settingsAlerts'+id).checked=getPrefs()[key];
    $('settingsAlertsScope').value=getPrefs().alertsScope;
    $('settingsAlertsVolume').value=getPrefs().alertsVolume;
    $('settingsAlertsVolume').disabled=!getPrefs().alertsSound;
    $('alertsTeamsContainer').hidden=getPrefs().alertsScope!=='selected';
    $('alertsSettingsStatus').textContent=alertsStatusText();
    alertsRenderTeamChoices();
  }
  function alertsInit(){
    for(const id of ['alertsMainBell','alertsViewerBell'])$(id).addEventListener('click',alertsOpenHistory);
    $('alertsHistoryClose').addEventListener('click',alertsCloseHistory);
    $('alertsHistoryBackdrop').addEventListener('click',alertsCloseHistory);
    $('alertsHistorySettings').addEventListener('click',()=>{alertsCloseHistory();openAppSettings('alerts');});
    document.addEventListener('click',event=>{
      const dismiss=event.target.closest('[data-alert-dismiss]');
      if(dismiss){alertsDismissToast(Number(dismiss.dataset.alertDismiss));return;}
      const game=event.target.closest('[data-alert-game]');
      if(game){alertsViewGame(game.dataset.alertGame);return;}
    });
    document.addEventListener('keydown',event=>{
      if(!alertsState.historyOpen||!$('appSettingsModal').hidden)return;
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();alertsCloseHistory();return;}
      if(event.key!=='Tab')return;
      const targets=[...$('alertsHistoryDialog').querySelectorAll('button:not(:disabled),input:not(:disabled)')]
        .filter(el=>el.getClientRects().length);
      if(!targets.length)return;
      const first=targets[0],last=targets[targets.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    },true);
    const controls={Enabled:'alertsEnabled',Start:'alertsStart',Halftime:'alertsHalftime',Final:'alertsFinal',Lead:'alertsLead',Close:'alertsClose',Sound:'alertsSound',Overlay:'alertsOverlay'};
    for(const [id,key] of Object.entries(controls))$('settingsAlerts'+id).addEventListener('change',event=>{
      getPrefs()[key]=event.target.checked;
      if(key==='alertsEnabled')alertsResetBaseline();
      saveSettingsPrefs();alertsSyncSettings();alertsRenderToasts();
    });
    $('settingsAlertsScope').addEventListener('change',event=>{
      getPrefs().alertsScope=event.target.value;alertsResetBaseline();saveSettingsPrefs();alertsSyncSettings();
    });
    $('settingsAlertsVolume').addEventListener('change',event=>{
      getPrefs().alertsVolume=event.target.value;saveSettingsPrefs();alertsSyncSettings();
    });
    $('alertsTeamSearch').addEventListener('input',alertsRenderTeamChoices);
    $('alertsTeamChoices').addEventListener('change',event=>{
      const input=event.target.closest('[data-alert-team]');if(!input)return;
      const teams=new Set(getPrefs().alertsTeams);
      if(input.checked)teams.add(input.dataset.alertTeam);else teams.delete(input.dataset.alertTeam);
      getPrefs().alertsTeams=[...teams];alertsResetBaseline();saveSettingsPrefs();alertsSyncSettings();
    });
    $('alertsTestSound').addEventListener('click',()=>alertsMaybeSound(true));
    document.addEventListener('visibilitychange',()=>{
      alertsResetBaseline();
      if(document.hidden){for(const item of [...alertsState.visible])alertsDismissToast(item.id);}
      if(alertsState.historyOpen)alertsRenderHistory();
    });
    alertsSyncSettings();alertsUpdateBells();
  }
  return {
    ALERT_TEAMS,
    ALERT_TOAST_DURATION,
    ALERT_HISTORY_LIMIT,
    ALERT_LEAD_COOLDOWN,
    alertsState,
    alertIsActive,
    alertShouldOverlay,
    alertsResetBaseline,
    alertsScore,
    alertsWatchGame,
    alertsAdd,
    alertsObserveScoreboard,
    alertsUpdateToastVisibility,
    alertsRenderToasts,
    alertsPauseToast,
    alertsScheduleToast,
    alertsDismissToast,
    alertsUpdateBells,
    alertsStatusText,
    alertsRenderHistory,
    alertsOpenHistory,
    alertsCloseHistory,
    alertsViewGame,
    alertsMaybeSound,
    alertsRenderTeamChoices,
    alertsSyncSettings,
    alertsInit
  };
}
