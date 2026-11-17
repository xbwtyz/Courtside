  const leagueLeadersRenderApi=CourtsideLeagueLeadersRender.createLeagueLeadersRender({
    $,document,Date,Math,Number,String,Object,Array,Set,
    leaderState,leaderStats,leaderCategorySpec,NBA_TEAMS,leaderClean,
    leaderVolumeMinimum:(...args)=>leaderVolumeMinimum(...args),
    leaderMetricValue:(...args)=>leaderMetricValue(...args),
    profileSeasonYear:(...args)=>profileSeasonYear(...args),
    safe:(...args)=>safe(...args),
    patchGameDOM:(...args)=>patchGameDOM(...args)
  });
  function leaderFiltered(...args){return leagueLeadersRenderApi.leaderFiltered(...args);}
  function leaderFormat(...args){return leagueLeadersRenderApi.leaderFormat(...args);}
  function leaderSyncSelect(...args){return leagueLeadersRenderApi.leaderSyncSelect(...args);}
  function leaderRenderControls(...args){return leagueLeadersRenderApi.leaderRenderControls(...args);}
  function leaderUpdateStatus(...args){return leagueLeadersRenderApi.leaderUpdateStatus(...args);}
  function renderLeaders(...args){return leagueLeadersRenderApi.renderLeaders(...args);}
  function leaderUpdateCaution(...args){return leagueLeadersRenderApi.leaderUpdateCaution(...args);}
  function leaderSetCategory(...args){return leagueLeadersRenderApi.leaderSetCategory(...args);}
  function leaderSetSort(...args){return leagueLeadersRenderApi.leaderSetSort(...args);}
