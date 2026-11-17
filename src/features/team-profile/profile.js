  const teamProfileApi=CourtsideTeamProfile.createTeamProfile({
    $,document,Date,Number,String,Array,getState:()=>state,
    profileState,teamDirectory,standingsState,TEAM_API,TEAM_DETAILS_TTL_MS,
    safe:(...args)=>safe(...args),
    safeLogo:(...args)=>safeLogo(...args),
    simpleId:(...args)=>simpleId(...args),
    statNumber:(...args)=>statNumber(...args),
    standStat:(...args)=>standStat(...args),
    fetchFeatureJson:(...args)=>fetchFeatureJson(...args),
    dataLogObserve:(...args)=>dataLogObserve(...args),
    dataLogTeamRecords:(...args)=>dataLogTeamRecords(...args),
    dataLogInvalid:(...args)=>dataLogInvalid(...args),
    fetchStandings:(...args)=>fetchStandings(...args)
  });
  function profileTeam(...args){return teamProfileApi.profileTeam(...args);}
  function profileSeasonYear(...args){return teamProfileApi.profileSeasonYear(...args);}
  async function fetchTeamData(...args){return teamProfileApi.fetchTeamData(...args);}
  function cachedTeamData(...args){return teamProfileApi.cachedTeamData(...args);}
  function profileMetrics(...args){return teamProfileApi.profileMetrics(...args);}
  function scheduleScoreNumber(...args){return teamProfileApi.scheduleScoreNumber(...args);}
  function parseTeamSchedule(...args){return teamProfileApi.parseTeamSchedule(...args);}
  function renderScheduleTable(...args){return teamProfileApi.renderScheduleTable(...args);}
  function scheduleSection(...args){return teamProfileApi.scheduleSection(...args);}
  function rosterSection(...args){return teamProfileApi.rosterSection(...args);}
  function renderTeamProfile(...args){return teamProfileApi.renderTeamProfile(...args);}
  function selectTeamProfileTab(...args){return teamProfileApi.selectTeamProfileTab(...args);}
  function openTeamProfile(...args){return teamProfileApi.openTeamProfile(...args);}
  function closeTeamProfile(...args){return teamProfileApi.closeTeamProfile(...args);}
