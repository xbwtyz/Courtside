  // Preserve original mutable function bindings and registration order.
  // Late-bound calls preserve test instrumentation, UI overrides, and helpers
  // initialized after this fragment (notably the scoreboard renderer).
  let {classify,parseGames,updateStatus,fetchScores,changeDay,selectDay}=CourtsideScoreboardData.createScoreboardData({
    $,state,viewerState,espnPoll,scoreRequestStatus,gameStore,API,Date,DOMException,
    setTimeout,clearTimeout,
    fetch:(...args)=>fetch(...args),
    auditESPNJob:(...args)=>auditESPNJob(...args),
    noteEspnResponseError:(...args)=>noteEspnResponseError(...args),
    selectedStatsDueAt:(...args)=>selectedStatsDueAt(...args),
    alertsResetBaseline:(...args)=>alertsResetBaseline(...args),
    render:(...args)=>render(...args),
    dataLogObserve:(...args)=>dataLogObserve(...args),
    dataLogScoreRecords:(...args)=>dataLogScoreRecords(...args),
    alertsObserveScoreboard:(...args)=>alertsObserveScoreboard(...args),
    seedTeamDirectoryFromScores:(...args)=>seedTeamDirectoryFromScores(...args),
    renderTickers:(...args)=>renderTickers(...args),
    updateLiveGamePicker:(...args)=>updateLiveGamePicker(...args),
    paintViewer:(...args)=>paintViewer(...args),
    dataLogInvalid:(...args)=>dataLogInvalid(...args),
    dateFromString:(...args)=>dateFromString(...args),
    fmtDate:(...args)=>fmtDate(...args),
    callClassify:(...args)=>classify(...args),
    callParseGames:(...args)=>parseGames(...args),
    callUpdateStatus:(...args)=>updateStatus(...args),
    callSelectDay:(...args)=>selectDay(...args),
    callFetchScores:(...args)=>fetchScores(...args)
  });
