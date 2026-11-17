  // Keep the original global function binding for remaining classic-script callers.
  let {viewerGameTitle}=CourtsideViewerTitle.createViewerTitle({
    getGames:()=>state.games,getAuraGames:()=>auraGames,
    getGameTeams:game=>getGameTeams(game),matchLabel:match=>matchLabel(match)
  });
