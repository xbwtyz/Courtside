/** Original Game Center player box scores and team/overview presentation. */
export function createGameCenterBoxScore({viewerState,safe,safeLogo,simpleId,getStatus,Date,Set}){
function gameStatValues(summary){
  const rows=summary?.boxscore?.teams||[];
  const result={};
  for(const team of rows){
    const key=team.homeAway||((team.team?.homeAway)||'');
    const abbr=team.team?.abbreviation||'';
    const stats={};
    for(const stat of team.statistics||[]){
      const k=String(stat.name||stat.label||'').toLowerCase().replace(/[^a-z0-9]/g,'');
      stats[k]=stat.displayValue??stat.value;
    }
    result[key||abbr]=stats;
  }
  return result;
}
function findSummaryStat(statMap,keys){
  for(const k of keys){const v=statMap?.[k];if(v!==undefined && v!==null && v!=='')return String(v);}
  return '—';
}

// The columns match the approved mockup. The compact table keeps the six
// essential stats; wide mode displays the entire player box score.
const BOX_COLUMNS=[
  ['name','PLAYER'],['min','MIN'],['pts','PTS'],['reb','REB'],['ast','AST'],
  ['fg','FG'],['tp','3PT'],['ft','FT'],['stl','STL'],['blk','BLK'],
  ['to','TO'],['pf','PF'],['pm','+/-']
];
const COMPACT_BOX_KEYS=new Set(['name','min','pts','reb','ast','pm']);
const boxKeyAliases={
  min:['min','minutes'],pts:['pts','points'],reb:['reb','rebounds','totalrebounds'],
  ast:['ast','assists'],fg:['fg','fieldgoalsmadefieldgoalsattempted','fieldgoalsmadeattempted'],
  tp:['3pt','3p','threepointfieldgoalsmadeattempted','threepointfieldgoalsmadethreepointfieldgoalsattempted','threepointfieldgoals','threepointfieldgoalsmadethreepointfieldgoalsattempted'],
  ft:['ft','freethrowsmadefreethrowsattempted','freethrowsmadeattempted'],
  stl:['stl','steals'],blk:['blk','blocks'],to:['to','turnovers','totalturnovers'],
  pf:['pf','fouls','personalfouls'],pm:['+/-','plusminus','plusminusrating']
};
function normalizeBoxKey(value){
  const s=String(value??'').toLowerCase().trim();
  return s==='+/-'||s==='±'?'plusminus':s.replace(/[^a-z0-9]/g,'');
}
function boxStatKey(...candidateNames){
  for(const candidate of candidateNames){
    const key=normalizeBoxKey(candidate);
    if(!key)continue;
    for(const [col,aliases] of Object.entries(boxKeyAliases)){
      if(aliases.some(a=>normalizeBoxKey(a)===key))return col;
    }
  }
  return null;
}
function parsePlayerBoxscore(summary){
  // ESPN's boxscore.players is an array of team groups. Each group contains
  // statistics[].athletes plus parallel keys / labels / names and stats values.
  const groups=Array.isArray(summary?.boxscore?.players)?summary.boxscore.players:[];
  const result=[];
  for(const group of groups){
    const players=[];
    for(const statGroup of (Array.isArray(group.statistics)?group.statistics:[])){
      const keys=Array.isArray(statGroup.keys)?statGroup.keys:[];
      const names=Array.isArray(statGroup.names)?statGroup.names:[];
      const labels=Array.isArray(statGroup.labels)?statGroup.labels:[];
      const athletes=Array.isArray(statGroup.athletes)?statGroup.athletes:[];
      for(const athlete of athletes){
        const raw=athlete?.stats;
        const stats=Array.isArray(raw)?raw:(Array.isArray(athlete?.statistics)?athlete.statistics:[]);
        const row={
          id:simpleId(athlete?.athlete?.id||athlete?.id),
          teamId:simpleId(group.team?.id),
          headshot:safeLogo(athlete?.athlete?.headshot?.href||athlete?.athlete?.headshot||''),
          jersey:String(athlete?.athlete?.jersey||''),
          name:String(athlete?.athlete?.displayName||athlete?.athlete?.fullName||athlete?.displayName||'Player'),
          pos:String(athlete?.athlete?.position?.abbreviation||athlete?.athlete?.position?.name||''),
          starter:athlete?.starter===true,dnp:athlete?.didNotPlay===true,
          reason:String(athlete?.reason||athlete?.didNotPlayReason||''),
          statsAvailable:stats.length>0
        };
        for(let i=0;i<stats.length;i++){
          const col=boxStatKey(labels[i],keys[i],names[i]);
          if(!col)continue;
          const value=stats[i];
          if(value!==null && value!==undefined && String(value).trim()!=='')row[col]=String(value);
        }
        // Some versions return keyed objects instead of parallel arrays.
        if(!Array.isArray(raw)&&raw&&typeof raw==='object'){
          for(const [k,v] of Object.entries(raw)){
            const col=boxStatKey(k);
            if(col && v!==null && v!==undefined && String(v).trim()!=='')row[col]=String(v);
          }
        }
        if(row.dnp || (!row.statsAvailable && row.reason))row.dnp=true;
        players.push(row);
      }
    }
    if(players.length)result.push({teamId:String(group.team?.id||''),abbr:String(group.team?.abbreviation||''),name:String(group.team?.displayName||''),players});
  }
  return result;
}
function getBoxTeams(game,summary){
  const comp=game?.competitions?.[0];
  const competitors=[comp?.competitors?.find(c=>c.homeAway==='away'),comp?.competitors?.find(c=>c.homeAway==='home')];
  const playerGroups=parsePlayerBoxscore(summary);
  return competitors.filter(Boolean).map((c,i)=>{
    const teamId=String(c.team?.id||c.id||'');
    const abbr=String(c.team?.abbreviation||'');
    const group=playerGroups.find(g=>teamId&&g.teamId===teamId)||playerGroups.find(g=>g.abbr.toLowerCase()===abbr.toLowerCase())||null;
    return {side:c.homeAway||(['away','home'][i]),id:teamId,abbr,name:String(c.team?.shortDisplayName||c.team?.name||abbr),score:c.score,lines:c.linescores||[],players:group?.players||[],hasGroup:!!group};
  });
}
function boxSortValue(row,key){
  if(key==='name')return row.name.toLowerCase();
  const value=row[key];
  if(value===undefined||value===null||value===''||value==='—')return null;
  if(['fg','tp','ft'].includes(key))return Number(String(value).split('-')[0]);
  if(key==='min'&&String(value).includes(':')){
    const p=String(value).split(':');return Number(p[0])+Number(p[1]||0)/60;
  }
  const n=Number(String(value).replace(/[^0-9.+-]/g,''));
  return Number.isFinite(n)?n:null;
}
function sortedBoxPlayers(players){
  const key=viewerState.boxSort,desc=viewerState.boxSortDesc;
  return [...players].sort((a,b)=>{
    const av=boxSortValue(a,key),bv=boxSortValue(b,key);
    if(av===null)return bv===null?0:1;
    if(bv===null)return -1;
    const compare=typeof av==='string'?av.localeCompare(bv):av-bv;
    return compare*(desc?-1:1);
  });
}
function boxCell(player,key){
  if(key==='name')return `<td><div class="bs-player">${player.id?`<button type="button" class="cs-player-link" data-player-profile="${safe(player.id)}" data-player-name="${safe(player.name)}" data-player-team="${safe(player.teamId||'')}" data-player-pos="${safe(player.pos)}" title="Open ${safe(player.name)} player profile">${safe(player.name)}</button>`:`<strong>${safe(player.name)}</strong>`}<span>${safe(player.pos||'—')}</span></div></td>`;
  const value=player[key];
  let label=value===undefined?'—':String(value);
  const number=Number(value);
  if(key==='pm'&&Number.isFinite(number)&&number>0)label='+'+label.replace(/^\+/, '');
  const cls=key==='pts'&&number>=20?'bs-high':key==='pm'&&number>0?'bs-positive':key==='pm'&&number<0?'bs-negative':'';
  return `<td class="${cls}">${safe(label)}</td>`;
}
function boxScoreMarkup(game,summary){
  const teams=getBoxTeams(game,summary);
  if(!teams.length)return '<p class="bs-empty">ESPN game details are not available for this matchup yet.</p>';
  const options=teams.map(t=>`<button type="button" class="bs-team-button" data-bs-team="${safe(t.side)}" aria-pressed="${t.side===(viewerState.boxTeam||'away')}">${safe(t.abbr||t.name)}</button>`).join('');
  const selected=teams.find(t=>t.side===viewerState.boxTeam)||teams[0];
  if(!teams.some(t=>t.side===viewerState.boxTeam))viewerState.boxTeam=selected.side;
  const cols=BOX_COLUMNS.filter(([key])=>viewerState.boxWide||COMPACT_BOX_KEYS.has(key));
  const headers=cols.map(([key,label])=>`<th scope="col"><button type="button" data-bs-sort="${key}" aria-label="Sort by ${safe(label)}">${safe(label)} ${key===viewerState.boxSort?(viewerState.boxSortDesc?'↓':'↑'):''}</button></th>`).join('');
  const metadata=viewerState.statsCache.get(viewerState.gameId);
  const last=metadata?.at?new Date(metadata.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',second:'2-digit'}):'Waiting for update';
  let rows='';
  if(selected.players.length){
    const groups=[['STARTERS',sortedBoxPlayers(selected.players.filter(p=>p.starter&&!p.dnp))],['BENCH',sortedBoxPlayers(selected.players.filter(p=>!p.starter&&!p.dnp))],['DID NOT PLAY',selected.players.filter(p=>p.dnp)]];
    for(const [group,people] of groups){
      if(!people.length)continue;
      rows+=`<tr class="bs-group"><td colspan="${cols.length}">${group}</td></tr>`;
      for(const player of people){
        if(player.dnp)rows+=`<tr class="bs-dnp"><td>${boxCell(player,'name').slice(4,-5)}</td><td colspan="${cols.length-1}">${safe(player.reason||'DNP')}</td></tr>`;
        else rows+=`<tr>${cols.map(([key])=>boxCell(player,key)).join('')}</tr>`;
      }
    }
  }
  if(!rows)rows=`<tr><td class="bs-empty" colspan="${cols.length}">${summary?'Player statistics are not posted for this game yet.':'Loading player statistics from ESPN…'}</td></tr>`;
  const sortedLabel=BOX_COLUMNS.find(([key])=>key===viewerState.boxSort)?.[1]||'PTS';
  const caution=viewerState.statsError?`<div class="bs-warning">ESPN refresh failed. ${metadata?'Showing last available player statistics.':'Player statistics could not be loaded.'}</div>`:'';
  return `<div class="bs-actions"><div class="bs-team-switch" role="group" aria-label="Choose team">${options}</div>
    <button type="button" class="bs-wide-toggle" id="bsWideToggle" aria-pressed="${viewerState.boxWide}">${viewerState.boxWide?'↤ Compact table':'⤢ Wide table'}</button></div>
    <p class="bs-hint">Click a heading to sort players. <strong>Wide table</strong> reveals FG, 3PT, FT, steals, blocks, turnovers and fouls.</p>
    ${caution}
    <div class="bs-table-scroll" tabindex="0" role="region" aria-label="Scrollable player box score"><table class="bs-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="bs-table-footer"><span class="bs-sort-status" aria-live="polite">Sorted by ${safe(sortedLabel)} ${viewerState.boxSortDesc?'↓':'↑'} · ${safe(selected.abbr)}</span><span class="bs-update-label">${safe(last)}</span></div>
    <div class="bs-note"><strong>Starters, bench and DNP</strong> are separated automatically. Missing values display as a dash, not a zero. ${viewerState.boxWide?'The complete table stays alongside the video on wide screens.':''}</div>`;
}
function summaryTeamMap(summary,teams){
  const groups=summary?.boxscore?.teams||[];
  return teams.map(t=>{
    const found=groups.find(g=>t.id&&String(g.team?.id||'')===t.id)||groups.find(g=>String(g.team?.abbreviation||'').toLowerCase()===t.abbr.toLowerCase())||groups.find(g=>g.homeAway===t.side);
    const map={};
    for(const stat of found?.statistics||[]){
      const key=normalizeBoxKey(stat.name||stat.label||'');
      map[key]=stat.displayValue??stat.value;
    }
    return map;
  });
}
const TEAM_COMPARISONS=[
  ['FIELD GOAL %',['fieldgoalpct','fieldgoalpercentage','fgpct']],
  ['3-POINT %',['threepointfieldgoalpct','threepointpct','threepointfieldgoalpercentage']],
  ['FREE THROW %',['freethrowpct','freethrowpercentage']],
  ['REBOUNDS',['totalrebounds','rebounds','reb']],
  ['ASSISTS',['assists','ast']],
  ['TURNOVERS',['turnovers','totalturnovers']],
  ['STEALS',['steals','stl']],
  ['BLOCKS',['blocks','blk']]
];
function scoreBoxMarkup(game){
  const teams=getBoxTeams(game,null);
  if(teams.length!==2)return '<p class="bs-empty">Game score is not available.</p>';
  return `<div class="bs-score">
    ${teams.map(t=>`<div class="bs-score-line"><button class="cs-profile-link" type="button" data-team-profile="${safe(t.id)}" title="Open ${safe(t.name)} team profile">${safe(t.abbr)} · ${safe(t.name)}</button><strong>${safe(t.score??'—')}</strong></div>`).join('')}
    <div class="bs-score-state">${safe(getStatus(game))}</div>
  </div>`;
}
function compareMarkup(t1,t2,label,keys){
  return `<div class="bs-compare"><b>${safe(findSummaryStat(t1,keys))}</b><span>${safe(label)}</span><b>${safe(findSummaryStat(t2,keys))}</b></div>`;
}
function statsTeamMarkup(game,summary){
  if(!game)return '<p class="bs-empty">Select a game to view team statistics.</p>';
  const teams=getBoxTeams(game,summary);
  const maps=summaryTeamMap(summary,teams);
  const comparisons=teams.length===2?TEAM_COMPARISONS.map(([label,keys])=>compareMarkup(maps[0],maps[1],label,keys)).join(''):'';
  const hasData=maps.some(m=>Object.keys(m).length);
  return scoreBoxMarkup(game)+`<div class="bs-subhead">Team comparison</div>${comparisons}${!hasData?'<p class="stats-help">ESPN team statistics are pending or temporarily unavailable.</p>':''}`;
}
function statsOverviewMarkup(game,summary){
  if(!game)return '<p class="bs-empty">Select a game to view its overview.</p>';
  const teams=getBoxTeams(game,summary);
  if(teams.length!==2)return '<p class="bs-empty">No scoreboard data is available for this game.</p>';
  let html=scoreBoxMarkup(game);
  const allPlayers=teams.flatMap(t=>t.players.map(p=>({...p,team:t.abbr})));
  const realPlayers=allPlayers.filter(p=>!p.dnp&&p.pts!==undefined);
  const leaders=[...realPlayers].sort((a,b)=>Number(b.pts||0)-Number(a.pts||0)).slice(0,3);
  if(leaders.length){
    html+='<div class="bs-subhead">Top performers</div>'+leaders.map(p=>`<div class="bs-performer"><div>${p.id?`<button type="button" class="cs-player-link" data-player-profile="${safe(p.id)}" data-player-name="${safe(p.name)}" data-player-team="${safe(p.teamId||'')}" data-player-pos="${safe(p.pos)}">${safe(p.name)}</button>`:`<strong>${safe(p.name)}</strong>`}<br><small>${safe(p.team)} · ${safe(p.pos||'Player')}</small></div><span class="bs-number">${safe(p.pts)} PTS</span></div>`).join('');
  }else{
    // Scoreboard leaders are retained as a fallback when player detail is absent.
    const comps=game.competitions?.[0]?.competitors||[];
    const listed=comps.flatMap(c=>{
      const lead=(c.leaders||[]).find(l=>l.name==='points')?.leaders?.[0];
      return lead?[{id:simpleId(lead.athlete?.id),teamId:simpleId(c.team?.id),name:lead.athlete?.displayName||'Player',team:c.team?.abbreviation||'',pts:lead.displayValue}]:[];
    });
    if(listed.length)html+='<div class="bs-subhead">Scoring leaders</div>'+listed.map(p=>`<div class="bs-performer"><div>${p.id?`<button type="button" class="cs-player-link" data-player-profile="${safe(p.id)}" data-player-name="${safe(p.name)}" data-player-team="${safe(p.teamId)}">${safe(p.name)}</button>`:`<strong>${safe(p.name)}</strong>`}<br><small>${safe(p.team)}</small></div><span class="bs-number">${safe(p.pts)} PTS</span></div>`).join('');
  }
  const linesA=teams[0].lines,linesH=teams[1].lines;
  if(linesA.length||linesH.length){
    html+='<div class="bs-subhead">Quarter scores</div>';
    for(let i=0;i<Math.min(8,Math.max(linesA.length,linesH.length));i++){
      const period=i<4?'Q'+(i+1):'OT'+(i-3);
      html+=`<div class="bs-compare"><b>${safe(linesA[i]?.displayValue??linesA[i]?.value??'—')}</b><span>${period}</span><b>${safe(linesH[i]?.displayValue??linesH[i]?.value??'—')}</b></div>`;
    }
  }
  return html;
}
  return {BOX_COLUMNS,COMPACT_BOX_KEYS,boxKeyAliases,TEAM_COMPARISONS,gameStatValues,findSummaryStat,normalizeBoxKey,boxStatKey,parsePlayerBoxscore,getBoxTeams,boxSortValue,sortedBoxPlayers,boxCell,boxScoreMarkup,summaryTeamMap,scoreBoxMarkup,compareMarkup,statsTeamMarkup,statsOverviewMarkup};
}
