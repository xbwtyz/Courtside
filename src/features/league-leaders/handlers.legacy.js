  // Delegation reuses Courtside 1.4's [data-player-profile] and [data-team-profile] click handlers.
  $('leadersCategories').addEventListener('click',event=>{const b=event.target.closest('[data-leader-category]');if(b)leaderSetCategory(b.dataset.leaderCategory);});
  $('leadersMetric').addEventListener('change',event=>leaderSetSort(event.target.value));
  $('leadersTableHead').addEventListener('click',event=>{const b=event.target.closest('[data-leader-sort]');if(b)leaderSetSort(b.dataset.leaderSort,true);});
  for(const [name,prop] of [['leadersTeam','team'],['leadersPosition','position']]){
    $(name).addEventListener('change',event=>{leaderState[prop]=event.target.value;leaderState.page=1;renderLeaders();});
  }
  for(const [control,custom,wrap,prop,cap] of [
    ['leadersGames','leadersGamesCustom','leadersGamesCustomWrap','games',100],
    ['leadersMinutes','leadersMinutesCustom','leadersMinutesCustomWrap','minutes',48]
  ]){
    $(control).addEventListener('change',event=>{
      const isCustom=event.target.value==='custom';leaderState[prop+'Custom']=isCustom;
      $(wrap).hidden=!isCustom;
      const v=isCustom?Number($(custom).value):Number(event.target.value);
      leaderState[prop]=Number.isFinite(v)?Math.min(cap,Math.max(0,v)):0;leaderState.page=1;renderLeaders();
    });
    $(custom).addEventListener('input',event=>{
      const v=Number(event.target.value);if(event.target.value!==''&&Number.isFinite(v)){leaderState[prop]=Math.min(cap,Math.max(0,v));leaderState.page=1;renderLeaders();}
    });
  }
  $('leadersVolume').addEventListener('change',event=>{leaderState.volume=event.target.value;leaderState.page=1;renderLeaders();});
  $('leadersVolumeCustom').addEventListener('input',event=>{const v=Number(event.target.value);if(event.target.value!==''&&Number.isFinite(v)){leaderState.volumeCustom=Math.min(40,Math.max(0,v));leaderState.page=1;renderLeaders();}});
  $('leadersSearch').addEventListener('input',event=>{leaderState.query=event.target.value;leaderState.page=1;renderLeaders();$('leadersSearch').focus({preventScroll:true});});
  $('leadersRows').addEventListener('change',event=>{leaderState.rows=Number(event.target.value);settingsPrefs.leadersRows=leaderState.rows;saveSettingsPrefs();syncSettingsControls();leaderState.page=1;renderLeaders();});
  $('leadersPaging').addEventListener('click',event=>{
    const b=event.target.closest('[data-leader-page]');if(!b)return;
    leaderState.page+=b.dataset.leaderPage==='next'?1:-1;renderLeaders();
    $('leadersTableScroll').scrollIntoView({behavior:'auto',block:'nearest'});
  });
  $('leadersRefresh').addEventListener('click',()=>fetchLeaders(true));
  $('leadersReset').addEventListener('click',()=>{
    Object.assign(leaderState,{team:'all',position:'all',games:5,minutes:0,gamesCustom:false,minutesCustom:false,volume:'auto',volumeCustom:2,query:'',rows:settingsPrefs.leadersRows,page:1});renderLeaders();
  });


