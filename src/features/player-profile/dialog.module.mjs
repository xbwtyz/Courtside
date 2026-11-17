/** Player profile modal, team handoff, current-season panels and Game Center navigation. */
export function createPlayerProfileDialog({$,document,playerState,teamDirectory,viewerState,gameStore,getState,safe,safeLogo,simpleId,profileSeasonYear,playerCached,extractPlayerStats,parsePlayerGameLog,playerDataStatus,playerProfileMetrics,playerGameLogTable,playerSeasonTable,fetchPlayerKind,closeTeamProfile,setMainView,fetchScores,render,openViewer,changeViewerGame,paintViewer}){
  function renderPlayerProfile(){
    if($('playerProfileModal').hidden||!playerState.id)return;
    const base=playerState.meta||{},overview=playerCached('overview').entry?.data;
    const athlete=overview?.athlete||overview?.player||overview?.header?.athlete||{};
    const name=base.name||athlete.displayName||athlete.fullName||`NBA Player ${playerState.id}`;
    $('playerProfileTitle').textContent=name;
    const teamId=simpleId(base.teamId||athlete.team?.id),team=teamDirectory.get(teamId);
    const teamName=team?.name||athlete.team?.displayName||athlete.team?.name||base.teamName||'NBA';
    const profilePos=base.pos||athlete.position?.abbreviation||athlete.position?.displayName||'';
    const jersey=base.jersey||athlete.jersey||'';
    const extra=[base.height||athlete.displayHeight,base.weight||athlete.displayWeight,base.age||athlete.age&&`${athlete.age} years old`].filter(Boolean).join(' · ');
    $('playerProfileSubtitle').textContent=[teamName,profilePos,jersey?`#${jersey}`:null,`${profileSeasonYear()-1}–${String(profileSeasonYear()).slice(-2)} season`,extra].filter(Boolean).join(' · ');
    const headshot=safeLogo(base.headshot||athlete.headshot?.href||athlete.headshot||'')||`https://a.espncdn.com/i/headshots/nba/players/full/${playerState.id}.png`;
    $('playerProfilePortrait').innerHTML=`<span aria-hidden="true">NBA</span><img class="cs-player-headshot" src="${safe(headshot)}" alt="" onerror="this.style.display='none'">`;
    $('playerBackTeam').hidden=!playerState.fromTeam;
    for(const tab of $('playerProfileDialog').querySelectorAll('[data-player-tab]')){
      const active=tab.dataset.playerTab===playerState.tab;
      tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
      if(active)$('playerProfileContent').setAttribute('aria-labelledby',tab.id);
    }
    const statsData=playerCached('stats').entry?.data;
    const logData=playerCached('gamelog').entry?.data;
    const stats=extractPlayerStats(statsData),rows=parsePlayerGameLog(logData);
    const panel=$('playerProfileContent'),scroll=panel.scrollTop;
    let output='';
    if(playerState.tab==='overview'){
      output=`${playerDataStatus(['stats','gamelog'])}<h3 class="cs-profile-subhead">Season averages</h3>${playerProfileMetrics(stats)}<h3 class="cs-profile-subhead">Recent performances</h3>${playerGameLogTable(rows,true)}<p class="cs-player-data-note">Only the current NBA regular season is shown. Select a date to open that game in Courtside.</p>`;
    }else if(playerState.tab==='season'){
      output=`${playerDataStatus(['stats'])}<h3 class="cs-profile-subhead">Current-season statistics</h3><p class="cs-player-season-caption">Stats provided by ESPN. Unavailable metrics display as a dash rather than zero.</p>${playerSeasonTable(stats)}`;
    }else{
      output=`${playerDataStatus(['gamelog'])}<h3 class="cs-profile-subhead">${profileSeasonYear()-1}–${String(profileSeasonYear()).slice(-2)} game log</h3>${playerGameLogTable(rows)}<p class="cs-player-data-note">Click a date to open the corresponding game's Courtside Game Center.</p>`;
    }
    panel.innerHTML=output;panel.scrollTop=scroll;
  }
  function openPlayerProfile(button){
    const id=simpleId(button?.dataset.playerProfile);if(!id)return;
    const fromTeam=!$('teamProfileModal').hidden;
    playerState.previousFocus=document.activeElement;
    playerState.fromTeam=fromTeam;
    playerState.fromTeamScroll=fromTeam?$('teamProfileContent').scrollTop:0;
    playerState.id=id;playerState.tab='overview';playerState.sort='date';playerState.sortDesc=true;
    playerState.meta={name:button.dataset.playerName||'',teamId:button.dataset.playerTeam||'',
      teamName:button.dataset.playerTeamName||'',pos:button.dataset.playerPos||'',jersey:button.dataset.playerJersey||'',
      headshot:button.dataset.playerHeadshot||'',height:button.dataset.playerHeight||'',weight:button.dataset.playerWeight||'',age:button.dataset.playerAge||''};
    if(fromTeam)$('teamProfileModal').hidden=true;
    $('playerProfileModal').hidden=false;document.body.classList.add('team-profile-open');
    renderPlayerProfile();$('playerProfileClose').focus();
    for(const kind of ['overview','stats','gamelog'])fetchPlayerKind(kind);
  }
  function closePlayerProfile(returnToTeam=true){
    if($('playerProfileModal').hidden)return;
    $('playerProfileModal').hidden=true;
    playerState.id=null;
    const focus=playerState.previousFocus;
    if(playerState.fromTeam&&returnToTeam){
      $('teamProfileModal').hidden=false;
      $('teamProfileContent').scrollTop=playerState.fromTeamScroll;
      (focus?.isConnected?focus:$('teamProfileClose')).focus({preventScroll:true});
    }else{
      document.body.classList.remove('team-profile-open');
      if(focus?.isConnected)focus.focus({preventScroll:true});
      else if(!$('viewer').hidden)$('viewerDialog').focus({preventScroll:true});
    }
    playerState.fromTeam=false;
  }
  async function playerOpenGame(gameId,day){
    gameId=simpleId(gameId);
    if(!gameId||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day))return;
    const fromTeam=playerState.fromTeam;
    closePlayerProfile(false);
    if(fromTeam){$('teamProfileModal').hidden=false;closeTeamProfile();}
    setMainView('scores');
    if(getState().date!==day){gameStore.navigateToDate(day);$('datePicker').value=day;await fetchScores(true);}
    if(!getState().games.some(g=>String(g.id)===gameId)){
      getState().error='That game could not be found in ESPN’s selected-day scoreboard. Try its ESPN Gamecast.';
      render();return;
    }
    if($('viewer').hidden)openViewer(gameId);else changeViewerGame(gameId);
    viewerState.statsTab='box';viewerState.statsOpen=true;
    paintViewer();
  }
  return {renderPlayerProfile,openPlayerProfile,closePlayerProfile,playerOpenGame};
}
