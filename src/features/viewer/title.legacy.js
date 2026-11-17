function viewerGameTitle(id){
  const espn=state.games.find(g=>String(g.id)===String(id));
  if(espn){const [away,home]=getGameTeams(espn);return `${away?.displayName||away?.name||'Away'} at ${home?.displayName||home?.name||'Home'}`;}
  const match=auraGames.get(String(id));
  return match?matchLabel(match):'NBA game';
}
