  const AURA_API = 'https://aurasports.xyz/api/schedule';
  const AURA_TTL_MS = 2 * 60 * 1000;
  // PPV.st's public event index: return the iframe provided by the API, never synthesize one.
  const PPV_APIS = ['https://api.ppv.st/api/streams', 'https://api.ppv.to/api/streams'];
  const PPV_TTL_MS = 2 * 60 * 1000;
  // Matchora publishes NBA events and match/channel embed URLs in one schedule response.
  // Keep these requests independent of ESPN and the two existing stream indexes.
  const MATCHORA_APIS = [
    'https://matchora.to/api/v1/schedule?watchable=1',
    'https://matchora.pro/api/v1/schedule?watchable=1'
  ];
  const MATCHORA_TTL_MS = 2 * 60 * 1000;
