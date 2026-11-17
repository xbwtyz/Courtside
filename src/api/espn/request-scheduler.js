  // Phase 4G: isolated ESPN scheduler; preserve the original shared-call interface.
  const { requestESPN, exponentialBackoff, retryAfterMs, noteEspnResponseError } =
    CourtsideEspnScheduler.createEspnScheduler({
      espnPoll, statsPoll, ESPN_MAX_BACKOFF_MS, Date, Promise, setTimeout, clearTimeout
    });
