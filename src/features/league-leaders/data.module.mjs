/** League-wide ESPN page collection, validation, normalization, and one shared leaderboard cache. */
export function createLeagueLeadersData({settingsPrefs,profileSeasonYear,teamDirectory,safeLogo,simpleId,fetchFeatureJson,dataLogObserve,dataLogLeadersRecords,dataLogInvalid,renderLeaders,getMainView,document,Date,Math,Number,String,Object,Map,Set,Array}){
  // ========================================================================
  // Courtside 1.5.4 release notes: persisted Live Only startup and Game Center
  // defaults (tab, 1/2/4-screen layout, sidebar, viewer ticker). The settings
  // are only applied when the relevant page/viewer starts, preserving any
  // temporary viewer adjustments and active streams.
  // Courtside 1.5.3 release notes: app-wide settings dialog, persisted startup/ticker/leaderboard preferences,
  // integrated ESPN refresh diagnostics; no changes to polling frequencies or stream behavior.
  // Courtside 1.5.2 release notes: draggable / touch-scrollable dual tickers,
  // accessible glossary tooltips for statistical table headings; preserves
  // 1.5.1 scheduler and incremental rendering.
  // Courtside 1.5.1: full-body request accounting, high-priority
  // dispatch past slow leaderboard pages, stable ticker animation, incremental
  // scoreboard DOM updates, and focus-preserving leaderboard rendering.
  // Courtside 1.5 release notes: complete ESPN-paginated NBA statistical
  // leaderboard, six local categories, local sorting/filtering/ties, lazy load,
  // 30-minute cache, and priority-aware requests. Stream slots are unchanged.
  // ========================================================================
  const LEADERS_API='https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete';
  const LEADERS_TTL_MS=30*60*1000;
  const NBA_TEAMS=[
    ['1','ATL','Atlanta Hawks'],['2','BOS','Boston Celtics'],['17','BKN','Brooklyn Nets'],
    ['30','CHA','Charlotte Hornets'],['4','CHI','Chicago Bulls'],['5','CLE','Cleveland Cavaliers'],
    ['6','DAL','Dallas Mavericks'],['7','DEN','Denver Nuggets'],['8','DET','Detroit Pistons'],
    ['9','GS','Golden State Warriors'],['10','HOU','Houston Rockets'],['11','IND','Indiana Pacers'],
    ['12','LAC','LA Clippers'],['13','LAL','Los Angeles Lakers'],['29','MEM','Memphis Grizzlies'],
    ['14','MIA','Miami Heat'],['15','MIL','Milwaukee Bucks'],['16','MIN','Minnesota Timberwolves'],
    ['3','NO','New Orleans Pelicans'],['18','NY','New York Knicks'],['25','OKC','Oklahoma City Thunder'],
    ['19','ORL','Orlando Magic'],['20','PHI','Philadelphia 76ers'],['21','PHX','Phoenix Suns'],
    ['22','POR','Portland Trail Blazers'],['23','SAC','Sacramento Kings'],['24','SA','San Antonio Spurs'],
    ['28','TOR','Toronto Raptors'],['26','UTAH','Utah Jazz'],['27','WSH','Washington Wizards']
  ];
  const leaderTeamMap=new Map(NBA_TEAMS.map(([id,abbr,name])=>[id,{id,abbr,name}]));
  const leaderStats={
    gp:{label:'GP',aliases:['gamesPlayed','games','gp'],groups:['general','offensive','defensive']},
    mpg:{label:'MPG',aliases:['avgMinutes','minutesPerGame','avgMinutesPlayed','avgMin'],groups:['general','offensive']},
    minutes:{label:'MIN',aliases:['minutes','totalMinutes','minutesPlayed'],groups:['general','offensive']},
    ppg:{label:'PPG',aliases:['avgPoints','pointsPerGame'],groups:['offensive','general']},
    points:{label:'PTS',aliases:['points','totalPoints'],groups:['offensive','general']},
    fgm:{label:'FGM/G',aliases:['avgFieldGoalsMade','fieldGoalsMadePerGame'],groups:['offensive','shooting']},
    fga:{label:'FGA/G',aliases:['avgFieldGoalsAttempted','fieldGoalsAttemptedPerGame'],groups:['offensive','shooting']},
    fgPct:{label:'FG%',aliases:['fieldGoalPct','fieldGoalPercentage','fieldGoalsPct','fgPct'],groups:['offensive','shooting']},
    threeMade:{label:'3PM/G',aliases:['avgThreePointFieldGoalsMade','avgThreePointMade','threePointFieldGoalsMadePerGame'],groups:['offensive','shooting']},
    threeAtt:{label:'3PA/G',aliases:['avgThreePointFieldGoalsAttempted','avgThreePointAttempted','threePointFieldGoalsAttemptedPerGame'],groups:['offensive','shooting']},
    threePct:{label:'3P%',aliases:['threePointFieldGoalPct','threePointPct','threePointFieldGoalPercentage','threePointFieldGoalsPct','threePointShootingPct'],groups:['offensive','shooting']},
    ftMade:{label:'FTM/G',aliases:['avgFreeThrowsMade','freeThrowsMadePerGame'],groups:['offensive','shooting']},
    ftAtt:{label:'FTA/G',aliases:['avgFreeThrowsAttempted','freeThrowsAttemptedPerGame'],groups:['offensive','shooting']},
    ftPct:{label:'FT%',aliases:['freeThrowPct','freeThrowPercentage','freeThrowsPct'],groups:['offensive','shooting']},
    apg:{label:'APG',aliases:['avgAssists','assistsPerGame'],groups:['offensive','general']},
    assists:{label:'AST',aliases:['assists','totalAssists'],groups:['offensive','general']},
    topg:{label:'TOPG',aliases:['avgTurnovers','turnoversPerGame'],groups:['offensive','general']},
    turnovers:{label:'TO',aliases:['turnovers','totalTurnovers'],groups:['offensive','general']},
    rpg:{label:'RPG',aliases:['avgRebounds','reboundsPerGame'],groups:['general','offensive','rebounding','defensive']},
    rebounds:{label:'REB',aliases:['rebounds','totalRebounds'],groups:['general','offensive','rebounding','defensive']},
    dd:{label:'DD',aliases:['doubleDoubles','doubleDouble'],groups:['general','offensive']},
    td:{label:'TD',aliases:['tripleDoubles','tripleDouble'],groups:['general','offensive']},
    spg:{label:'SPG',aliases:['avgSteals','stealsPerGame'],groups:['defensive','general']},
    bpg:{label:'BPG',aliases:['avgBlocks','blocksPerGame','avgBlockedShots'],groups:['defensive','general']},
    steals:{label:'STL',aliases:['steals','totalSteals'],groups:['defensive','general']},
    blocks:{label:'BLK',aliases:['blocks','totalBlocks','blockedShots'],groups:['defensive','general']},
    pfg:{label:'PF/G',aliases:['avgFouls','avgPersonalFouls','personalFoulsPerGame'],groups:['general','defensive']},
    astto:{label:'AST/TO',aliases:[],groups:[]}
  };
  const leaderCategorySpec={
    scoring:{label:'Scoring',columns:['gp','mpg','ppg','points','fgm','fga'],options:['ppg','points','fgm','fga']},
    shooting:{label:'Shooting',columns:['gp','fgPct','fga','threeMade','threeAtt','threePct','ftPct','ftMade'],options:['threeMade','fgPct','threePct','ftPct','threeAtt','ftMade']},
    playmaking:{label:'Playmaking',columns:['gp','apg','topg','assists','turnovers','astto'],options:['apg','assists','topg','astto']},
    rebounding:{label:'Rebounding',columns:['gp','rpg','rebounds','dd','td'],options:['rpg','rebounds','dd','td']},
    defense:{label:'Defense',columns:['gp','spg','bpg','steals','blocks'],options:['spg','bpg','steals','blocks']},
    general:{label:'General',columns:['gp','mpg','minutes','pfg','dd','td'],options:['mpg','gp','minutes','pfg','dd','td']}
  };
  const leaderState={
    players:[],at:0,season:0,error:'',loading:false,pending:null,progress:'Not loaded',failures:0,
    category:settingsPrefs.leadersCategory,metric:({scoring:'ppg',shooting:'threeMade',playmaking:'apg',rebounding:'rpg',defense:'spg',general:'mpg'})[settingsPrefs.leadersCategory],desc:true,team:'all',position:'all',games:5,minutes:0,gamesCustom:false,minutesCustom:false,
    volume:'auto',volumeCustom:2,query:'',rows:settingsPrefs.leadersRows,page:1,sortKey:'ppg',dataCount:0,
    verifiedGroups:new Set(),missingMetrics:[],missingTeamCount:0,lastScroll:0
  };
  const leaderClean=k=>String(k||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  function leaderNumeric(value){
    if(value===null||value===undefined||value===''||value==='—'||value==='-')return null;
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    const s=String(value).trim().replace(/,/g,'');
    if(/^\d+:\d{2}$/.test(s)){const [m,sec]=s.split(':').map(Number);return m+sec/60;}
    const n=Number(s.endsWith('%')?s.slice(0,-1):s);
    return Number.isFinite(n)?n:null;
  }
  function leaderStatObject(row,categories){
    const result={};
    const categoryNames=new Map((categories||[]).map(c=>[String(c.name||'').toLowerCase(),c.names||[]]));
    for(const block of row.categories||[]){
      const group=String(block.name||'').toLowerCase();
      if(!group)continue;
      const names=categoryNames.get(group)||block.names||[];
      const vals=Array.isArray(block.values)&&block.values.length?block.values:block.totals||[];
      if(Array.isArray(vals)){
        for(let i=0;i<Math.min(names.length,vals.length);i++){
          const key=leaderClean(names[i]);if(!key)continue;
          result[`${group}.${key}`]=leaderNumeric(vals[i]);
        }
      }else if(vals&&typeof vals==='object'){
        for(const [name,value] of Object.entries(vals))result[`${group}.${leaderClean(name)}`]=leaderNumeric(value);
      }
    }
    return result;
  }
  function leaderExtract(raw,stat){
    const spec=leaderStats[stat];if(!spec)return null;
    for(const group of spec.groups)for(const alias of spec.aliases){
      const key=`${group}.${leaderClean(alias)}`;
      if(Object.hasOwn(raw,key)&&raw[key]!==null)return raw[key];
    }
    return null;
  }
  function leaderNormalize(aw,categories){
    const a=aw?.athlete||{},id=simpleId(a.id),name=String(a.displayName||a.fullName||'').trim();
    if(!id||!name)throw new Error('ESPN supplied a leaderboard entry without a usable athlete ID or name.');
    const tid=simpleId(a.teamId||a.team?.id);
    const known=leaderTeamMap.get(tid),teamFromDirectory=teamDirectory.get(tid);
    const teamName=teamFromDirectory?.name||known?.name||a.teamName||a.team?.displayName||'';
    const teamAbbr=teamFromDirectory?.abbr||known?.abbr||a.team?.abbreviation||'';
    const pos=String(a.position?.abbreviation||a.position?.name||a.position||'').toUpperCase();
    const logos=Array.isArray(a.teamLogos)?a.teamLogos:[];
    const raw=leaderStatObject(aw,categories);
    const v={};for(const key of Object.keys(leaderStats))if(key!=='astto')v[key]=leaderExtract(raw,key);
    // Convert per-game stats only from exact season totals when ESPN lacks the average.
    const gp=v.gp;
    const derived={ppg:'points',apg:'assists',rpg:'rebounds',topg:'turnovers',spg:'steals',bpg:'blocks',mpg:'minutes'};
    for(const [avg,total] of Object.entries(derived))if(v[avg]===null&&gp>0&&v[total]!==null)v[avg]=v[total]/gp;
    for(const [avg,total] of [['fgm','fieldGoalsMade'],['fga','fieldGoalsAttempted'],['threeMade','threePointFieldGoalsMade'],['threeAtt','threePointFieldGoalsAttempted'],['ftMade','freeThrowsMade'],['ftAtt','freeThrowsAttempted']]){
      if(v[avg]===null&&gp>0){
        for(const group of ['offensive','shooting']){
          const n=raw[`${group}.${leaderClean(total)}`];
          if(n!==undefined&&n!==null){v[avg]=n/gp;break;}
        }
      }
    }
    for(const k of ['fgPct','threePct','ftPct'])if(v[k]!==null&&v[k]>=0&&v[k]<=1)v[k]*=100;
    if(v.astto===undefined)v.astto=(v.turnovers!==null&&v.turnovers>0&&v.assists!==null)?v.assists/v.turnovers:null;
    return {id,name,teamId:tid,teamName,teamAbbr,pos,jersey:a.jersey||'',
      headshot:safeLogo(a.headshot?.href||a.headshot)||`https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`,
      teamLogo:safeLogo(logos[0]?.href||a.team?.logo)||'',raw,v};
  }
  function leaderPagePayload(json,requestedPage,season){
    if(!json||!Array.isArray(json.athletes)||!Array.isArray(json.categories))throw new Error('Unexpected ESPN leaderboard response (athletes/categories missing).');
    const pg=json.pagination||{};
    const count=leaderNumeric(pg.count),pages=leaderNumeric(pg.pages),page=leaderNumeric(pg.page);
    if(!Number.isInteger(count)||count<1||!Number.isInteger(pages)||pages<1||pages>100||page!==requestedPage)
      throw new Error('ESPN did not return valid pagination metadata; cannot prove rankings are complete.');
    const served=leaderNumeric(json.currentSeason?.year);
    if(served!==season)throw new Error(`ESPN served season ${served??'unknown'}, expected ${season}. Rankings withheld to avoid mixing seasons.`);
    const phase=json.currentSeason?.type;
    const phaseId=leaderNumeric(typeof phase==='object'?phase?.id:phase);
    if(phaseId!==null&&phaseId!==2)throw new Error(`ESPN served season type ${phaseId} instead of regular season (2).`);
    if(json.athletes.length===0)throw new Error('ESPN returned an empty page, so the league dataset is incomplete.');
    return {count,pages,athletes:json.athletes.map(row=>leaderNormalize(row,json.categories))};
  }
  async function fetchLeaders(force=false){
    if(leaderState.pending)return leaderState.pending;
    const season=profileSeasonYear();
    if(!force&&leaderState.at&&leaderState.season===season&&Date.now()-leaderState.at<LEADERS_TTL_MS)return leaderState.players;
    if(document.hidden)return leaderState.players;
    leaderState.loading=true;leaderState.error='';leaderState.progress='Connecting to ESPN...';renderLeaders();
    const task=(async()=>{
      let lastInvalidResponse=null;
      try{
        // Ask for a large first page, but trust the returned pagination, not our requested limit.
        // The default category is intentionally unfiltered: ESPN documents that it includes all stat groups.
        const all=[];let count=0,pages=0,lastLeadersJson=null;
        for(let n=1;n<=100;n++){
          const url=`${LEADERS_API}?season=${season}&seasontype=2&limit=500&page=${n}`;
          const json=await fetchFeatureJson(url,3);
          lastLeadersJson=json;lastInvalidResponse=json;
          const result=leaderPagePayload(json,n,season);
          lastInvalidResponse=null;
          if(n===1){count=result.count;pages=result.pages;}
          else if(result.count!==count||result.pages!==pages)throw new Error('ESPN pagination changed while loading; dataset not published.');
          all.push(...result.athletes);
          leaderState.progress=`Loading ESPN pages: ${n}/${pages} · ${all.length}/${count} player entries`;
          if(getMainView()==='leaders')renderLeaders();
          if(n===pages)break;
        }
        // Final aggregate checks can invalidate the last page when incomplete.
        lastInvalidResponse=lastLeadersJson;
        // Exact count and ESPN ID uniqueness are required. No partial replacement.
        const players=new Map();
        for(const p of all){if(players.has(p.id))throw new Error(`Duplicate ESPN athlete ${p.id} across pages.`);players.set(p.id,p);}
        if(all.length!==count||players.size!==count)throw new Error(`ESPN returned ${all.length} unique entries but advertised ${count}.`);
        const values=[...players.values()];
        // Require the core population and at least one numerical value in each principal field.
        for(const key of ['gp','ppg','rpg','apg','spg','bpg','fgPct','threePct','ftPct','mpg']){
          if(!values.some(p=>p.v[key]!==null))throw new Error(`ESPN omitted ${leaderStats[key].label}; the selected season cannot support complete six-category rankings.`);
        }
        // Only compare complete, validated leaderboard snapshots, never individual pages.
        dataLogObserve(lastLeadersJson,`leaders:${season}`,()=>dataLogLeadersRecords(values));
        // Only swap in the new data after all validation succeeds.
        for(const p of values)if(p.teamId){
          const prior=teamDirectory.get(p.teamId)||{};
          teamDirectory.set(p.teamId,{...prior,id:p.teamId,name:prior.name||p.teamName,short:prior.short||p.teamName,abbr:prior.abbr||p.teamAbbr,logo:prior.logo||p.teamLogo});
        }
        leaderState.missingMetrics=Object.keys(leaderStats).filter(k=>k!=='astto'&&!values.some(p=>p.v[k]!==null));
        leaderState.missingTeamCount=values.filter(p=>!p.teamId).length;
        leaderState.players=values;leaderState.dataCount=count;leaderState.at=Date.now();leaderState.season=season;
        leaderState.error='';leaderState.failures=0;leaderState.page=1;
        leaderState.progress=`All ${count} ESPN-listed player entries loaded · ${pages} API page${pages===1?'':'s'}.`;
        return values;
      }catch(error){
        if(lastInvalidResponse)dataLogInvalid(lastInvalidResponse,error);
        leaderState.failures++;
        const message=String(error?.message||'Unknown ESPN error');
        leaderState.error=/Failed to fetch|NetworkError|Load failed/i.test(message)
          ?'The ESPN leaderboard request was blocked or failed. Firefox file:// CORS compatibility could not be confirmed. '+message
          :message;
        leaderState.progress='ESPN leaderboard refresh failed.';
        return leaderState.players;
      }finally{leaderState.loading=false;if(getMainView()==='leaders')renderLeaders();}
    })();
    leaderState.pending=task;
    try{return await task;}finally{if(leaderState.pending===task)leaderState.pending=null;if(getMainView()==='leaders')renderLeaders();}
  }
  function leaderVolumeMinimum(){
    const key=leaderState.metric;
    const min={fgPct:5,threePct:2,ftPct:2}[key];
    if(min===undefined)return {on:false,min:0,attempt:null};
    const mode=leaderState.volume;
    return {on:mode!=='off',min:mode==='auto'?min:mode==='custom'?leaderState.volumeCustom:Number(mode),attempt:{fgPct:'fga',threePct:'threeAtt',ftPct:'ftAtt'}[key]};
  }
  function leaderMetricValue(p,key){return p?.v?.[key]??null;}
  return {LEADERS_API,LEADERS_TTL_MS,NBA_TEAMS,leaderTeamMap,leaderStats,leaderCategorySpec,leaderState,leaderClean,leaderNumeric,leaderStatObject,leaderExtract,leaderNormalize,leaderPagePayload,fetchLeaders,leaderVolumeMinimum,leaderMetricValue};
}
