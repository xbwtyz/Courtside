  function validAuraUrl(value){
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      const trusted = host === 'aurasports.xyz' || host.endsWith('.aurasports.xyz') ||
        host === 'aurasportsplayer.cfd' || host.endsWith('.aurasportsplayer.cfd');
      return url.protocol === 'https:' && trusted ? url.href : '';
    } catch { return ''; }
  }

  function validPpvUrl(value){
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      // PPV embeds use third-party hosts which can change. Require public HTTPS URLs.
      if(url.protocol !== 'https:' || url.username || url.password ||
        host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') ||
        /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) return '';
      return url.href;
    } catch { return ''; }
  }

  // Only allow the provider's documented embed endpoints, not arbitrary URLs
  // supplied by its API (or unrelated domains).
  function validMatchoraUrl(value){
    try {
      const url=new URL(value);
      if(url.protocol!=='https:' || url.username || url.password) return '';
      if(!['matchora.to','matchora.pro','es.matchora.pro'].includes(url.hostname.toLowerCase()))return '';
      if(!/^\/embed\/(?:match|channel)\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname))return '';
      return url.href;
    } catch {return '';}
  }

  function matchSources(match){
    const sources = (Array.isArray(match?.sources) ? match.sources : [])
      .map((s,i)=>({provider:'AuraSports',name:`AuraSports · ${String(s.name||`Source ${i+1}`)}`,url:validAuraUrl(s.url)}))
      .filter(s=>s.url);
    const defaultUrl = validAuraUrl(match?.iframeUrl) || validAuraUrl(match?.watchUrl);
    if(!sources.length && defaultUrl) sources.push({provider:'AuraSports',name:'AuraSports · Default stream',url:defaultUrl});
    return [...new Map(sources.map(s=>[s.url,s])).values()];
  }

  function matchLabel(match){
    const away=match?.teams?.away?.name, home=match?.teams?.home?.name;
    return String(match?.title || (away&&home?`${away} at ${home}`:'NBA matchup'));
  }

  async function fetchAuraSchedule(force=false){
    if(!force && auraUpdatedAt && Date.now()-auraUpdatedAt < AURA_TTL_MS) return auraGames;
    if(auraPending) return auraPending;
    auraPending = (async()=>{
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),12000);
      try {
        const response = await fetch(AURA_API,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const categories = await response.json();
        if(!Array.isArray(categories)) throw new Error('Unexpected AuraSports schedule format');
        const nba = categories.filter(c=>String(c.category_name||'').toLowerCase()==='nba')
          .flatMap(c=>Array.isArray(c.schedule)?c.schedule:[]);
        const byId = new Map();
        for(const match of nba){
          if(match.category && String(match.category).toLowerCase()!=='nba') continue;
          const id = /^espn-(\d+)$/.exec(String(match.match_id||''))?.[1];
          if(id) byId.set(id,match);
        }
        auraGames=byId;
        auraUpdatedAt=Date.now();
        return auraGames;
      } finally { clearTimeout(timeout); }
    })().finally(()=>{auraPending=null;});
    return auraPending;
  }

  // PPV.st categorizes all basketball together, including NCAA. Treat ESPN's NBA
  // schedule as the authoritative list and only accept events matching BOTH teams.
  function flattenPpvEvents(json){
    const groups=Array.isArray(json) ? json : json?.streams;
    if(!Array.isArray(groups)) throw new Error('Unexpected PPV.st stream index format');
    const output=[];
    for(const group of groups){
      if(!group || typeof group!=='object') continue;
      const category=String(group.category||group.category_name||'').toLowerCase();
      if(category!=='basketball' && category!=='nba') continue;
      if(!Array.isArray(group.streams)) continue;
      for(const event of group.streams){
        if(!event || typeof event!=='object') continue;
        output.push(event);
      }
    }
    return output;
  }

  async function fetchPpvStreams(force=false){
    if(!force && ppvUpdatedAt && Date.now()-ppvUpdatedAt < PPV_TTL_MS) return ppvEvents;
    if(ppvPending) return ppvPending;
    ppvPending = (async()=>{
      let lastError;
      for(const endpoint of PPV_APIS){
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),8500);
        try {
          const response=await fetch(endpoint,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
          if(!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload=await response.json();
          if(payload?.success===false) throw new Error('Provider reported failure');
          const found=flattenPpvEvents(payload);
          ppvEvents=found;
          ppvUpdatedAt=Date.now();
          return ppvEvents;
        }catch(err){lastError=err;
        }finally{clearTimeout(timeout);}
      }
      throw lastError || new Error('Both PPV.st API hosts failed');
    })().finally(()=>{ppvPending=null;});
    return ppvPending;
  }

  async function fetchMatchoraSchedule(force=false){
    if(!force && matchoraUpdatedAt && Date.now()-matchoraUpdatedAt<MATCHORA_TTL_MS)return matchoraEvents;
    if(matchoraPending)return matchoraPending;
    matchoraPending=(async()=>{
      let lastError;
      for(const endpoint of MATCHORA_APIS){
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),10000);
        try {
          const response=await fetch(endpoint,{signal:controller.signal,cache:'no-store',mode:'cors',headers:{Accept:'application/json'}});
          if(!response.ok)throw new Error(`HTTP ${response.status}`);
          const payload=await response.json();
          if(!Array.isArray(payload?.events))throw new Error('Unexpected Matchora schedule format');
          // Accept the current published shape, and ignore all non-NBA games.
          matchoraEvents=payload.events.filter(event=>event && typeof event==='object' &&
            ['nba','national basketball association'].includes(String(event.league||'').trim().toLowerCase()));
          matchoraUpdatedAt=Date.now();
          return matchoraEvents;
        } catch(error){lastError=error;
        } finally {clearTimeout(timeout);}
      }
      throw lastError||new Error('Both Matchora API hosts failed');
    })().finally(()=>{matchoraPending=null;});
    return matchoraPending;
  }

