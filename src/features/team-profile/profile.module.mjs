/** Team profile requests, schedule/roster normalization and accessible dialog lifecycle. */
export function createTeamProfile({$,document,Date,Number,String,Array,getState,profileState,teamDirectory,standingsState,TEAM_API,TEAM_DETAILS_TTL_MS,safe,safeLogo,simpleId,statNumber,standStat,fetchFeatureJson,dataLogObserve,dataLogTeamRecords,dataLogInvalid,fetchStandings,teamLogoMarkup}){
  function profileTeam(){
    const id=profileState.id;
    return teamDirectory.get(id)||{id,name:`NBA Team ${id}`,abbr:'NBA',values:{},logo:''};
  }
  function profileSeasonYear(){
    if(standingsState.season)return standingsState.season;
    const d=new Date();return d.getFullYear()+(d.getMonth()>=8?1:0);
  }
  async function fetchTeamData(kind,force=false){
    if(!profileState.id)return;
    const id=profileState.id,season=profileSeasonYear(),key=`${id}|${kind}|${kind==='schedule'?season:''}`;
    const cached=profileState.cache.get(key);
    if(!force&&cached?.data&&Date.now()-cached.at<TEAM_DETAILS_TTL_MS)return cached.data;
    if(!force&&cached?.error&&Date.now()-cached.at<30000)return cached.data;
    if(profileState.pending.has(key))return profileState.pending.get(key);
    const url=kind==='roster'?`${TEAM_API}/${id}/roster`:`${TEAM_API}/${id}/schedule?season=${season}&limit=100`;
    const request=(async()=>{
      let teamResponse=null;
      try{
        const data=await fetchFeatureJson(url);
        teamResponse=data;
        if(!data||typeof data!=='object')throw new Error('Unexpected team data');
        dataLogObserve(data,`team:${id}:${kind}:${kind==='schedule'?season:''}`,()=>dataLogTeamRecords(kind,data,id));
        profileState.cache.set(key,{at:Date.now(),data,error:''});
        return data;
      }catch(error){
        if(teamResponse)dataLogInvalid(teamResponse,error);
        profileState.cache.set(key,{at:Date.now(),data:cached?.data||null,error:error?.message||'Unable to reach ESPN'});
        return cached?.data||null;
      }
    })();
    profileState.pending.set(key,request);
    try{return await request;}finally{
      if(profileState.pending.get(key)===request)profileState.pending.delete(key);
      if(profileState.id===id&&!$('teamProfileModal').hidden)renderTeamProfile();
    }
  }
  function cachedTeamData(kind){
    const key=`${profileState.id}|${kind}|${kind==='schedule'?profileSeasonYear():''}`;
    return {key,entry:profileState.cache.get(key),loading:profileState.pending.has(key)};
  }
  function profileMetrics(team){
    const v=team.values||{};
    const record=standStat(v,'wins')!=='—'?`${standStat(v,'wins')}–${standStat(v,'losses')}`:(team.fallbackRecord||'—');
    const rank=team.conference?`${team.rank||'—'} / 15`:'—';
    const metrics=[['Record',record],['Conference rank',rank],['Last 10',standStat(v,'lastTenGames','lastTen','last10')],['Streak',standStat(v,'streak')]];
    return `<div class="cs-profile-metrics">${metrics.map(([label,value])=>`<div class="cs-profile-metric"><strong>${safe(value)}</strong><span>${safe(label)}</span></div>`).join('')}</div>`;
  }
  // ESPN's team schedule returns scores as either primitives or objects
  // (for example { value: 105, displayValue: "105" }). Never stringify the
  // object itself, which would display "[object Object]" in the schedule.
  function scheduleScoreNumber(score){
    for(let i=0;i<3&&score!==null&&typeof score==='object';i++){
      score=score.value??score.displayValue??score.score??score.total??null;
    }
    if(score===null||score===undefined||score==='')return null;
    if(typeof score==='string'&&!/^\d+(?:\.\d+)?$/.test(score.trim()))return null;
    const number=Number(score);
    return Number.isFinite(number)&&number>=0?number:null;
  }
  function parseTeamSchedule(payload,teamId){
    const events=Array.isArray(payload?.events)?payload.events:Array.isArray(payload?.schedule?.events)?payload.schedule.events:[];
    return events.map(event=>{
      const comp=event.competitions?.[0]||{},teams=comp.competitors||[];
      const ours=teams.find(c=>String(c.team?.id||c.id)===teamId),opp=teams.find(c=>String(c.team?.id||c.id)!==teamId);
      const date=new Date(event.date||comp.date||'');
      if(Number.isNaN(date.getTime()))return null;
      const state=event.status?.type?.state||comp.status?.type?.state||'';
      const complete=state==='post'||event.status?.type?.completed===true||comp.status?.type?.completed===true;
      const homeAway=ours?.homeAway||'unknown';
      const other=opp?.team?.shortDisplayName||opp?.team?.displayName||opp?.team?.abbreviation||event.shortName||event.name||'Opponent';
      const ourPoints=scheduleScoreNumber(ours?.score);
      const theirPoints=scheduleScoreNumber(opp?.score);
      const hasFinalScore=complete&&ourPoints!==null&&theirPoints!==null;
      const score=hasFinalScore?`${ourPoints}–${theirPoints}`:'';
      const won=hasFinalScore?(ourPoints===theirPoints?null:ourPoints>theirPoints):null;
      return {id:simpleId(event.id),date,complete,homeAway,other,score,won};
    }).filter(Boolean).sort((a,b)=>a.date-b.date);
  }
  function renderScheduleTable(games){
    if(!games.length)return '<p class="cs-profile-note">No games are listed for this section yet.</p>';
    return `<div class="cs-profile-table-scroll"><table class="cs-schedule-table"><thead><tr><th>Date</th><th>Opponent</th><th>Result / time</th><th>Game</th></tr></thead><tbody>${games.map(g=>{
      const date=g.date.toLocaleDateString(undefined,{month:'short',day:'numeric',weekday:'short'});
      const result=g.complete?`${g.won===true?'W':g.won===false?'L':'Final'} ${g.score||''}`:g.date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
      const local=!!g.id&&getState().games.some(event=>String(event.id)===g.id);
      const link=g.id?`https://www.espn.com/nba/game?gameId=${g.id}`:'https://www.espn.com/nba/scoreboard';
      return `<tr><td>${safe(date)}</td><td>${g.homeAway==='away'?'@':'vs'} ${safe(g.other)}</td><td class="${g.won===true?'cs-result-win':g.won===false?'cs-result-loss':''}">${safe(result)}</td><td>${local?`<button type="button" class="cs-profile-link" data-profile-watch="${safe(g.id)}">View in Courtside</button>`:`<a href="${safe(link)}" class="cs-profile-action" target="_blank" rel="noopener noreferrer">Gamecast ↗</a>`}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function scheduleSection(overview=false){
    const {entry,loading}=cachedTeamData('schedule');
    if(!entry?.data)return `<p class="cs-profile-note">${loading?'Loading schedule from ESPN…':entry?.error?`${safe(entry.error)}. <button class="cs-profile-link" type="button" data-profile-retry="schedule">Retry schedule</button>`:'Loading team schedule…'}</p>`;
    const games=parseTeamSchedule(entry.data,profileState.id),now=new Date();
    const recent=games.filter(g=>g.complete).slice(-1*(overview?5:12)).reverse();
    const upcoming=games.filter(g=>!g.complete&&g.date>=new Date(now.getTime()-24*3600*1000)).slice(0,overview?5:15);
    return `<h3 class="cs-profile-subhead">Recent results</h3>${renderScheduleTable(recent)}<h3 class="cs-profile-subhead">Upcoming schedule</h3>${renderScheduleTable(upcoming)}`;
  }
  function rosterSection(){
    const {entry,loading}=cachedTeamData('roster');
    if(!entry?.data)return `<p class="cs-profile-note">${loading?'Loading roster from ESPN…':entry?.error?`${safe(entry.error)}. <button class="cs-profile-link" type="button" data-profile-retry="roster">Retry roster</button>`:'Loading team roster…'}</p>`;
    const source=entry.data.athletes||entry.data.players||[];
    const athletes=Array.isArray(source)?source.flatMap(group=>group?.items||group?.athletes||[group]).map(a=>a?.athlete||a).filter(Boolean):[];
    if(!athletes.length)return '<p class="cs-profile-note">No roster was included in ESPN’s response.</p>';
    athletes.sort((a,b)=>(statNumber(a.jersey)??99)-(statNumber(b.jersey)??99)||String(a.displayName||a.fullName||'').localeCompare(String(b.displayName||b.fullName||'')));
    return `<div class="cs-profile-table-scroll"><table class="cs-roster-table"><thead><tr><th>#</th><th>Player</th><th>Position</th><th>Height</th><th>Weight</th><th>Age</th></tr></thead><tbody>${athletes.map(a=>{
      const name=a.displayName||a.fullName||'Player',headshot=safeLogo(a.headshot?.href||a.headshot);
      return `<tr><td>${safe(a.jersey||'—')}</td><td><div class="cs-profile-player">${headshot?`<img src="${safe(headshot)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}${simpleId(a.id)?`<button type="button" class="cs-player-link" data-player-profile="${safe(simpleId(a.id))}" data-player-name="${safe(name)}" data-player-team="${safe(profileState.id)}" data-player-pos="${safe(a.position?.abbreviation||a.position?.displayName||'')}" data-player-jersey="${safe(a.jersey||'')}" data-player-headshot="${safe(headshot)}" data-player-height="${safe(a.displayHeight||'')}" data-player-weight="${safe(a.displayWeight||'')}" data-player-age="${safe(a.age??'')}">${safe(name)}</button>`:`<span>${safe(name)}</span>`}</div></td><td>${safe(a.position?.abbreviation||a.position?.displayName||'—')}</td><td>${safe(a.displayHeight||'—')}</td><td>${safe(a.displayWeight||'—')}</td><td>${safe(a.age??'—')}</td></tr>`;
    }).join('')}</tbody></table></div><p class="cs-profile-note">Roster is provided by ESPN and may change during the season.</p>`;
  }
  function renderTeamProfile(){
    if($('teamProfileModal').hidden||!profileState.id)return;
    const team=profileTeam();
    $('teamProfileTitle').textContent=team.name;
    $('teamProfileSubtitle').textContent=[team.conference,team.conference&&team.rank?`#${team.rank} in conference`:null,`2026–27 NBA`].filter(Boolean).join(' · ');
    $('teamProfileLogo').innerHTML=teamLogoMarkup(team,'cs-team-logo');
    for(const tab of $('teamProfileDialog').querySelectorAll('[data-profile-tab]')){
      const active=tab.dataset.profileTab===profileState.tab;
      tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
    }
    const panel=$('teamProfileContent'),scroll=panel.scrollTop;
    if(profileState.tab==='roster')panel.innerHTML=`<h3 class="cs-profile-subhead">${safe(team.name)} Roster</h3>${rosterSection()}`;
    else if(profileState.tab==='schedule')panel.innerHTML=scheduleSection();
    else panel.innerHTML=`${profileMetrics(team)}<p class="cs-profile-note">Season record and rankings come from ESPN's conference standings.</p>${scheduleSection(true)}`;
    panel.scrollTop=scroll;
  }
  function selectTeamProfileTab(tab){
    if(!['overview','roster','schedule'].includes(tab))return;
    profileState.tab=tab;$('teamProfileContent').scrollTop=0;
    renderTeamProfile();fetchTeamData(tab==='roster'?'roster':'schedule');
  }
  function openTeamProfile(id){
    id=simpleId(id);if(!id)return;
    profileState.previousFocus=document.activeElement;
    profileState.id=id;profileState.tab='overview';
    $('teamProfileModal').hidden=false;document.body.classList.add('team-profile-open');
    renderTeamProfile();$('teamProfileClose').focus();
    fetchTeamData('schedule');
    if(!standingsState.at)fetchStandings();
  }
  function closeTeamProfile(){
    if($('teamProfileModal').hidden)return;
    $('teamProfileModal').hidden=true;document.body.classList.remove('team-profile-open');
    profileState.id=null;
    const previous=profileState.previousFocus;
    if(previous?.isConnected)previous.focus({preventScroll:true});
  }
  return {profileTeam,profileSeasonYear,fetchTeamData,cachedTeamData,profileMetrics,scheduleScoreNumber,parseTeamSchedule,renderScheduleTable,scheduleSection,rosterSection,renderTeamProfile,selectTeamProfileTab,openTeamProfile,closeTeamProfile};
}
