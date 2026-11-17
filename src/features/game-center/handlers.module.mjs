/** The original delegated Game Center controls and resize handlers. */
export function registerGameCenterHandlers({$,viewerState,getState,ResizeObserver,requestAnimationFrame,cancelAnimationFrame,Math,setStatsTab,setChartView,inspectShot,renderStats,chartInput,inspectChartPointer,chartKeydown,getChartResizeWidth,setChartResizeWidth,getChartResizeFrame,setChartResizeFrame}){
$('statsSidebar').addEventListener('click',event=>{
  const tab=event.target.closest('button[data-bs-tab]');
  if(tab){setStatsTab(tab.dataset.bsTab);return;}
  const chartView=event.target.closest('button[data-cs-view]');
  if(chartView){setChartView(chartView.dataset.csView);return;}
  const shot=event.target.closest('[data-cs-shot]');
  if(shot){inspectShot(shot.dataset.csShot);return;}
  const team=event.target.closest('button[data-bs-team]');
  if(team){viewerState.boxTeam=team.dataset.bsTeam;renderStats(getState().games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);return;}
  const sort=event.target.closest('button[data-bs-sort]');
  if(sort){
    if(viewerState.boxSort===sort.dataset.bsSort)viewerState.boxSortDesc=!viewerState.boxSortDesc;
    else{viewerState.boxSort=sort.dataset.bsSort;viewerState.boxSortDesc=viewerState.boxSort!=='name';}
    renderStats(getState().games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
    return;
  }
  if(event.target.closest('#bsWideToggle')){
    viewerState.boxWide=!viewerState.boxWide;
    renderStats(getState().games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
  }
});
$('statsSidebar').addEventListener('input',chartInput);
$('statsSidebar').addEventListener('change',chartInput);
$('statsSidebar').addEventListener('pointermove',inspectChartPointer);
$('statsSidebar').addEventListener('pointerdown',inspectChartPointer);
// Original single resize state is retained in the classic-script adapter.
if(typeof ResizeObserver!=='undefined'){
  const chartResizeObserver=new ResizeObserver(entries=>{
    const width=entries[0]?.contentRect.width||0;
    if(Math.abs(width-getChartResizeWidth())<1)return;
    setChartResizeWidth(width);
    if(viewerState.statsTab!=='charts'||!viewerState.statsOpen||$('viewer').hidden)return;
    cancelAnimationFrame(getChartResizeFrame());
    setChartResizeFrame(requestAnimationFrame(()=>{
      if(viewerState.statsTab==='charts'&&viewerState.statsOpen&&!$('viewer').hidden)
        renderStats(getState().games.find(g=>String(g.id)===viewerState.gameId),viewerState.statsCache.get(viewerState.gameId)?.data);
    }));
  });
  chartResizeObserver.observe($('statsContent'));
}
$('statsSidebar').addEventListener('keydown',event=>{
  chartKeydown(event);
  const active=event.target.closest('[data-bs-tab]');
  if(!active||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();const tabs=['overview','box','team','charts'];
  const next=tabs[(tabs.indexOf(active.dataset.bsTab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
  setStatsTab(next);$('statsSidebar').querySelector(`[data-bs-tab="${next}"]`)?.focus();
});
}
