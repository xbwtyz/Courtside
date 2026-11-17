/** Register original Viewer UI handlers without owning the iframe lifecycle. */
export function registerViewerControls({$,document,getViewerState,closeViewer,lookupViewerGame,
  setActiveTile,changeViewerGame,changeViewerSource,setViewerLayout,paintViewer,updateStatsSidebar}){
$('viewerClose').addEventListener('click',closeViewer);
$('viewerBackdrop').addEventListener('click',closeViewer);
$('viewerRetry').addEventListener('click',()=>lookupViewerGame(true));
$('multiviewGrid').addEventListener('click',e=>{
  const button=e.target.closest('[data-focus-tile]');
  if(button)setActiveTile(Number(button.dataset.focusTile));
});
$('multiviewGrid').addEventListener('change',e=>{
  const game=e.target.closest('[data-slot-game]');
  if(game){changeViewerGame(game.value,Number(game.dataset.slotGame));return;}
  const source=e.target.closest('[data-slot-source]');
  if(source)changeViewerSource(source.value,Number(source.dataset.slotSource));
});
document.querySelectorAll('[data-layout]').forEach(button=>button.addEventListener('click',()=>setViewerLayout(Number(button.dataset.layout))));
$('tickerToggle').addEventListener('click',()=>{getViewerState().tickerOpen=!getViewerState().tickerOpen;paintViewer();});
$('theaterToggle').addEventListener('click',()=>{getViewerState().theater=!getViewerState().theater;paintViewer();});
$('statsToggle').addEventListener('click',()=>{getViewerState().statsOpen=!getViewerState().statsOpen;paintViewer();});
$('statsRefresh').addEventListener('click',()=>updateStatsSidebar(true));
}
