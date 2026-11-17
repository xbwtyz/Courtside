  // Retain mutable legacy function bindings, existing call sites and source order.
  // Late callback wrappers preserve external monkey-patching and definitions
  // declared after the Viewer controller in the original inline script.
  let {
    updateLiveGamePicker,
    availableSlotGames,
    paintPlayer,
    paintViewer,
    setActiveTile,
    setViewerLayout,
    changeViewerGame,
    changeViewerSource,
    lookupViewerGame,
    openViewer,
    closeViewer,
    refreshViewerGameList
  }=CourtsideViewerController.createViewerController({
    $,document,Option,Date,state,viewerState,
    getAuraGames:()=>auraGames,getSettingsPrefs:()=>settingsPrefs,
    matchSources:(...args)=>matchSources(...args),
    matchLabel:(...args)=>matchLabel(...args),
    combinedSourcesForId:(...args)=>combinedSourcesForId(...args),
    viewerGameTitle:(...args)=>viewerGameTitle(...args),
    alertsRenderToasts:(...args)=>alertsRenderToasts(...args),
    updateGameCenterTeamLinks:(...args)=>updateGameCenterTeamLinks(...args),
    resetStatsPollFor:(...args)=>resetStatsPollFor(...args),
    updateStatsSidebar:(...args)=>updateStatsSidebar(...args),
    resetChartGame:(...args)=>resetChartGame(...args),
    fetchPpvStreams:(...args)=>fetchPpvStreams(...args),
    fetchAuraSchedule:(...args)=>fetchAuraSchedule(...args),
    fetchMatchoraSchedule:(...args)=>fetchMatchoraSchedule(...args),
    renderTickers:(...args)=>renderTickers(...args)
  });
