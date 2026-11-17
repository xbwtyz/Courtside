  // Retain one mutable main-view binding and all original hoisted functions.
  let mainView='scores';
  const standingsApi=CourtsideStandings.createStandings({
    $,viewerState,espnPoll,AbortController,Date,Map,Math,Number,String,Array,
    setTimeout,clearTimeout,fetch:(...args)=>fetch(...args),
    getState:()=>state,getMainView:()=>mainView,
    setMainViewValue:value=>{mainView=value;},
    safe:(...args)=>safe(...args),
    safeLogo:(...args)=>safeLogo(...args),
    auditESPNJob:(...args)=>auditESPNJob(...args),
    dataLogRequestInfo:(...args)=>dataLogRequestInfo(...args),
    retryAfterMs:(...args)=>retryAfterMs(...args),
    exponentialBackoff:(...args)=>exponentialBackoff(...args),
    dataLogObserve:(...args)=>dataLogObserve(...args),
    dataLogStandingsRecords:(...args)=>dataLogStandingsRecords(...args),
    dataLogInvalid:(...args)=>dataLogInvalid(...args),
    profileSeasonYear:(...args)=>profileSeasonYear(...args),
    renderTeamProfile:(...args)=>renderTeamProfile(...args),
    renderLeaders:(...args)=>renderLeaders(...args),
    fetchLeaders:(...args)=>fetchLeaders(...args),
    renderDataLog:(...args)=>renderDataLog(...args)
  });
  const {STANDINGS_API,TEAM_API,STANDINGS_TTL_MS,TEAM_DETAILS_TTL_MS,teamDirectory,standingsState,profileState,simpleId}=standingsApi;
  function statNumber(...args){return standingsApi.statNumber(...args);}
  function seedTeamDirectoryFromScores(...args){return standingsApi.seedTeamDirectoryFromScores(...args);}
  function mappedStats(...args){return standingsApi.mappedStats(...args);}
  function standStat(...args){return standingsApi.standStat(...args);}
  function parseStandings(...args){return standingsApi.parseStandings(...args);}
  function standingsMetric(...args){return standingsApi.standingsMetric(...args);}
  function teamLogoMarkup(...args){return standingsApi.teamLogoMarkup(...args);}
  function renderConference(...args){return standingsApi.renderConference(...args);}
  function renderStandings(...args){return standingsApi.renderStandings(...args);}
  async function fetchFeatureJson(...args){return standingsApi.fetchFeatureJson(...args);}
  async function fetchStandings(...args){return standingsApi.fetchStandings(...args);}
  function setMainView(...args){return standingsApi.setMainView(...args);}
  function updateGameCenterTeamLinks(...args){return standingsApi.updateGameCenterTeamLinks(...args);}
