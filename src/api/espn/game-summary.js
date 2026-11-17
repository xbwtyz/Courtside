  const {fetchGameSummary}=CourtsideEspnGameSummary.createGameSummary({
    viewerState,statsPoll,espnPoll,SUMMARY_API,Date,AbortController,
    setTimeout,clearTimeout,encodeURIComponent,
    statsNeedsRequest:(...args)=>statsNeedsRequest(...args),
    phaseForGameId:(...args)=>phaseForGameId(...args),
    auditESPNJob:(...args)=>auditESPNJob(...args),
    fetch:(...args)=>fetch(...args),
    noteEspnResponseError:(...args)=>noteEspnResponseError(...args),
    dataLogObserve:(...args)=>dataLogObserve(...args),
    dataLogSummaryRecords:(...args)=>dataLogSummaryRecords(...args),
    dataLogInvalid:(...args)=>dataLogInvalid(...args),
    exponentialBackoff:(...args)=>exponentialBackoff(...args)
  });
