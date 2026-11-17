function renderStats(game,summary){
  const panel=$('statsContent');
  const focused=panel.contains(document.activeElement)?document.activeElement?.id:null;
  activeChart=null;
  const scrollTop=panel.scrollTop;
  const oldTable=panel.querySelector('.bs-table-scroll');
  const scrollLeft=oldTable?.scrollLeft||0;
  const selected=viewerState.statsTab;
  panel.setAttribute('aria-live',selected==='charts'?'off':'polite');
  for(const tab of $('statsSidebar').querySelectorAll('[data-bs-tab]')){
    const active=tab.dataset.bsTab===selected;
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
    if(active)panel.setAttribute('aria-labelledby',tab.id);
  }
  $('viewerWorkspace').classList.toggle('box-wide',viewerState.statsOpen&&selected==='box'&&viewerState.boxWide);
  $('viewerWorkspace').classList.toggle('charts-open',viewerState.statsOpen&&selected==='charts');
  if(selected==='overview')panel.innerHTML=statsOverviewMarkup(game,summary);
  else if(selected==='team')panel.innerHTML=statsTeamMarkup(game,summary);
  else if(selected==='charts')panel.innerHTML=chartsMarkup(game,summary);
  else panel.innerHTML=boxScoreMarkup(game,summary);
  // Updating player data must neither reset the video nor jump the table scroll.
  panel.scrollTop=scrollTop;
  if(selected==='box'){const next=panel.querySelector('.bs-table-scroll');if(next)next.scrollLeft=scrollLeft;}
  if(selected==='charts'&&activeChart?.kind==='prob')inspectChart(activeChart.index);
  if(focused&&$(focused))$(focused).focus({preventScroll:true});
  const cache=viewerState.statsCache.get(viewerState.gameId);
  const when=cache?.at?`Updated ${new Date(cache.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`:'Waiting for ESPN';
  $('boxStatsStatus').textContent=viewerState.statsError?`${when} · Cached / unavailable`:when;
}
