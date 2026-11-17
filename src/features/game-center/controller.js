  const {updateStatsSidebar,setStatsTab}=CourtsideGameCenterController.createGameCenterController({
    $,viewerState,statsPoll,espnPoll,gameStore,Date,getState:()=>state,
    resetStatsPollFor:(...args)=>resetStatsPollFor(...args),
    renderStats:(...args)=>renderStats(...args),
    statsNeedsRequest:(...args)=>statsNeedsRequest(...args),
    fetchGameSummary:(...args)=>fetchGameSummary(...args),
    paintViewer:(...args)=>paintViewer(...args)
  });
