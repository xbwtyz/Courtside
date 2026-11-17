  const SUMMARY_API='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';
  const ESPN_LIVE_SCORES_MS=10*1000;
  const ESPN_LIVE_STATS_MS=15*1000;
  const ESPN_IDLE_MS=60*1000;
  const ESPN_MAX_BACKOFF_MS=5*60*1000;
  const espnPoll={sharedUntil:0,scoreFailures:0};
  const statsPoll={gameId:null,nextAt:0,failures:0};


