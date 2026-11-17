  const gameCenterControllerApi=CourtsideGameCenterController.createGameCenterController({
    $,viewerState,statsPoll,espnPoll,gameStore,Date,getState:()=>state,
    resetStatsPollFor:(...args)=>resetStatsPollFor(...args),
    renderStats:(...args)=>renderStats(...args),
    statsNeedsRequest:(...args)=>statsNeedsRequest(...args),
    fetchGameSummary:(...args)=>fetchGameSummary(...args),
    paintViewer:(...args)=>paintViewer(...args)
  });
  // Preserve function-declaration hoisting: ESPN refresh-policy captures this
  // callback before the controller fragment is evaluated.
  function updateStatsSidebar(...args){return gameCenterControllerApi.updateStatsSidebar(...args);}
  function setStatsTab(...args){return gameCenterControllerApi.setStatsTab(...args);}
