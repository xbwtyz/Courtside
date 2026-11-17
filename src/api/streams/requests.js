  const {validAuraUrl,validPpvUrl,validMatchoraUrl,matchSources,matchLabel,fetchAuraSchedule,flattenPpvEvents,fetchPpvStreams,fetchMatchoraSchedule}=CourtsideStreamRequests.createStreamRequests({
    cache:{
      get auraGames(){return auraGames;},set auraGames(value){auraGames=value;},
      get auraUpdatedAt(){return auraUpdatedAt;},set auraUpdatedAt(value){auraUpdatedAt=value;},
      get auraPending(){return auraPending;},set auraPending(value){auraPending=value;},
      get ppvEvents(){return ppvEvents;},set ppvEvents(value){ppvEvents=value;},
      get ppvUpdatedAt(){return ppvUpdatedAt;},set ppvUpdatedAt(value){ppvUpdatedAt=value;},
      get ppvPending(){return ppvPending;},set ppvPending(value){ppvPending=value;},
      get matchoraEvents(){return matchoraEvents;},set matchoraEvents(value){matchoraEvents=value;},
      get matchoraUpdatedAt(){return matchoraUpdatedAt;},set matchoraUpdatedAt(value){matchoraUpdatedAt=value;},
      get matchoraPending(){return matchoraPending;},set matchoraPending(value){matchoraPending=value;}
    },
    AURA_API,AURA_TTL_MS,PPV_APIS,PPV_TTL_MS,MATCHORA_APIS,MATCHORA_TTL_MS,
    fetch:(...args)=>fetch(...args),AbortController,URL,Date,setTimeout,clearTimeout
  });
