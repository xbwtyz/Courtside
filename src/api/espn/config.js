  const {SUMMARY_API, ESPN_LIVE_SCORES_MS, ESPN_LIVE_STATS_MS, ESPN_IDLE_MS, ESPN_MAX_BACKOFF_MS, espnPoll, statsPoll}=CourtsideEspnConfig.createEspnConfig();
  const scoreRequestStatus=CourtsideEspnConfig.createScoreRequestStatus({
    state, espnPoll, AbortController, Date,
    getScoresRefreshMs:()=>scoresRefreshMs(), getBackoff:failures=>exponentialBackoff(failures)
  });
