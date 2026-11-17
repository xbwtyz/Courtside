  // Keep the original player cache and public, hoisted parser functions.
  const playerProfileDataApi=CourtsidePlayerProfileData.createPlayerProfileData({
    $,Date,Number,String,Array,Map,Math,
    profileSeasonYear:(...args)=>profileSeasonYear(...args),
    fetchFeatureJson:(...args)=>fetchFeatureJson(...args),
    dataLogObserve:(...args)=>dataLogObserve(...args),
    dataLogPlayerRecords:(...args)=>dataLogPlayerRecords(...args),
    dataLogInvalid:(...args)=>dataLogInvalid(...args),
    renderPlayerProfile:(...args)=>renderPlayerProfile(...args),
    safe:(...args)=>safe(...args),
    simpleId:(...args)=>simpleId(...args),
    fmtDate:(...args)=>fmtDate(...args)
  });
  const {PLAYER_API,PLAYER_TTL_MS,playerState,playerValue,playerNumber,playerMetricAlias,playerStatKey,playerCacheKey}=playerProfileDataApi;
  function playerStatsFromLabels(...args){return playerProfileDataApi.playerStatsFromLabels(...args);}
  function extractPlayerStats(...args){return playerProfileDataApi.extractPlayerStats(...args);}
  function parsePlayerGameLog(...args){return playerProfileDataApi.parsePlayerGameLog(...args);}
  function playerCached(...args){return playerProfileDataApi.playerCached(...args);}
  async function fetchPlayerKind(...args){return playerProfileDataApi.fetchPlayerKind(...args);}
  function playerStatDisplay(...args){return playerProfileDataApi.playerStatDisplay(...args);}
  function playerProfileMetrics(...args){return playerProfileDataApi.playerProfileMetrics(...args);}
  function playerDataStatus(...args){return playerProfileDataApi.playerDataStatus(...args);}
  function playerGameLogTable(...args){return playerProfileDataApi.playerGameLogTable(...args);}
  function playerSeasonTable(...args){return playerProfileDataApi.playerSeasonTable(...args);}
