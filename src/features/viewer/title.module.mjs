/** Resolve the Viewer title from current ESPN games, then current AuraSports cache. */
export function createViewerTitle({getGames,getAuraGames,getGameTeams,matchLabel}){
function viewerGameTitle(id){
  const espn=getGames().find(g=>String(g.id)===String(id));
  if(espn){const [away,home]=getGameTeams(espn);return `${away?.displayName||away?.name||'Away'} at ${home?.displayName||home?.name||'Home'}`;}
  const match=getAuraGames().get(String(id));
  return match?matchLabel(match):'NBA game';
}
  return {viewerGameTitle};
}
