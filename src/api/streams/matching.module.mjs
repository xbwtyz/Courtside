/** Original strict ESPN team/date matchers with live stream indexes. */
export function createStreamMatching({cache,getGames,validPpvUrl,validMatchoraUrl,matchSources,Date}){
  const normalized = text => String(text||'').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const nicknames = {
    ATL:['hawks'],BOS:['celtics'],BKN:['nets','brooklyn nets'],CHA:['hornets'],CHI:['bulls'],CLE:['cavaliers','cavs'],
    DAL:['mavericks','mavs'],DEN:['nuggets'],DET:['pistons'],GS:['warriors'],GSW:['warriors'],HOU:['rockets'],
    IND:['pacers'],LAC:['clippers'],LAL:['lakers'],MEM:['grizzlies'],MIA:['heat'],MIL:['bucks'],MIN:['timberwolves','wolves'],
    NOP:['pelicans','pels'],NY:['knicks'],NYK:['knicks'],OKC:['thunder'],ORL:['magic'],PHI:['76ers','sixers','seventy sixers'],
    PHX:['suns'],POR:['trail blazers','blazers'],SAC:['kings'],SA:['spurs'],SAS:['spurs'],TOR:['raptors'],UTA:['jazz'],WAS:['wizards']
  };
  function getGameTeams(game){
    const competitors=game?.competitions?.[0]?.competitors||[];
    return [competitors.find(c=>c.homeAway==='away')?.team,competitors.find(c=>c.homeAway==='home')?.team];
  }
  function teamAliases(team){
    if(!team)return [];
    const abbr=String(team.abbreviation||'').toUpperCase();
    const list=[team.displayName,team.shortDisplayName,team.name,...(nicknames[abbr]||[])];
    if(abbr.length===3)list.push(abbr);
    return [...new Set(list.map(normalized).filter(s=>s && s.length>=3))];
  }
  function hasAlias(haystack,aliases){
    const padded=` ${normalized(haystack)} `;
    return aliases.some(token=>padded.includes(` ${token} `));
  }
  function ppvEventMatches(event,game){
    const [away,home]=getGameTeams(game);
    if(!away||!home)return false;
    const name=[event.name,event.title,event.uri_name].filter(Boolean).join(' ');
    if(!hasAlias(name,teamAliases(away)) || !hasAlias(name,teamAliases(home)))return false;
    // Prevent a similarly named game from a previous date being treated as live.
    const scheduled=Date.parse(game.date||'');
    const starts=Number(event.starts_at);
    if(Number.isFinite(scheduled) && starts>0 && Math.abs(scheduled-starts*1000)>9*3600000) return false;
    return true;
  }
  function ppvSourcesForGame(game){
    if(!game)return [];
    const sources=[];
    for(const event of cache.ppvEvents){
      if(!ppvEventMatches(event,game))continue;
      const primary=validPpvUrl(event.iframe || event.embed_url);
      if(primary)sources.push({provider:'PPV.st',name:`PPV.st · ${String(event.tag||'Main broadcast')}`,url:primary});
      if(Array.isArray(event.substreams)){
        for(const [i,sub] of event.substreams.entries()){
          const url=validPpvUrl(sub?.iframe || sub?.embed_url);
          if(!url)continue;
          const name=sub.source_tag||sub.name||sub.label||sub.tag||`Alternative ${i+1}`;
          sources.push({provider:'PPV.st',name:`PPV.st · ${String(name)}`,url});
        }
      }
    }
    return [...new Map(sources.map(s=>[s.url,s])).values()];
  }
  function matchoraEventMatches(event,game){
    const [away,home]=getGameTeams(game);
    if(!away||!home)return false;
    if(!['nba','national basketball association'].includes(String(event.league||'').trim().toLowerCase()))return false;
    // Require the right teams in the right home/away roles. This excludes NBA G League
    // and other basketball fixtures, even if the provider categorizes them together.
    if(!hasAlias(event.away,teamAliases(away))||!hasAlias(event.home,teamAliases(home)))return false;
    const scheduled=Date.parse(game.date||'');
    const kickoff=Number(event.kickoff)*1000;
    // Reject entries that cannot be dated; stale or similarly named listings must
    // never be associated with a different ESPN game.
    if(!Number.isFinite(scheduled)||!Number.isFinite(kickoff)||kickoff<=0)return false;
    return Math.abs(scheduled-kickoff)<=6*3600000;
  }
  function matchoraSourcesForGame(game){
    if(!game)return [];
    const sources=[];
    for(const event of cache.matchoraEvents){
      if(!matchoraEventMatches(event,game))continue;
      const primary=validMatchoraUrl(event.embed_url);
      if(primary)sources.push({provider:'Matchora',name:'Matchora · Match player (choose channel)',url:primary});
      if(Array.isArray(event.channels)){
        for(const [i,ch] of event.channels.slice(0,60).entries()){
          if(!ch||ch.dead===true)continue;
          const url=validMatchoraUrl(ch.embed_url);
          if(!url)continue;
          const channelName=String(ch.name||`Channel ${i+1}`).slice(0,80);
          const quality=String(ch.quality||'').trim().slice(0,12);
          const language=String(ch.lang||'').trim().slice(0,24);
          const extras=[quality,language].filter(Boolean).join(' · ');
          sources.push({provider:'Matchora',name:`Matchora · ${channelName}${extras?' · '+extras:''}`,url});
        }
      }
    }
    return [...new Map(sources.map(source=>[source.url,source])).values()];
  }
  function combinedSourcesForId(id){
    const espn=getGames().find(g=>String(g.id)===String(id));
    const ppv=ppvSourcesForGame(espn);
    const aura=matchSources(cache.auraGames.get(String(id)));
    const matchora=matchoraSourcesForGame(espn);
    // PPV.st is the default when available. Manual source changes are retained
    // because paintPlayer() only replaces a URL that's no longer in the list.
    return [...ppv,...aura,...matchora];
  }
  return {normalized,nicknames,getGameTeams,teamAliases,hasAlias,ppvEventMatches,ppvSourcesForGame,matchoraEventMatches,matchoraSourcesForGame,combinedSourcesForId};
}
