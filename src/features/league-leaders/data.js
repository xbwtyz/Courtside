  // One original leaderboard state, with all public function declarations hoisted.
  const leagueLeadersDataApi=CourtsideLeagueLeadersData.createLeagueLeadersData({
    settingsPrefs,teamDirectory,document,Date,Math,Number,String,Object,Map,Set,Array,
    getMainView:()=>mainView,
    profileSeasonYear:(...args)=>profileSeasonYear(...args),
    safeLogo:(...args)=>safeLogo(...args),
    simpleId:(...args)=>simpleId(...args),
    fetchFeatureJson:(...args)=>fetchFeatureJson(...args),
    dataLogObserve:(...args)=>dataLogObserve(...args),
    dataLogLeadersRecords:(...args)=>dataLogLeadersRecords(...args),
    dataLogInvalid:(...args)=>dataLogInvalid(...args),
    renderLeaders:(...args)=>renderLeaders(...args)
  });
  const {LEADERS_API,LEADERS_TTL_MS,NBA_TEAMS,leaderTeamMap,leaderStats,leaderCategorySpec,leaderState,leaderClean}=leagueLeadersDataApi;
  function leaderNumeric(...args){return leagueLeadersDataApi.leaderNumeric(...args);}
  function leaderStatObject(...args){return leagueLeadersDataApi.leaderStatObject(...args);}
  function leaderExtract(...args){return leagueLeadersDataApi.leaderExtract(...args);}
  function leaderNormalize(...args){return leagueLeadersDataApi.leaderNormalize(...args);}
  function leaderPagePayload(...args){return leagueLeadersDataApi.leaderPagePayload(...args);}
  async function fetchLeaders(...args){return leagueLeadersDataApi.fetchLeaders(...args);}
  function leaderVolumeMinimum(...args){return leagueLeadersDataApi.leaderVolumeMinimum(...args);}
  function leaderMetricValue(...args){return leagueLeadersDataApi.leaderMetricValue(...args);}
