  const {phaseForGameId,scoresRefreshMs,statsRefreshMs,resetStatsPollFor,statsNeedsRequest,selectedStatsDueAt,refreshSelectedStatsIfDue}=
    CourtsideEspnRefreshPolicy.createEspnRefreshPolicy({
      state,viewerState,espnPoll,statsPoll,today,document,$,Date,
      ESPN_LIVE_SCORES_MS,ESPN_LIVE_STATS_MS,ESPN_IDLE_MS,updateStatsSidebar
    });
