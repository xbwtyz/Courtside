  // Keep original classic-script names and mutable tickerFrame visible to
  // non-migrated callers; maintain the same single-frame scheduling lifecycle.
  let tickerFrame=0;
  const {
    tickerControllers,tickerReducedMotion,tickerDesktopHover,
    formatTickerGame,
    tickerDispose,
    tickerNormalize,
    tickerEnsureCopies,
    tickerPause,
    tickerInitialize,
    tickerFrameStep,
    paintTicker,
    renderTickers
  }=CourtsideTickerController.createTickerController({
    $,window,document,Date,performance,setTimeout,requestAnimationFrame,
    AbortController,ResizeObserver:typeof ResizeObserver==='undefined'?undefined:ResizeObserver,
    getGames:()=>state.games,getSettingsPrefs:()=>settingsPrefs,
    getGameTeams:(...args)=>getGameTeams(...args),
    getStatus:(...args)=>getStatus(...args),
    formatStart:(...args)=>formatStart(...args),
    safe:(...args)=>safe(...args),
    syncFrame:id=>{tickerFrame=id;}
  });
