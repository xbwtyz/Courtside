  // Central scoreboard game state with an unchanged legacy state view.
  const gameStore = CourtsideGameStore.createGameStore({date:today(), defaultLiveOnly:settingsPrefs.defaultLiveOnly});
  const state = gameStore.state;

  $('datePicker').value = state.date;
  $('liveOnly').checked = state.liveOnly;

  // AuraSports uses ESPN game IDs; PPV.st and Matchora use independent IDs.
  // Cross-provider matches must be verified against BOTH ESPN teams and kickoff.
  let auraGames = new Map(), auraUpdatedAt = 0, auraPending = null;
  let ppvEvents = [], ppvUpdatedAt = 0, ppvPending = null;
  let matchoraEvents = [], matchoraUpdatedAt = 0, matchoraPending = null;
  const viewerState = {
    gameId:null, sourceUrl:null, sources:[], liveGames:[], previousFocus:null,
    layout:1, activeTile:0, tickerOpen:false, slots:Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]})),
    request:0, theater:false, statsOpen:true, statsCache:new Map(), statsPending:new Map(), statsSeq:0,
    statsTab:'box', boxWide:false, boxTeam:null, boxSort:'pts', boxSortDesc:true, statsError:'',
    chartView:'lead',shotTeam:'all',shotPlayer:'all',shotPeriod:'all',chartSelections:{lead:null,prob:null,shots:null},
    statsDisplayKey:null
  };
