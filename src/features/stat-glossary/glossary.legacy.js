  // ========================================================================
  // Courtside 1.5.2: statistical abbreviation glossary, across dynamic tables.
  // One overlay lives outside scroll containers to avoid clipping or sort bugs.
  // ========================================================================
  const statGlossary={
    'GP':['Games Played','Total number of games the player appeared in this season.'],
    'GS':['Games Started','Games in which the player was in the starting lineup.'],
    'MPG':['Minutes Per Game','Average playing time per game.'],
    'MIN':['Minutes Played','Playing time. Leaderboard General shows season totals; individual game tables show time in that game.'],
    'PPG':['Points Per Game','Average points scored per game played.'],
    'PTS':['Points','Total points scored in the relevant season or game.'],
    'FGM/G':['Field Goals Made Per Game','Average successful two- and three-point field goals per game.'],
    'FGA/G':['Field Goal Attempts Per Game','Average two- and three-point shot attempts per game.'],
    'FG%':['Field Goal Percentage','Percentage of all field goal attempts made: field goals made ÷ field goals attempted × 100.'],
    'FG':['Field Goals (Made–Attempted)','Field goals made and attempted, usually displayed as made–attempted.'],
    '3PM/G':['Three-Pointers Made Per Game','Average successful three-point field goals per game.'],
    '3PA/G':['Three-Point Attempts Per Game','Average attempted three-point field goals per game.'],
    '3P%':['Three-Point Percentage','Percentage of three-point attempts made.'],
    '3PT':['Three-Pointers (Made–Attempted)','Three-point field goals made and attempted in the game.'],
    'FTM/G':['Free Throws Made Per Game','Average successful free throws per game.'],
    'FTA/G':['Free Throw Attempts Per Game','Average free throw attempts per game.'],
    'FT%':['Free Throw Percentage','Percentage of free throw attempts made.'],
    'FT':['Free Throws (Made–Attempted)','Free throws made and attempted in the game.'],
    'APG':['Assists Per Game','Average assists per game played.'],
    'AST':['Assists','Passes directly leading to a made basket. Season or single-game total depending on table.'],
    'TOPG':['Turnovers Per Game','Average turnovers committed per game.'],
    'TO':['Turnovers','Times possession was lost to the opposing team.'],
    'AST/TO':['Assist-to-Turnover Ratio','Total assists divided by total turnovers; undefined when turnovers are zero.'],
    'RPG':['Rebounds Per Game','Average offensive and defensive rebounds collected per game.'],
    'REB':['Rebounds','Total rebounds collected from missed shots.'],
    'DD':['Double-Doubles','Games reaching at least 10 in two of points, rebounds, assists, steals or blocks.'],
    'TD':['Triple-Doubles','Games reaching at least 10 in three of points, rebounds, assists, steals or blocks.'],
    'SPG':['Steals Per Game','Average steals recorded per game.'],
    'BPG':['Blocks Per Game','Average blocked shots per game.'],
    'STL':['Steals','Possessions gained by taking the ball away from the opposing team.'],
    'BLK':['Blocks','Opponent field-goal attempts legally deflected to prevent a made shot.'],
    'PF/G':['Personal Fouls Per Game','Average personal fouls committed per game.'],
    'PF':['Personal Fouls','Number of personal fouls committed.'],
    '+/-':['Plus/Minus','Team point differential while this player is on the court.'],
    'OPP':['Opponent','The opposing team in that game.'],
    'W/L':['Win/Loss','Whether the team won or lost the game.'],
    'W–L':['Wins–Losses','Number of wins and losses in the current standings record.'],
    'PCT':['Winning Percentage','Wins divided by games played; the share of games won.'],
    'GB':['Games Behind','Number of games a team trails its conference leader in the standings.'],
    'HOME':['Home Record','Wins and losses in games played at home.'],
    'AWAY':['Away Record','Wins and losses in road games.'],
    'L10':['Last Ten Games','Record over a team’s most recent 10 games.'],
    'STRK':['Current Streak','Consecutive wins or losses entering the next game.']
  };
  const statTip=document.createElement('div');
  statTip.id='csStatTooltip';statTip.className='cs-stat-tooltip';statTip.hidden=true;
  statTip.setAttribute('role','tooltip');document.body.appendChild(statTip);
  let statTipAnchor=null,statTipPinned=false,statDecorateFrame=0;
  function statLabel(th){
    const sort=th.querySelector('button[data-leader-sort],button[data-bs-sort],button[data-player-sort]');
    const label=sort?sort.textContent:[...th.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('');
    return label.replace(/\s*[↓↑▼▲]\s*$/,'').trim().toUpperCase().replace(/\s+%/g,'%');
  }
  function statDetail(th){
    const key=statLabel(th);
    if(statGlossary[key])return {key,...{title:statGlossary[key][0],detail:statGlossary[key][1]}};
    if(/^Q[1-4]$/.test(key))return {key,title:`Quarter ${key.slice(1)}`,detail:`Points scored during the ${['first','second','third','fourth'][Number(key.slice(1))-1]} quarter.`};
    if(/^OT\d+$/.test(key))return {key,title:`Overtime ${key.slice(2)}`,detail:`Points scored during overtime period ${key.slice(2)}.`};
    return null;
  }
  function decorateStatHeaders(){
    // Covers box scores, leaders, standings, player game logs and quarter scores.
    document.querySelectorAll('.bs-table th,.cs-leaders-table th,.cs-player-stats-table th,.cs-standings-table th,.quarters th').forEach(th=>{
      const info=statDetail(th);if(!info||th.dataset.statGlossary===info.key&&th.querySelector('.stat-info'))return;
      th.dataset.statGlossary=info.key;
      let button=th.querySelector('.stat-info');
      if(!button){
        button=document.createElement('button');button.type='button';button.className='stat-info';
        button.textContent='i';button.setAttribute('aria-describedby','csStatTooltip');
        th.appendChild(button);
      }
      button.setAttribute('aria-label',`Explain ${info.key}: ${info.title}`);
    });
    if(statTipAnchor&&!statTipAnchor.isConnected)hideStatTip();
  }
  function scheduleStatHeaders(){
    if(statDecorateFrame)return;
    statDecorateFrame=requestAnimationFrame(()=>{statDecorateFrame=0;decorateStatHeaders();});
  }
  const statObserver=new MutationObserver(scheduleStatHeaders);
  statObserver.observe(document.body,{childList:true,subtree:true});
  function statTipPosition(th){
    const rect=th.getBoundingClientRect(),width=statTip.offsetWidth,height=statTip.offsetHeight;
    const left=Math.min(window.innerWidth-width-12,Math.max(12,rect.left+(rect.width-width)/2));
    const below=rect.bottom+9,top=below+height<window.innerHeight-10?below:Math.max(10,rect.top-height-9);
    statTip.style.left=`${left}px`;statTip.style.top=`${top}px`;
  }
  function showStatTip(th,pin=false){
    const info=statDetail(th);if(!info)return;
    statTipAnchor=th;statTipPinned=pin;
    statTip.innerHTML=`<strong>${safe(info.key)} — ${safe(info.title)}</strong><span>${safe(info.detail)}</span>`;
    statTip.hidden=false;statTipPosition(th);
  }
  function hideStatTip(){statTip.hidden=true;statTipAnchor=null;statTipPinned=false;}
  document.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch'||statTipPinned)return;
    const th=event.target.closest?.('th[data-stat-glossary]');
    if(th&&th!==statTipAnchor)showStatTip(th);
  });
  document.addEventListener('pointerout',event=>{
    if(statTipPinned||!statTipAnchor)return;
    if(statTipAnchor.contains(event.relatedTarget))return;
    if(statTipAnchor.contains(event.target))hideStatTip();
  });
  document.addEventListener('focusin',event=>{
    if(statTipPinned)return;
    const th=event.target.closest?.('th[data-stat-glossary]');
    if(th)showStatTip(th);
  });
  document.addEventListener('focusout',event=>{
    if(!statTipPinned&&statTipAnchor?.contains(event.target)&&!statTipAnchor.contains(event.relatedTarget))hideStatTip();
  });
  // Capturing ensures a touch on the info button never activates sort handlers.
  document.addEventListener('click',event=>{
    const info=event.target.closest?.('button.stat-info');
    if(info){event.preventDefault();event.stopPropagation();showStatTip(info.closest('th'),true);return;}
    if(statTipPinned)hideStatTip();
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!statTip.hidden)hideStatTip();},true);
  window.addEventListener('resize',()=>{if(statTipAnchor)statTipPosition(statTipAnchor);});
  document.addEventListener('scroll',event=>{
    if(event.target?.closest?.('.ticker-window'))return;
    // Tapping an info button may itself scroll a narrow table into view.
    // Keep an explicitly opened explanation visible through that scroll.
    if(statTipPinned&&statTipAnchor?.isConnected){statTipPosition(statTipAnchor);return;}
    if(!statTip.hidden)hideStatTip();
  },true);
  scheduleStatHeaders();

