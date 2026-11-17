  $('scoreboard').addEventListener('click',e=>{
    const watch=e.target.closest('button[data-watch]');
    if(watch){openViewer(watch.dataset.watch);return;}
    const stats=e.target.closest('button[data-game]');
    if(stats){const id=stats.dataset.game;state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);render();return;}
    // Normal links/buttons remain independent of the game-card click target.
    if(e.target.closest('a,button,input,select,textarea'))return;
    const card=e.target.closest('article.game[data-game-id]');
    if(card)openViewer(card.dataset.gameId);
  });
  $('scoreboard').addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const card=e.target.closest('article.game[data-game-id]');
    if(e.target!==card)return;
    e.preventDefault();openViewer(card.dataset.gameId);
  });

