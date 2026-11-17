  let {normalized,nicknames,getGameTeams,teamAliases,hasAlias,ppvEventMatches,ppvSourcesForGame,matchoraEventMatches,matchoraSourcesForGame,combinedSourcesForId}=CourtsideStreamMatching.createStreamMatching({
    cache:{get ppvEvents(){return ppvEvents;},get auraGames(){return auraGames;},get matchoraEvents(){return matchoraEvents;}},
    getGames:()=>state.games,validPpvUrl,validMatchoraUrl,matchSources,Date
  });
