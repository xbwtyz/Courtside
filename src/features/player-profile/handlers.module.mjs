/** Delegated player links, current-season controls and accessible dialog focus trap. */
export function registerPlayerProfileHandlers({$,document,Array,playerState,openPlayerProfile,playerOpenGame,closePlayerProfile,renderPlayerProfile,fetchPlayerKind}){
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-player-profile]');
    if(button){event.preventDefault();openPlayerProfile(button);return;}
    const game=event.target.closest('[data-player-game]');
    if(game){event.preventDefault();playerOpenGame(game.dataset.playerGame,game.dataset.playerGameDate);return;}
  });
  $('playerProfileClose').addEventListener('click',()=>closePlayerProfile());
  $('playerProfileBackdrop').addEventListener('click',()=>closePlayerProfile());
  $('playerBackTeam').addEventListener('click',()=>closePlayerProfile());
  $('playerProfileDialog').addEventListener('click',event=>{
    const tab=event.target.closest('[data-player-tab]');
    if(tab){playerState.tab=tab.dataset.playerTab;$('playerProfileContent').scrollTop=0;renderPlayerProfile();return;}
    const sort=event.target.closest('[data-player-sort]');
    if(sort){const key=sort.dataset.playerSort;playerState.sortDesc=playerState.sort===key?!playerState.sortDesc:true;
      playerState.sort=key;renderPlayerProfile();return;}
    const retry=event.target.closest('[data-player-retry]');
    if(retry){fetchPlayerKind(retry.dataset.playerRetry,true);return;}
  });
  document.addEventListener('keydown',event=>{
    if($('playerProfileModal').hidden)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();closePlayerProfile();return;
    }
    if(event.key!=='Tab')return;
    const focusable=Array.from($('playerProfileDialog').querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)'))
      .filter(el=>!el.hidden&&!el.closest('[hidden]'));
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  },true);
}
