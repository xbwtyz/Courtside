/** Event delegation for the scoreboard and Viewer ticker buttons. */
export function registerTickerClicks({$,openViewer,changeViewerGame}){
function onTickerClick(e){
  const b=e.target.closest('button[data-ticker-game]');
  if(!b)return;
  if($('viewer').hidden)openViewer(b.dataset.tickerGame);
  else changeViewerGame(b.dataset.tickerGame);
}
$('scoreTicker').addEventListener('click',onTickerClick);
$('viewerTicker').addEventListener('click',onTickerClick);
  return {onTickerClick};
}
