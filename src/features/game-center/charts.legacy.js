// Charts share the existing summary cache. No chart action navigates the iframe.
let activeChart = null;
function resetChartGame(){
  viewerState.shotTeam='all';viewerState.shotPlayer='all';viewerState.shotPeriod='all';
  viewerState.chartSelections={lead:null,prob:null,shots:null};activeChart=null;
}
function chartNumber(value){
  if(value===null||value===undefined||typeof value==='boolean'||String(value).trim()==='')return null;
  const n=Number(typeof value==='object'?(value.value??value.displayValue):value);
  return Number.isFinite(n)?n:null;
}
function chartClock(value){
  const text=String(value?.displayValue??value??'').trim();
  if(!/^\d+(?::\d{1,2}(?:\.\d+)?)?(?:\.\d+)?$/.test(text))return null;
  const parts=text.split(':').map(Number);
  if(parts.length===2&&parts[1]>=60)return null;
  return parts.length===2?parts[0]*60+parts[1]:parts[0];
}
function chartPeriodLabel(period){return period<=4?'Q'+period:'OT'+(period-4);}
function chartModel(game,summary){
  const comp=summary?.header?.competitions?.[0]||game?.competitions?.[0]||{};
  const competitors=comp.competitors||[];
  const teams=['away','home'].map((side,index)=>{
    const c=competitors.find(c=>c.homeAway===side)||{};
    return {side,id:String(c.team?.id||c.id||side),abbr:String(c.team?.abbreviation||side.toUpperCase()),name:String(c.team?.displayName||side),score:chartNumber(c.score),color:index?'var(--orange)':'var(--green)'};
  });
  const players=new Map();
  for(const group of summary?.boxscore?.players||[]){
    for(const stats of group.statistics||[]){
      for(const row of stats.athletes||[]){
        const a=row.athlete||{};
        if(a.id)players.set(String(a.id),String(a.displayName||a.fullName||'Player'));
      }
    }
  }
  const plays=[];
  for(const [index,p] of (Array.isArray(summary?.plays)?summary.plays:[]).entries()){
    if(!p||typeof p!=='object')continue;
    const period=chartNumber(p.period?.number),seconds=chartClock(p.clock);
    if(!Number.isInteger(period)||period<1||period>30||seconds===null||seconds<0||seconds>(period<=4?720:300))continue;
    const time=period<=4?(period-1)*720+720-seconds:2880+(period-5)*300+300-seconds;
    const home=chartNumber(p.homeScore),away=chartNumber(p.awayScore);
    const sequence=chartNumber(p.sequenceNumber)??index;
    plays.push({id:String(p.id??'play-'+index),time,period,clock:String(p.clock?.displayValue??p.clock),home,away,lead:home===null||away===null?null:home-away,text:String(p.text||p.type?.text||'Play'),sequence,raw:p});
  }
  plays.sort((a,b)=>a.time-b.time||a.sequence-b.sequence);
  const byId=new Map(plays.map(p=>[p.id,p]));
  const lead=plays.filter(p=>p.home!==null&&p.away!==null&&p.home>=0&&p.away>=0);
  const probability=[];
  for(const row of Array.isArray(summary?.winprobability)?summary.winprobability:[]){
    if(!row||typeof row!=='object')continue;
    const play=byId.get(String(row.playId)),home=chartNumber(row.homeWinPercentage);
    const tie=chartNumber(row.tiePercentage)??0;
    if(!play||home===null||home<0||home>1||tie<0||home+tie>1.000001)continue;
    probability.push({...play,homeChance:home*100,awayChance:Math.max(0,1-home-tie)*100});
  }
  probability.sort((a,b)=>a.time-b.time||a.sequence-b.sequence);
  const shots=plays.filter(p=>p.raw.shootingPlay===true&&[2,3].includes(chartNumber(p.raw.pointsAttempted))).map(p=>{
    const raw=p.raw,x=chartNumber(raw.coordinate?.x),y=chartNumber(raw.coordinate?.y);
    const playerId=String(raw.participants?.[0]?.athlete?.id||'unknown');
    return {...p,x,y,located:x!==null&&y!==null&&x>=0&&x<=50&&y>=-5.25&&y<=88.75,teamId:String(raw.team?.id||''),playerId,player:players.get(playerId)||String(raw.participants?.[0]?.athlete?.displayName||'Unlisted player'),made:raw.scoringPlay===true,points:chartNumber(raw.pointsAttempted),heave:/heave/i.test(raw.type?.text||'')};
  });
  const status=comp.status?.type||game?.status?.type||{};
  const last=lead[lead.length-1];
  const final=status.state==='post'||game?._phase==='final';
  const mismatch=!!(final&&last&&teams[0].score!==null&&teams[1].score!==null&&(last.away!==teams[0].score||last.home!==teams[1].score));
  const maxPeriod=Math.max(4,Number(comp.status?.period)||0,...plays.map(p=>p.period));
  const duration=(48+Math.max(0,maxPeriod-4)*5)*60;
  return {teams,players,plays,lead,probability,shots,comp,duration,mismatch,final,pre:status.state==='pre'||(!summary&&game?._phase==='upcoming'),partial:!!(lead[0]&&lead[0].time>90)};
}
function chartWidth(){
  const panel=$('statsContent');
  const css=window.getComputedStyle(panel);
  return Math.max(220,Math.round(panel.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0)||360));
}
function chartTeamLegend(model,probability=false){
  return `<div class="cs-chart-legend">${model.teams.map((t,i)=>`<span><i class="cs-team-swatch ${i?'cs-home':'cs-away'} ${probability&&!i?'cs-dashed':''}" aria-hidden="true"></i>${safe(t.abbr)}${probability?` <b id="csChance${i}"></b>`:''}</span>`).join('')}</div>`;
}
function chartSelected(rows,kind){
  const id=viewerState.chartSelections[kind];
  const found=id===null?-1:rows.findIndex(p=>p.id===id);
  return found<0?rows.length-1:found;
}
function chartDetail(row,model,kind){
  const teams=model.teams;
  const score=row.away===null||row.home===null?'Score unavailable':`${teams[0].abbr} ${row.away} – ${teams[1].abbr} ${row.home}`;
  const extra=kind==='prob'?`<span>${safe(teams[0].abbr)} ${row.awayChance.toFixed(1)}% · ${safe(teams[1].abbr)} ${row.homeChance.toFixed(1)}%</span>`:'';
  return `<strong>${safe(chartPeriodLabel(row.period))} · ${safe(row.clock)} · ${safe(score)}</strong>${extra}<span>${safe(row.text)}</span>`;
}
function chartStepPath(rows,value,x,y){
  return rows.map((p,i)=>`${i?'H'+x(p.time).toFixed(2)+'V':'M'+x(p.time).toFixed(2)+' '}${y(value(p)).toFixed(2)}`).join('');
}
function lineChartMarkup(model,kind){
  const probability=kind==='prob';
  const rows=probability?model.probability:model.lead;
  if(!rows.length){
    const message=model.pre?'Charts will appear after tipoff.':probability?'Win probability is not available for this game yet.':'Play history is not available for this game yet.';
    return `<p class="bs-empty">${message}</p>`;
  }
  const width=chartWidth(),height=256,left=43,right=12,top=25,bottom=44;
  let min=0,max=100;
  if(!probability){
    min=Math.floor((Math.min(0,...rows.map(p=>p.lead))-1)/5)*5;
    max=Math.ceil((Math.max(0,...rows.map(p=>p.lead))+1)/5)*5;
  }
  const x=time=>left+4+(width-left-right-8)*time/model.duration;
  const y=value=>top+4+(height-top-bottom-8)*(max-value)/(max-min);
  const ticks=probability?[0,25,50,75,100]:Array.from(new Set([min,Math.round(min/2),0,Math.round(max/2),max])).sort((a,b)=>a-b);
  const timeTicks=width<330?[0,model.duration/2,model.duration]:[0,720,1440,2160,2880,...Array.from({length:Math.max(0,Math.round((model.duration-2880)/300))},(_,i)=>3180+i*300)].filter(t=>t<=model.duration);
  const frame=`<rect x="${left}" y="${top}" width="${width-left-right}" height="${height-top-bottom}" fill="none" stroke="#373d48"/>`;
  const grid=ticks.map(v=>`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="${v===0&&!probability?'#727987':'#2a303a'}"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end">${v}${probability?'%':''}</text>`).join('');
  const times=timeTicks.map(t=>`<text x="${x(t)}" y="${height-bottom+19}" text-anchor="${t===0?'start':t===model.duration?'end':'middle'}">${Number((t/60).toFixed(1))}</text>`).join('');
  const quarters=[720,1440,2160,2880,...Array.from({length:Math.max(0,Math.round((model.duration-2880)/300))},(_,i)=>3180+i*300)].filter(t=>t<model.duration).map(t=>`<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${height-bottom}" stroke="#343a44"/>`).join('');
  const index=chartSelected(rows,kind),selected=rows[index];
  const leadPath=probability?'':chartStepPath(rows,p=>p.lead,x,y);
  const lines=probability?`<path d="${chartStepPath(rows,p=>p.homeChance,x,y)}" fill="none" stroke="var(--orange)" stroke-width="2.2"/><path d="${chartStepPath(rows,p=>p.awayChance,x,y)}" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 3"/>`:
    `<defs><clipPath id="csLeadPositive"><rect x="${left}" y="${top}" width="${width-left-right}" height="${y(0)-top}"/></clipPath><clipPath id="csLeadNegative"><rect x="${left}" y="${y(0)}" width="${width-left-right}" height="${height-bottom-y(0)}"/></clipPath></defs><path d="${leadPath}" fill="none" stroke="var(--orange)" stroke-width="2.4" clip-path="url(#csLeadPositive)"/><path d="${leadPath}" fill="none" stroke="var(--green)" stroke-width="2.4" clip-path="url(#csLeadNegative)"/>`;
  activeChart={kind,model,rows,index,width,height,left,right,top,bottom,min,max,x,y};
  const warning=model.mismatch?'<div class="bs-warning">The final score and the recorded play scores differ. This graph shows the available play history; the game score above remains the official total.</div>':model.partial?'<div class="bs-warning">Play history starts after tipoff. Only available events are shown.</div>':'';
  return `<div class="cs-chart-heading"><strong>${probability?'Win probability':'Lead over time'}</strong><span>${probability?'ESPN Analytics estimate':`Above zero: ${safe(model.teams[1].abbr)} · Below zero: ${safe(model.teams[0].abbr)}`}</span></div>
    ${chartTeamLegend(model,probability)}${warning}
    <svg class="cs-line-chart cs-chart-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="csChartTitle csChartDescription" data-cs-linechart="${kind}">
      <title id="csChartTitle">${probability?'ESPN win probability':'Score difference'}: ${safe(model.teams[0].abbr)} at ${safe(model.teams[1].abbr)}</title>
      <desc id="csChartDescription">${rows.length} recorded observations. ${probability?'The solid line is the home team and the dashed line is the away team.':'Positive values mean the home team leads; negative values mean the away team leads.'} Use the Inspect plays slider below to read each observation.</desc>
      ${grid}${quarters}${frame}<text x="${left}" y="14">${probability?'Win chance (%)':'Lead (points)'}</text>${times}<text x="${(left+width-right)/2}" y="${height-5}" text-anchor="middle">Game time (minutes elapsed)</text>${lines}
      <line id="csChartCursor" x1="${x(selected.time)}" x2="${x(selected.time)}" y1="${top}" y2="${height-bottom}" stroke="#e1e4eb" stroke-opacity=".6"/>
      <circle id="csChartMarkerHome" cx="${x(selected.time)}" cy="${y(probability?selected.homeChance:selected.lead)}" r="4" fill="${!probability&&selected.lead<0?'var(--green)':'var(--orange)'}"/>
      ${probability?`<circle id="csChartMarkerAway" cx="${x(selected.time)}" cy="${y(selected.awayChance)}" r="4" fill="var(--green)"/>`:''}
      <rect x="${left}" y="${top}" width="${width-left-right}" height="${height-top-bottom}" fill="transparent"/>
    </svg>
    <label class="cs-scrubber-label" for="csPlayRange"><span>Inspect plays</span><span id="csPlayPosition">${index+1} / ${rows.length}</span></label>
    <input class="cs-play-range" type="range" id="csPlayRange" min="0" max="${rows.length-1}" step="1" value="${index}" aria-label="Inspect recorded plays" aria-valuetext="${safe(chartPeriodLabel(selected.period)+' '+selected.clock+' '+selected.text)}"/>
    <div class="cs-chart-detail" id="csChartDetail" aria-live="polite">${chartDetail(selected,model,kind)}</div>
    <p class="cs-chart-note">${probability?'Probabilities are ESPN model estimates, not guarantees.':'The line follows recorded scores. A scoring run is visible as consecutive steps toward one team.'} Move over the graph, tap a moment, or use the slider to inspect a play.</p>`;
}
function shotDetail(row,model){
  const team=model.teams.find(t=>t.id===row.teamId);
  return `<strong>${safe(row.player)} · ${safe(team?.abbr||'NBA')} · ${row.made?'Made':'Missed'} ${row.points}PT${row.heave?' · Heave':''}</strong><span>${safe(chartPeriodLabel(row.period))} · ${safe(row.clock)}</span><span>${safe(row.text)}</span>`;
}
function shotChartMarkup(model){
  const availableTeams=new Set(model.teams.map(t=>t.id));
  if(viewerState.shotTeam!=='all'&&!availableTeams.has(viewerState.shotTeam))viewerState.shotTeam='all';
  const teamShots=model.shots.filter(p=>viewerState.shotTeam==='all'||p.teamId===viewerState.shotTeam);
  const players=[...new Map(teamShots.map(p=>[p.playerId,p.player])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  if(viewerState.shotPlayer!=='all'&&!players.some(([id])=>id===viewerState.shotPlayer))viewerState.shotPlayer='all';
  const periods=[...new Set(model.shots.map(p=>p.period))].sort((a,b)=>a-b);
  if(viewerState.shotPeriod!=='all'&&!periods.includes(Number(viewerState.shotPeriod)))viewerState.shotPeriod='all';
  const filtered=teamShots.filter(p=>(viewerState.shotPlayer==='all'||p.playerId===viewerState.shotPlayer)&&(viewerState.shotPeriod==='all'||p.period===Number(viewerState.shotPeriod)));
  const rows=filtered.filter(p=>p.located),missing=filtered.length-rows.length;
  const controls=`<div class="cs-shot-filters"><label for="csShotTeam">Team<select id="csShotTeam"><option value="all">Both teams</option>${model.teams.map(t=>`<option value="${safe(t.id)}" ${t.id===viewerState.shotTeam?'selected':''}>${safe(t.abbr)}</option>`).join('')}</select></label><label for="csShotPeriod">Quarter<select id="csShotPeriod"><option value="all">All quarters</option>${periods.map(p=>`<option value="${p}" ${String(p)===viewerState.shotPeriod?'selected':''}>${chartPeriodLabel(p)}</option>`).join('')}</select></label><label class="cs-player-filter" for="csShotPlayer">Player<select id="csShotPlayer"><option value="all">All players</option>${players.map(([id,name])=>`<option value="${safe(id)}" ${id===viewerState.shotPlayer?'selected':''}>${safe(name)}</option>`).join('')}</select></label></div>`;
  if(!model.shots.length)return `<p class="bs-empty">${model.pre?'Shot charts will appear after tipoff.':'Shot locations are not available for this game yet.'}</p>`;
  if(!rows.length)return controls+`<p class="bs-empty">${missing?'No usable locations are available for these shot events.':'No shots match these filters yet.'}</p>`;
  const width=chartWidth(),pad=16,scale=(width-pad*2)/50;
  const yMin=-5.25,yMax=Math.max(41.75,...rows.map(p=>p.y+2));
  const height=Math.ceil((yMax-yMin)*scale+pad*2),x=v=>pad+v*scale,y=v=>pad+(yMax-v)*scale;
  const path=pts=>pts.map((p,i)=>(i?'L':'M')+x(p[0]).toFixed(2)+' '+y(p[1]).toFixed(2)).join('');
  const courtRect=(a,b,w,h)=>`<rect x="${x(a)}" y="${y(b+h)}" width="${w*scale}" height="${h*scale}"/>`;
  const cornerY=Math.sqrt(23.75**2-22**2),theta=Math.atan2(cornerY,22);
  const arc=Array.from({length:65},(_,i)=>{const angle=theta+(Math.PI-2*theta)*i/64;return [25+23.75*Math.cos(angle),23.75*Math.sin(angle)];});
  const court=`<g fill="none" stroke="#68717f" stroke-width="1.15">${courtRect(0,yMin,50,yMax-yMin)}${courtRect(17,-5.25,16,19)}<circle cx="${x(25)}" cy="${y(13.75)}" r="${6*scale}"/><circle cx="${x(25)}" cy="${y(0)}" r="${.75*scale}"/><path d="${path([[22,-1.25],[28,-1.25]])}"/><path d="${path([[3,-5.25],[3,cornerY]])}"/><path d="${path(arc)}"/><path d="${path([[47,cornerY],[47,-5.25]])}"/><line x1="${x(0)}" x2="${x(50)}" y1="${y(41.75)}" y2="${y(41.75)}"/><path d="${path(Array.from({length:33},(_,i)=>{const a=Math.PI*i/32;return [25+4*Math.cos(a),4*Math.sin(a)];}))}"/></g>`;
  const index=chartSelected(rows,'shots'),selected=rows[index];
  const marks=rows.map(row=>{
    const color=model.teams.find(t=>t.id===row.teamId)?.color||'#b8c0ce',px=x(row.x),py=y(row.y);
    const mark=row.made?`<circle cx="${px}" cy="${py}" r="4.2" fill="${color}"/>`:`<path d="M${px-3.5} ${py-3.5}L${px+3.5} ${py+3.5}M${px+3.5} ${py-3.5}L${px-3.5} ${py+3.5}" stroke="${color}" stroke-width="1.6"/>`;
    return `<g data-cs-shot="${safe(row.id)}"><title>${safe(row.player+' · '+chartPeriodLabel(row.period)+' '+row.clock+' · '+row.text)}</title>${mark}<circle cx="${px}" cy="${py}" r="10" fill="transparent"/></g>`;
  }).join('');
  activeChart={kind:'shots',model,rows,index,x,y,width,height};
  const made=rows.filter(p=>p.made).length;
  return `${controls}<div class="cs-chart-heading"><strong>Shot locations</strong><span>${rows.length} shown · ${made} made · ${rows.length-made} missed</span></div>${chartTeamLegend(model)}
    <div class="cs-shot-key"><span>● Made</span><span>× Missed</span>${rows.some(p=>p.heave)?'<span>Includes logged heaves</span>':''}</div>
    ${missing?`<div class="bs-warning">${missing} shot event${missing===1?' has':'s have'} no usable location and ${missing===1?'is':'are'} omitted.</div>`:''}
    <svg class="cs-chart-svg cs-shot-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="csShotTitle csShotDescription"><title id="csShotTitle">Shot locations for ${safe(model.teams[0].abbr)} and ${safe(model.teams[1].abbr)}</title><desc id="csShotDescription">${rows.length} located shot events. Filled circles are made shots; crosses are misses. Use team, quarter and player filters, and the Shot details menu below.</desc>${court}${marks}<circle id="csShotSelection" cx="${x(selected.x)}" cy="${y(selected.y)}" r="8" fill="none" stroke="#f2f2f5" stroke-width="1.5" pointer-events="none"/></svg>
    <label class="cs-shot-picker" for="csShotSelect">Shot details<select id="csShotSelect">${rows.map((p,i)=>`<option value="${safe(p.id)}" ${i===index?'selected':''}>${safe(chartPeriodLabel(p.period)+' '+p.clock+' · '+p.player+' · '+(p.made?'Made':'Missed')+' '+p.points+'PT')}</option>`).join('')}</select></label>
    <div class="cs-chart-detail" id="csChartDetail" aria-live="polite">${shotDetail(selected,model)}</div>
    <p class="cs-chart-note">Tap a shot or choose it from Shot details. Locations are approximate. Logged heaves may appear here without counting as individual attempts; use Box Score for official shooting totals.</p>`;
}
function chartsMarkup(game,summary){
  activeChart=null;
  const views=[['lead','Lead'],['shots','Shots'],['prob','Win Probability']];
  const tabs=`<div class="cs-chart-tabs" role="tablist" aria-label="Chart type">${views.map(([key,label])=>`<button type="button" role="tab" id="csView${key}" data-cs-view="${key}" aria-controls="csChartBody" aria-selected="${viewerState.chartView===key}" tabindex="${viewerState.chartView===key?0:-1}">${label}</button>`).join('')}</div>`;
  const model=chartModel(game,summary);
  const error=viewerState.statsError?`<div class="bs-warning">Chart refresh failed. ${summary?'Showing the last available data.':'Use Refresh to try again.'}</div>`:'';
  let content='';
  if(!summary&&!model.pre)content='<p class="bs-empty">'+(viewerState.statsError?'Game history could not be loaded.':'Loading game history…')+'</p>';
  else content=viewerState.chartView==='shots'?shotChartMarkup(model):lineChartMarkup(model,viewerState.chartView);
  const score=model.teams.every(t=>t.score!==null)&&!model.pre?`<div class="cs-official-score">${safe(model.teams[0].abbr)} <strong>${model.teams[0].score}</strong><span>–</span>${safe(model.teams[1].abbr)} <strong>${model.teams[1].score}</strong><small>${safe(model.comp.status?.type?.shortDetail||model.comp.status?.type?.description||'')}</small></div>`:'';
  return tabs+`<div id="csChartBody" role="tabpanel" aria-labelledby="csView${viewerState.chartView}">${score}${error}${content}</div>`;
}
function setChartView(kind){
  if(!['lead','shots','prob'].includes(kind))return;
  if(viewerState.chartView!==kind)$('statsContent').scrollTop=0;
  viewerState.chartView=kind;
  renderStats(state.games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
}
function inspectChart(index,announce=false){
  const chart=activeChart;
  if(!chart||!chart.rows.length||chart.kind==='shots')return;
  index=Math.max(0,Math.min(chart.rows.length-1,Math.round(Number(index)||0)));
  const row=chart.rows[index];chart.index=index;
  viewerState.chartSelections[chart.kind]=index===chart.rows.length-1?null:row.id;
  const cursor=$('csChartCursor'),marker=$('csChartMarkerHome'),detail=$('csChartDetail');
  if(cursor){cursor.setAttribute('x1',chart.x(row.time));cursor.setAttribute('x2',chart.x(row.time));}
  if(marker){marker.setAttribute('cx',chart.x(row.time));marker.setAttribute('cy',chart.y(chart.kind==='prob'?row.homeChance:row.lead));marker.setAttribute('fill',chart.kind==='lead'&&row.lead<0?'var(--green)':'var(--orange)');}
  const away=$('csChartMarkerAway');
  if(away){away.setAttribute('cx',chart.x(row.time));away.setAttribute('cy',chart.y(row.awayChance));}
  if(detail){detail.setAttribute('aria-live',announce?'polite':'off');detail.innerHTML=chartDetail(row,chart.model,chart.kind);}
  if($('csPlayRange')){$('csPlayRange').value=String(index);$('csPlayRange').setAttribute('aria-valuetext',chartPeriodLabel(row.period)+' '+row.clock+' '+row.text);}
  if($('csPlayPosition'))$('csPlayPosition').textContent=`${index+1} / ${chart.rows.length}`;
  if(chart.kind==='prob')chart.model.teams.forEach((t,i)=>{if($('csChance'+i))$('csChance'+i).textContent=(i?row.homeChance:row.awayChance).toFixed(1)+'%';});
}
function inspectShot(id,announce=true){
  const chart=activeChart;if(chart?.kind!=='shots')return;
  const index=chart.rows.findIndex(p=>p.id===id);if(index<0)return;
  const row=chart.rows[index];chart.index=index;
  viewerState.chartSelections.shots=index===chart.rows.length-1?null:id;
  if($('csShotSelection')){$('csShotSelection').setAttribute('cx',chart.x(row.x));$('csShotSelection').setAttribute('cy',chart.y(row.y));}
  if($('csShotSelect'))$('csShotSelect').value=id;
  if($('csChartDetail')){$('csChartDetail').setAttribute('aria-live',announce?'polite':'off');$('csChartDetail').innerHTML=shotDetail(row,chart.model);}
}
function inspectChartPointer(event){
  const svg=event.target.closest?.('[data-cs-linechart]'),chart=activeChart;
  if(!svg||!chart||chart.kind==='shots'||(event.type==='pointermove'&&event.pointerType==='touch'))return;
  const bounds=svg.getBoundingClientRect();if(!bounds.width)return;
  const pixel=(event.clientX-bounds.left)*chart.width/bounds.width;
  const time=Math.max(0,Math.min(chart.model.duration,(pixel-chart.left-4)/(chart.width-chart.left-chart.right-8)*chart.model.duration));
  let lo=0,hi=chart.rows.length-1;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(chart.rows[mid].time<time)lo=mid+1;else hi=mid;}
  if(lo>0&&Math.abs(chart.rows[lo-1].time-time)<Math.abs(chart.rows[lo].time-time))lo--;
  while(lo+1<chart.rows.length&&chart.rows[lo+1].time===chart.rows[lo].time)lo++;
  inspectChart(lo,event.type==='pointerdown');
}
function chartInput(event){
  if(event.target.id==='csPlayRange'){inspectChart(event.target.value,true);return;}
  if(event.type!=='change')return;
  const fields={csShotTeam:'shotTeam',csShotPlayer:'shotPlayer',csShotPeriod:'shotPeriod'};
  if(event.target.id==='csShotSelect'){inspectShot(event.target.value);return;}
  const key=fields[event.target.id];if(!key)return;
  viewerState[key]=event.target.value;
  if(key==='shotTeam')viewerState.shotPlayer='all';
  viewerState.chartSelections.shots=null;
  renderStats(state.games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
}
function chartKeydown(event){
  const tab=event.target.closest('[data-cs-view]');
  if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const views=['lead','shots','prob'];
  const next=event.key==='Home'?'lead':event.key==='End'?'prob':views[(views.indexOf(tab.dataset.csView)+(event.key==='ArrowRight'?1:-1)+views.length)%views.length];
  setChartView(next);$('csView'+next)?.focus();
}

