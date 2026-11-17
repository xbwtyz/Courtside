/** Existing scoreboard presentation and keyed DOM reconciliation. */
export function createScoreboardRender({$,document,Node,Date,WeakMap,getState,safe,safeLogo}){
  const formatStart = iso => {const d=new Date(iso);return Number.isNaN(d.getTime())?'Time TBA':d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});};
  function getStatus(game){const phase=game._phase;if(phase==='final')return game.status?.type?.shortDetail || 'FINAL';if(phase==='live')return game.status?.type?.shortDetail || 'IN PROGRESS';return formatStart(game.date);}
  function teamData(c){return {id:String(c?.team?.id||''),name:c?.team?.displayName||c?.team?.name||'Team',short:c?.team?.shortDisplayName||c?.team?.name||'Team',abbr:c?.team?.abbreviation||'NBA',logo:safeLogo(c?.team?.logoDark || c?.team?.logo),score:c?.score,record:c?.records?.find(r=>r.name==='overall')?.summary || c?.records?.[0]?.summary || '',lines:c?.linescores || [],leaders:c?.leaders || []};}
  function logoHTML(t){return `<div class="logo-wrap"><div class="logo-fallback" aria-hidden="true">${safe(t.abbr)}</div>${t.logo?`<img class="logo" src="${safe(t.logo)}" alt="${safe(t.name)} logo" loading="lazy" onerror="this.style.display='none'">`:``}</div>`;}
  function scoreHTML(t,other,phase){if(phase==='upcoming')return '<span class="score upcoming">—</span>';const n=Number(t.score),o=Number(other.score);return `<span class="score ${phase==='final'&&n<o?'loser':''}">${safe(t.score??'—')}</span>`;}
  function detailHTML(a,h){
    const max=Math.min(8,Math.max(a.lines.length,h.lines.length));
    let html='';
    if(max){
      const headers=Array.from({length:max},(_,i)=>`<th scope="col">${i<4?'Q'+(i+1):'OT'+(i-3)}</th>`).join('');
      const row=t=>`<tr><td>${safe(t.abbr)}</td>${Array.from({length:max},(_,i)=>`<td>${safe(t.lines[i]?.displayValue??t.lines[i]?.value??'—')}</td>`).join('')}</tr>`;
      html+=`<div class="details-label">Quarter-by-quarter</div><table class="quarters"><thead><tr><th scope="col">TEAM</th>${headers}</tr></thead><tbody>${row(a)}${row(h)}</tbody></table>`;
    }
    for (const t of [a,h]) {
      const leader=t.leaders.find(x=>x.name==='points')?.leaders?.[0];
      if(leader)html+=`<div class="leader"><strong>${safe(t.short)} leader:</strong> ${safe(leader.athlete?.displayName||leader.athlete?.fullName||'Player')} — ${safe(leader.displayValue)} PTS</div>`;
    }
    return html||'<div class="leader">Game details will appear as they become available.</div>';
  }
  function gameCard(game){
    const comp=game.competitions?.[0]||{};const teams=comp.competitors||[];
    const away=teamData(teams.find(c=>c.homeAway==='away'));
    const home=teamData(teams.find(c=>c.homeAway==='home'));
    const phase=game._phase,expanded=getState().expanded.has(game.id);
    const broadcasts=(comp.broadcasts||[]).flatMap(b=>b.names||[]).filter(Boolean);
    if(!broadcasts.length && comp.broadcast) broadcasts.push(comp.broadcast);
    const note=(comp.notes||[]).map(n=>n.headline).filter(Boolean)[0];
    const sideLabel=note?note:(phase==='upcoming'?'TIPOFF '+formatStart(game.date):'NBA');
    const id=String(game.id||'').replace(/[^0-9]/g,'');
    const link=id?`https://www.espn.com/nba/game?gameId=${id}`:'https://www.espn.com/nba/scoreboard';
    const name=(t,o)=>`<div class="team-row"><button type="button" class="cs-team-action cs-score-team-action" data-team-profile="${safe(t.id)}" title="View ${safe(t.name)} profile" aria-label="Open ${safe(t.name)} team profile">${logoHTML(t)}<div style="min-width:0"><div class="team-name" title="${safe(t.name)}">${safe(t.short)}</div><div class="team-meta">${safe(t.record ? t.record + ' · ' : '')}${o==='away'?'Away':'Home'}</div></div></button></div>`;
    return `<article class="game ${phase}" data-game-id="${safe(game.id)}" tabindex="0" title="Click to watch available NBA streams" aria-label="${safe(away.name)} at ${safe(home.name)}: ${safe(getStatus(game))}. Press Enter to watch.">
      <div class="game-top"><span class="game-status ${phase}">${phase==='live'?'<span class="dot"></span>LIVE · '+safe(getStatus(game)):phase==='final'?safe(getStatus(game)):'UPCOMING · '+safe(getStatus(game))}</span><span class="game-side-label">${safe(sideLabel)}</span></div>
      <div class="teams"><div>${name(away,'away')}${name(home,'home')}</div><div>${scoreHTML(away,home,phase)}<div style="height:31px"></div>${scoreHTML(home,away,phase)}</div></div>
      <div class="game-bottom"><span class="broadcast" title="${safe(broadcasts.join(', '))}">${safe(broadcasts.slice(0,2).join(' · ')||'NBA Basketball')}</span><div class="actions"><button type="button" class="text-btn watch-button" data-watch="${safe(game.id)}" aria-label="Watch ${safe(away.short)} at ${safe(home.short)} ">▶ Watch</button><button type="button" class="text-btn expand-button" data-game="${safe(game.id)}" aria-expanded="${expanded}" aria-label="${expanded?'Hide':'Show'} game details">${expanded?'Hide stats −':'Game stats +'}</button><a class="text-btn arrow" href="${safe(link)}" target="_blank" rel="noopener noreferrer">Gamecast</a></div></div>
      ${expanded?`<div class="details">${detailHTML(away,home)}</div>`:''}
    </article>`;
  }
  function sectionHTML(label,phase,games){if(!games.length)return '';const heading=phase==='live'?'LIVE NOW':phase==='upcoming'?'COMING UP':'FINAL BUZZER';return `<section class="section ${phase}"><div class="section-heading"><h2>${heading}</h2><span class="section-count">${games.length} ${games.length===1?'GAME':'GAMES'}</span></div><div class="cards">${games.map(gameCard).join('')}</div></section>`;}
  // Patch only the actual DOM changes in cards; preserve buttons, focus, logo
  // images, and expanded details while a live game's numbers are refreshed.
  const gameMarkupCache=new WeakMap();
  function patchGameDOM(current,fresh){
    if(current.nodeType!==fresh.nodeType ||
        (current.nodeType===Node.ELEMENT_NODE&&current.tagName!==fresh.tagName)){
      current.replaceWith(fresh.cloneNode(true));return;
    }
    if(current.nodeType===Node.TEXT_NODE){
      if(current.nodeValue!==fresh.nodeValue)current.nodeValue=fresh.nodeValue;
      return;
    }
    if(current.nodeType!==Node.ELEMENT_NODE)return;
    for(const attr of [...current.attributes])if(!fresh.hasAttribute(attr.name))current.removeAttribute(attr.name);
    for(const attr of [...fresh.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
    // Game cards contain no form inputs or streams; positional child patching
    // preserves the interactive card and its bound/focused descendants.
    let i=0;
    while(i<fresh.childNodes.length){
      const newChild=fresh.childNodes[i],oldChild=current.childNodes[i];
      if(!oldChild){current.appendChild(newChild.cloneNode(true));}
      else patchGameDOM(oldChild,newChild);
      i++;
    }
    while(current.childNodes.length>fresh.childNodes.length)current.lastChild.remove();
  }
  function reconcileGameSections(filtered){
    const board=$('scoreboard'),cardMap=new Map(
      [...board.querySelectorAll('.game[data-game-id]')].map(card=>[card.dataset.gameId,card])
    );
    let sectionIndex=0;
    for(const phase of ['live','upcoming','final']){
      const games=filtered.filter(g=>g._phase===phase);
      if(!games.length)continue;
      let section=[...board.children].find(child=>child.classList.contains('section')&&child.classList.contains(phase));
      if(!section){
        // Section headings must exist even if a phase was absent previously.
        const title=phase==='live'?'LIVE NOW':phase==='upcoming'?'COMING UP':'FINAL BUZZER';
        section=document.createElement('section');section.className=`section ${phase}`;
        section.innerHTML=`<div class="section-heading"><h2>${title}</h2><span class="section-count"></span></div><div class="cards"></div>`;
      }
      const count=section.querySelector('.section-count'),label=`${games.length} ${games.length===1?'GAME':'GAMES'}`;
      if(count.textContent!==label)count.textContent=label;
      const grid=section.querySelector('.cards');
      for(const [i,game] of games.entries()){
        const key=String(game.id),markup=gameCard(game);
        let card=cardMap.get(key);
        if(!card){const template=document.createElement('template');template.innerHTML=markup;card=template.content.firstElementChild;}
        else if(gameMarkupCache.get(card)!==markup){
          const template=document.createElement('template');template.innerHTML=markup;
          patchGameDOM(card,template.content.firstElementChild);
        }
        gameMarkupCache.set(card,markup);
        if(grid.children[i]!==card)grid.insertBefore(card,grid.children[i]||null);
      }
      while(grid.children.length>games.length)grid.lastElementChild.remove();
      if(board.children[sectionIndex]!==section)board.insertBefore(section,board.children[sectionIndex]||null);
      sectionIndex++;
    }
    while(board.children.length>sectionIndex)board.lastElementChild.remove();
  }
  function render(){
    const games=getState().games;
    $('totalCount').textContent=getState().firstLoaded?games.length:'—';
    $('liveCount').textContent=getState().firstLoaded?games.filter(g=>g._phase==='live').length:'—';
    $('upcomingCount').textContent=getState().firstLoaded?games.filter(g=>g._phase==='upcoming').length:'—';
    $('finalCount').textContent=getState().firstLoaded?games.filter(g=>g._phase==='final').length:'—';
    const fb=$('feedback');
    fb.classList.toggle('show',!!getState().error);fb.textContent=getState().error?`Unable to update: ${getState().error}${getState().lastUpdated?' Showing the most recently loaded scores.':' Please check your internet connection or try again.'}`:'';
    if(!getState().firstLoaded){
      const board=$('scoreboard');
      if(!board.querySelector('.loading-card'))board.innerHTML='<div class="cards"><div class="loading-card"></div><div class="loading-card"></div><div class="loading-card"></div></div>';
      return;
    }
    const q=getState().query.toLowerCase().trim();
    const filtered=games.filter(g=>{
      if(getState().liveOnly&&g._phase!=='live')return false;
      if(!q)return true;
      const text=(g.competitions?.[0]?.competitors||[]).map(t=>[t.team?.displayName,t.team?.name,t.team?.location,t.team?.abbreviation].join(' ')).join(' ').toLowerCase();return text.includes(q);
    }).sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(!filtered.length){
      const empty=games.length===0?'No NBA games scheduled':getState().liveOnly?'No live games match':'No matching games';
      const copy=games.length===0?'There are no matchups listed for this date. Try the previous or next day.':getState().liveOnly?'Try switching off “Live only” to see upcoming and completed games.':'Try a different team search.';
      $('scoreboard').innerHTML=`<div class="empty"><div class="empty-symbol" aria-hidden="true">◌</div><h2>${empty}</h2><p>${copy}</p></div>`;return;
    }
    reconcileGameSections(filtered);
  }
  return {formatStart,gameMarkupCache,getStatus,teamData,logoHTML,scoreHTML,detailHTML,gameCard,sectionHTML,patchGameDOM,reconcileGameSections,render};
}
