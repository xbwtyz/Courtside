  // Original hoisted public dialog functions call the module at runtime.
  const playerProfileDialogApi=CourtsidePlayerProfileDialog.createPlayerProfileDialog({
    $,document,playerState,teamDirectory,viewerState,gameStore,getState:()=>state,
    safe:(...args)=>safe(...args),
    safeLogo:(...args)=>safeLogo(...args),
    simpleId:(...args)=>simpleId(...args),
    profileSeasonYear:(...args)=>profileSeasonYear(...args),
    playerCached:(...args)=>playerCached(...args),
    extractPlayerStats:(...args)=>extractPlayerStats(...args),
    parsePlayerGameLog:(...args)=>parsePlayerGameLog(...args),
    playerDataStatus:(...args)=>playerDataStatus(...args),
    playerProfileMetrics:(...args)=>playerProfileMetrics(...args),
    playerGameLogTable:(...args)=>playerGameLogTable(...args),
    playerSeasonTable:(...args)=>playerSeasonTable(...args),
    fetchPlayerKind:(...args)=>fetchPlayerKind(...args),
    closeTeamProfile:(...args)=>closeTeamProfile(...args),
    setMainView:(...args)=>setMainView(...args),
    fetchScores:(...args)=>fetchScores(...args),
    render:(...args)=>render(...args),
    openViewer:(...args)=>openViewer(...args),
    changeViewerGame:(...args)=>changeViewerGame(...args),
    paintViewer:(...args)=>paintViewer(...args)
  });
  function renderPlayerProfile(...args){return playerProfileDialogApi.renderPlayerProfile(...args);}
  function openPlayerProfile(...args){return playerProfileDialogApi.openPlayerProfile(...args);}
  function closePlayerProfile(...args){return playerProfileDialogApi.closePlayerProfile(...args);}
  async function playerOpenGame(...args){return playerProfileDialogApi.playerOpenGame(...args);}
