/** Original delegated team-profile clicks, keyboard and focus trap. */
export function registerTeamProfileHandlers({$,document,getState,openTeamProfile,closeTeamProfile,openViewer,changeViewerGame,selectTeamProfileTab,fetchTeamData}){
  document.addEventListener('click',event=>{
    const team=event.target.closest('[data-team-profile]');
    if(team){event.preventDefault();openTeamProfile(team.dataset.teamProfile);return;}
    const watch=event.target.closest('[data-profile-watch]');
    if(watch){
      const id=watch.dataset.profileWatch;
      if(getState().games.some(g=>String(g.id)===id)){
        closeTeamProfile();
        if($('viewer').hidden)openViewer(id);else changeViewerGame(id);
      }
    }
  });
  $('teamProfileClose').addEventListener('click',closeTeamProfile);
  $('teamProfileBackdrop').addEventListener('click',closeTeamProfile);
  $('teamProfileDialog').addEventListener('click',event=>{
    const button=event.target.closest('[data-profile-tab]');
    if(button){selectTeamProfileTab(button.dataset.profileTab);return;}
    const retry=event.target.closest('[data-profile-retry]');
    if(retry)fetchTeamData(retry.dataset.profileRetry,true);
  });
  // Capturing prevents the existing video viewer's Escape key handler from closing
  // the whole multiview when the team profile is the topmost dialog.
  document.addEventListener('keydown',event=>{
    if($('teamProfileModal').hidden)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();closeTeamProfile();return;
    }
    if(event.key!=='Tab')return;
    const focusable=Array.from($('teamProfileDialog').querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)'))
      .filter(el=>!el.hidden&&!el.closest('[hidden]'));
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  },true);
}
