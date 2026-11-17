/** League Leaders accessible controls, tie-aware rankings, table DOM preservation and visual status. */
export function createLeagueLeadersRender({$,document,Date,Math,Number,String,Object,Array,Set,leaderState,leaderStats,leaderCategorySpec,NBA_TEAMS,leaderClean,leaderVolumeMinimum,leaderMetricValue,profileSeasonYear,safe,patchGameDOM}){
  function leaderFiltered(){
    const s=leaderState,volume=leaderVolumeMinimum(),g=s.games,m=s.minutes;
    const pool=s.players.filter(p=>{
      if(s.team!=='all'&&p.teamId!==s.team)return false;
      if(s.position!=='all'&&!p.pos.includes(s.position))return false;
      if(!(p.v.gp!==null&&p.v.gp>=g))return false;
      if(m>0&&!(p.v.mpg!==null&&p.v.mpg>=m))return false;
      if(volume.on&&!(p.v[volume.attempt]!==null&&p.v[volume.attempt]>=volume.min))return false;
      return true;
    });
    // Missing values are always last, regardless of ascending/descending order.
    pool.sort((a,b)=>{
      const x=leaderMetricValue(a,s.metric),y=leaderMetricValue(b,s.metric);
      if(x===null&&y===null)return a.name.localeCompare(b.name);
      if(x===null)return 1;if(y===null)return -1;
      if(x!==y)return (s.desc?y-x:x-y);
      return a.name.localeCompare(b.name);
    });
    let rank=0,lastValue=null,seen=0;
    const ranked=pool.map(p=>{
      seen++;const v=leaderMetricValue(p,s.metric);
      if(v===null)return {...p,rank:null};
      if(lastValue===null||Math.abs(v-lastValue)>1e-9)rank=seen;
      lastValue=v;
      return {...p,rank};
    });
    const q=leaderClean(s.query);
    return {ranked,visible:q?ranked.filter(p=>leaderClean(p.name).includes(q)):ranked};
  }
  function leaderFormat(p,key){
    const n=leaderMetricValue(p,key);if(n===null)return '—';
    if(['gp','points','assists','turnovers','rebounds','dd','td','steals','blocks','minutes'].includes(key))return Math.round(n).toLocaleString();
    if(['fgPct','threePct','ftPct'].includes(key))return n.toFixed(1)+'%';
    return n.toFixed(key==='astto'?2:1);
  }
  // Static controls are mounted once. Refreshes update only the selected state,
  // preserving focused buttons and the caret while typing search/custom values.
  let leaderControlsInitialized=false,leaderControlsCategory=null;
  function leaderSyncSelect(id,value){
    const el=$(id),next=String(value);
    if(el.value!==next && document.activeElement!==el)el.value=next;
  }
  function leaderRenderControls(){
    const s=leaderState,spec=leaderCategorySpec[s.category];
    $('leadersSeasonHeading').textContent=`${profileSeasonYear()-1}–${String(profileSeasonYear()).slice(-2)} · NBA REGULAR SEASON`;
    if(!leaderControlsInitialized){
      $('leadersCategories').innerHTML=Object.entries(leaderCategorySpec).map(([key,c])=>`<button class="cs-leader-cat" type="button" data-leader-category="${key}">${safe(c.label)}</button>`).join('');
      $('leadersTeam').innerHTML='<option value="all">All 30 teams</option>'+NBA_TEAMS.slice().sort((a,b)=>a[2].localeCompare(b[2])).map(([id,abbr,name])=>`<option value="${id}">${safe(name)}</option>`).join('');
      leaderControlsInitialized=true;
    }
    for(const button of $('leadersCategories').querySelectorAll('[data-leader-category]'))
      button.setAttribute('aria-pressed',String(button.dataset.leaderCategory===s.category));
    if(leaderControlsCategory!==s.category){
      $('leadersMetric').innerHTML=[...new Set([...spec.options,...spec.columns])].map(k=>`<option value="${k}">${safe(leaderStats[k].label)}</option>`).join('');
      leaderControlsCategory=s.category;
    }
    leaderSyncSelect('leadersMetric',s.metric);
    leaderSyncSelect('leadersTeam',s.team);
    leaderSyncSelect('leadersPosition',s.position);
    leaderSyncSelect('leadersVolume',s.volume);
    $('leadersVolumeWrap').hidden=!['fgPct','threePct','ftPct'].includes(s.metric);
    $('leadersVolumeCustomWrap').hidden=$('leadersVolumeWrap').hidden||s.volume!=='custom';
    leaderSyncSelect('leadersGames',!s.gamesCustom&&[0,5,10,15,20].includes(s.games)?s.games:'custom');
    $('leadersGamesCustomWrap').hidden=$('leadersGames').value!=='custom';
    leaderSyncSelect('leadersMinutes',!s.minutesCustom&&[0,10,15,20,25].includes(s.minutes)?s.minutes:'custom');
    $('leadersMinutesCustomWrap').hidden=$('leadersMinutes').value!=='custom';
    leaderSyncSelect('leadersGamesCustom',s.games);
    leaderSyncSelect('leadersMinutesCustom',s.minutes);
    leaderSyncSelect('leadersVolumeCustom',s.volumeCustom);
    leaderSyncSelect('leadersRows',s.rows);
    if(document.activeElement!==$('leadersSearch')&&$('leadersSearch').value!==s.query)$('leadersSearch').value=s.query;
  }
  function leaderUpdateStatus(){
    const s=leaderState,stamp=s.at?new Date(s.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
    let message=s.loading?`${s.progress}${s.at?' · Displaying previous complete cache.':''}`:
      s.error?`${s.error}${stamp?` · Showing complete cached data from ${stamp}.`:''}`:
      s.at?`✓ Complete ESPN response · ${s.dataCount} player entries · last updated ${stamp} · cache 30 minutes.`:
      'Select League Leaders to request ESPN statistics.';
    const status=$('leadersProgress');status.textContent=message;
    status.className='cs-leaders-progress'+(s.error?' cs-error':s.at&&!s.loading?' cs-ok':'');
    $('leadersRefresh').disabled=s.loading;
    $('leadersSummary').innerHTML=s.at?
      `<span class="cs-leader-chip"><b>${s.dataCount}</b> ESPN-listed players</span><span class="cs-leader-chip"><b>30</b> teams</span><span class="cs-leader-chip"><b>${s.season-1}–${String(s.season).slice(-2)}</b> regular season</span>`:'';
  }
  let leaderLastTableKey=null;
  function renderLeaders(){
    leaderRenderControls();leaderUpdateStatus();
    const s=leaderState,spec=leaderCategorySpec[s.category];
    // Loading progress and rate-limit status are not reasons to rebuild rows.
    const tableKey=JSON.stringify([s.at,s.season,s.category,s.metric,s.desc,s.team,s.position,s.games,s.minutes,s.volume,s.volumeCustom,s.query,s.rows,s.page,!s.at&&s.loading,!s.at&&s.error]);
    if(leaderLastTableKey===tableKey){leaderUpdateCaution();return;}
    leaderLastTableKey=tableKey;
    const scroller=$('leadersTableScroll'),left=scroller.scrollLeft;
    let {ranked,visible}=leaderFiltered();
    const statFields=spec.columns;
    const cols=[['rank','#'],['name','PLAYER'],['team','TEAM'],...statFields.map(key=>[key,leaderStats[key].label])];
    const nextHead=`<thead id="leadersTableHead"><tr>${cols.map(([key,title])=>{
      if(key==='rank'||key==='name'||key==='team')return `<th scope="col">${title}</th>`;
      const active=s.metric===key;
      return `<th scope="col"${active?` aria-sort="${s.desc?'descending':'ascending'}"`:''}><button type="button" data-leader-sort="${key}" title="Sort by ${safe(title)}">${safe(title)} ${active?(s.desc?'▼':'▲'):''}</button></th>`;
    }).join('')}</tr></thead>`;
    const headTemplate=document.createElement('table');headTemplate.innerHTML=nextHead;
    patchGameDOM($('leadersTableHead'),headTemplate.querySelector('thead'));
    const nPages=Math.max(1,Math.ceil(visible.length/s.rows));s.page=Math.min(s.page,nPages);
    const start=(s.page-1)*s.rows,chunk=visible.slice(start,start+s.rows);
    $('leadersTableBody').innerHTML=s.at?chunk.map(p=>{
      const head=p.headshot?`<img class="cs-leader-avatar" loading="lazy" src="${safe(p.headshot)}" alt="" onerror="this.style.visibility='hidden'">`:'<span class="cs-leader-avatar"></span>';
      const profile=`data-player-profile="${safe(p.id)}" data-player-name="${safe(p.name)}" data-player-team="${safe(p.teamId)}" data-player-team-name="${safe(p.teamName)}" data-player-pos="${safe(p.pos)}" data-player-jersey="${safe(p.jersey)}" data-player-headshot="${safe(p.headshot)}"`;
      const team=p.teamId?`<button class="cs-leader-team" type="button" data-team-profile="${safe(p.teamId)}" title="${safe(p.teamName)}">${safe(p.teamAbbr||p.teamName||'—')}</button>`:safe(p.teamAbbr||'—');
      return `<tr><td class="cs-leader-rank">${p.rank??'—'}</td><td><div class="cs-leader-player">${head}<div class="cs-leader-person"><button type="button" ${profile}>${safe(p.name)}</button><small>${safe(p.pos||'NBA Player')}</small></div></div></td><td>${team}</td>${statFields.map(key=>`<td class="${key===s.metric?'cs-leader-accent':''}">${safe(leaderFormat(p,key))}</td>`).join('')}</tr>`;
    }).join(''):`<tr><td colspan="${cols.length}" style="text-align:center;padding:45px;color:#acb6c6">${s.error?'Unable to load complete league-wide data. Check the status above.':s.loading?'Validating all ESPN pages...':'Open this tab to load NBA statistics.'}</td></tr>`;
    if(s.at&&!chunk.length)$('leadersTableBody').innerHTML=`<tr><td colspan="${cols.length}" style="text-align:center;padding:40px;color:#abb5c2">No players matched these filters. Try lowering minimum games, minutes, or shooting volume.</td></tr>`;
    $('leadersResults').textContent=s.at?`${visible.length} matching · ${ranked.length} eligible from ${s.dataCount} ESPN-listed players · ranking by ${leaderStats[s.metric].label} ${s.desc?'↓':'↑'}`:'Rankings will appear after ESPN pagination is validated.';
    $('leadersPaging').innerHTML=s.at?`<span>Page ${s.page} of ${nPages} · ${visible.length?start+1:0}–${Math.min(start+s.rows,visible.length)} of ${visible.length}</span><div><button type="button" data-leader-page="prev" ${s.page===1?'disabled':''}>← Previous</button> <button type="button" data-leader-page="next" ${s.page===nPages?'disabled':''}>Next →</button></div>`:'';
    scroller.scrollLeft=left;
    leaderUpdateCaution();
  }
  function leaderUpdateCaution(){
    const s=leaderState;
    $('leadersCaution').textContent='Coverage: every player in ESPN’s completed, paginated statistics response — not independently verified against all NBA rosters. Stats and eligibility may differ from NBA official leader qualifications. Season and completeness checks prevent publishing incomplete responses. Percentages use full supplied precision. ' +(s.at&&s.missingMetrics.length?'ESPN has no usable values for: '+s.missingMetrics.map(k=>leaderStats[k].label).join(', ')+'. ':'')+(s.at&&s.missingTeamCount?`${s.missingTeamCount} ESPN entries lack team IDs and cannot match a team-specific filter. `:'')+(s.error&&s.at?'Refresh failed: showing the last complete dataset.':'');
  }
  function leaderSetCategory(category){
    if(!leaderCategorySpec[category])return;
    leaderState.category=category;leaderState.metric=leaderCategorySpec[category].options[0];leaderState.desc=true;leaderState.page=1;renderLeaders();
  }
  function leaderSetSort(key,flip=false){
    if(!leaderStats[key])return;
    if(flip&&leaderState.metric===key)leaderState.desc=!leaderState.desc;
    else{leaderState.metric=key;leaderState.desc=true;}
    leaderState.page=1;renderLeaders();
  }
  return {leaderFiltered,leaderFormat,leaderSyncSelect,leaderRenderControls,leaderUpdateStatus,renderLeaders,leaderUpdateCaution,leaderSetCategory,leaderSetSort};
}
