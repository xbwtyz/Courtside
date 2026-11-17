import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createGameCenterBoxScore} from '../src/features/game-center/box-score.module.mjs';
import {createGameCenterCharts} from '../src/features/game-center/charts.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
function fixtures(){
  const game={id:'401000002',_phase:'live',
    competitions:[{competitors:[
      {homeAway:'away',score:'104',linescores:[{displayValue:'22'},{displayValue:'30'}],
        team:{id:'2',abbreviation:'BOS',displayName:'Boston Celtics',shortDisplayName:'Celtics'}},
      {homeAway:'home',score:'102',linescores:[{displayValue:'25'},{displayValue:'28'}],
        team:{id:'18',abbreviation:'NYK',displayName:'New York Knicks',shortDisplayName:'Knicks'}}
    ]}]};
  const summary={
    header:{competitions:[{status:{type:{state:'in',shortDetail:'Q4 2:30'},period:4},
      competitors:[
        {homeAway:'away',score:'104',team:{id:'2',abbreviation:'BOS',displayName:'Boston Celtics'}},
        {homeAway:'home',score:'102',team:{id:'18',abbreviation:'NYK',displayName:'New York Knicks'}}
      ]}]},
    boxscore:{
      teams:[
        {homeAway:'away',team:{id:'2',abbreviation:'BOS'},statistics:[
          {name:'fieldGoalPct',displayValue:'48.1'}, {name:'rebounds',displayValue:'44'}]},
        {homeAway:'home',team:{id:'18',abbreviation:'NYK'},statistics:[
          {name:'fieldGoalPct',displayValue:'46.9'},{name:'rebounds',displayValue:'41'}]}
      ],
      players:[
        {team:{id:'2',abbreviation:'BOS',displayName:'Boston Celtics'},statistics:[{
          keys:['minutes','points','rebounds','assists','plusMinus'],
          labels:['MIN','PTS','REB','AST','+/-'],names:['minutes','points','rebounds','assists','plusMinus'],
          athletes:[
            {athlete:{id:'101',displayName:'Jayson Tatum',jersey:'0',position:{abbreviation:'SF'}},
              starter:true,stats:['34','28','7','5','+8']},
            {athlete:{id:'102',displayName:'Derrick White',position:{abbreviation:'G'}},
              starter:false,stats:['22','18','3','4','+1']},
            {athlete:{id:'103',displayName:'Resting Player'},didNotPlay:true,reason:'Coaches decision',stats:[]}
          ]
        }]},
        {team:{id:'18',abbreviation:'NYK',displayName:'New York Knicks'},statistics:[{
          keys:['minutes','points','rebounds','assists','plusMinus'],
          labels:['MIN','PTS','REB','AST','+/-'],names:['minutes','points','rebounds','assists','plusMinus'],
          athletes:[{athlete:{id:'201',displayName:'Jalen Brunson',position:{abbreviation:'PG'}},
            starter:true,stats:['37','31','2','9','-2']}]
        }]}
      ]
    },
    plays:[
      {id:'p1',sequenceNumber:1,period:{number:1},clock:{displayValue:'10:30'},
        homeScore:2,awayScore:0,text:'Brunson made two point shot',shootingPlay:true,
        pointsAttempted:2,scoringPlay:true,coordinate:{x:21,y:18},team:{id:'18'},
        participants:[{athlete:{id:'201',displayName:'Jalen Brunson'}}]},
      {id:'p2',sequenceNumber:2,period:{number:1},clock:{displayValue:'9:50'},
        homeScore:2,awayScore:3,text:'Tatum made three point shot',shootingPlay:true,
        pointsAttempted:3,scoringPlay:true,coordinate:{x:34,y:22},team:{id:'2'},
        participants:[{athlete:{id:'101',displayName:'Jayson Tatum'}}]},
      {id:'p3',sequenceNumber:3,period:{number:1},clock:{displayValue:'9:00'},
        homeScore:2,awayScore:3,text:'Brunson missed shot',shootingPlay:true,
        pointsAttempted:2,scoringPlay:false,coordinate:{x:16,y:12},team:{id:'18'},
        participants:[{athlete:{id:'201',displayName:'Jalen Brunson'}}]}
    ],
    winprobability:[
      {playId:'p1',homeWinPercentage:.54,tiePercentage:0},
      {playId:'p2',homeWinPercentage:.42,tiePercentage:0},
      {playId:'p3',homeWinPercentage:.4,tiePercentage:0}
    ]
  };
  return {game,summary};
}
async function setup(mode){
  const {game,summary}=fixtures();
  const viewerState={gameId:game.id,statsCache:new Map([[game.id,{at:1794859200000,data:summary}]]),
    boxTeam:null,boxSort:'pts',boxSortDesc:true,boxWide:false,statsError:'',statsTab:'box',statsOpen:true,
    chartView:'lead',shotTeam:'all',shotPlayer:'all',shotPeriod:'all',
    chartSelections:{lead:null,prob:null,shots:null}};
  const state={games:[game]},panel={clientWidth:650,scrollTop:0};
  const $=id=>id==='statsContent'?panel:null;
  const window={getComputedStyle:()=>({paddingLeft:'20px',paddingRight:'20px'})};
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeLogo=x=>String(x||''),simpleId=x=>String(x||'').replace(/[^\d]/g,'');
  const getStatus=()=> 'Q4 2:30';
  let activeChart=null,api;
  if(mode==='modular'){
    const box=createGameCenterBoxScore({viewerState,safe,safeLogo,simpleId,getStatus,Date,Set});
    const charts=createGameCenterCharts({$,window,viewerState,Date,Math,Map,Set,Number,String,safe,
      getState:()=>state,renderStats:()=>{},getActiveChart:()=>activeChart,
      setActiveChart:value=>{activeChart=value;}});
    api={...box,...charts};
  }else{
    const legacyBox=await readFile(join(root,'src/features/game-center/box-score.legacy.js'),'utf8');
    const legacyCharts=await readFile(join(root,'src/features/game-center/charts.legacy.js'),'utf8');
    const context=createContext({$,window,viewerState,state,Date,Math,Map,Set,Number,String,
      safe,safeLogo,simpleId,getStatus,renderStats:()=>{}});
    const names=['gameStatValues','normalizeBoxKey','boxStatKey','parsePlayerBoxscore','getBoxTeams',
      'sortedBoxPlayers','boxScoreMarkup','statsTeamMarkup','statsOverviewMarkup','chartModel',
      'chartNumber','chartClock','lineChartMarkup','shotChartMarkup','chartsMarkup','resetChartGame'];
    runInContext(legacyBox+'\n'+legacyCharts+'\nglobalThis.testApi={'+names.join(',')+',getActiveChart:()=>activeChart};',context);
    api=context.testApi;
  }
  return {api,viewerState,state,game,summary,getActiveChart:()=>mode==='modular'?activeChart:api.getActiveChart()};
}
function evaluate(f){
  const {api,viewerState,game,summary}=f;
  const model=api.chartModel(game,summary);
  const out={
    playerGroups:clone(api.parsePlayerBoxscore(summary)),
    teams:clone(api.getBoxTeams(game,summary)),
    model:{
      teams:clone(model.teams),players:[...model.players.entries()],
      plays:model.plays.map(x=>({id:x.id,time:x.time,home:x.home,away:x.away,lead:x.lead})),
      lead:model.lead.length,probability:model.probability.length,
      shots:model.shots.map(x=>({id:x.id,located:x.located,made:x.made,player:x.player})),
      duration:model.duration,mismatch:model.mismatch,partial:model.partial
    },
    overview:api.statsOverviewMarkup(game,summary),
    team:api.statsTeamMarkup(game,summary),
    compact:api.boxScoreMarkup(game,summary)
  };
  viewerState.boxWide=true;
  out.wide=api.boxScoreMarkup(game,summary);
  viewerState.boxWide=false;
  viewerState.boxTeam='home';
  out.home=api.boxScoreMarkup(game,summary);
  viewerState.boxTeam='away';
  for(const kind of ['lead','prob','shots']){
    viewerState.chartView=kind;
    const markup=api.chartsMarkup(game,summary),active=f.getActiveChart();
    out[kind]={markup,kind:active?.kind,rows:active?.rows.length||0,index:active?.index||0};
  }
  viewerState.shotTeam='18';
  viewerState.chartView='shots';
  out.filteredShots=api.chartsMarkup(game,summary);
  out.shotRows=f.getActiveChart()?.rows.length;
  api.resetChartGame();
  out.reset={selected:clone(viewerState.chartSelections),shotTeam:viewerState.shotTeam,
    chart:f.getActiveChart()};
  return out;
}
test('Game Center player parsing, wide/compact sorting, comparisons, overview and charts match frozen 1.6.1',async()=>{
  const old=evaluate(await setup('legacy'));
  const mod=evaluate(await setup('modular'));
  assert.deepEqual(clone(mod),clone(old));
  assert.equal(mod.playerGroups.length,2);
  assert.equal(mod.model.lead,3);
  assert.equal(mod.model.probability,3);
  assert.equal(mod.model.shots.length,3);
  assert.equal(mod.lead.kind,'lead');assert.equal(mod.prob.kind,'prob');assert.equal(mod.shots.kind,'shots');
  assert.equal(mod.shotRows,2);
  assert.match(mod.compact,/Jayson Tatum/);
  assert.match(mod.wide,/Wide table/);
  assert.match(mod.team,/Team comparison/);
  assert.match(mod.overview,/Top performers/);
  assert.equal(mod.reset.chart,null);
});
test('chart model rejects invalid clock, coordinates, and win-probability records identically',async()=>{
  const before=await setup('legacy'),after=await setup('modular');
  function inspect(f){
    const {api,game,summary}=f;
    summary.plays.push({id:'bad',period:{number:99},clock:{displayValue:'NaN'},
      homeScore:'?',awayScore:null,shootingPlay:true});
    summary.winprobability.push({playId:'p2',homeWinPercentage:4,tiePercentage:0});
    summary.plays[0].coordinate={x:100,y:-100};
    const model=api.chartModel(game,summary);
    return {plays:model.plays.map(x=>x.id),valid:model.shots.map(x=>x.located),
      lead:model.lead.length,probability:model.probability.length,
      clock:[api.chartClock('3:15'),api.chartClock('2:70'),api.chartClock('invalid')],
      numbers:[api.chartNumber(null),api.chartNumber('25'),api.chartNumber(true)]};
  }
  assert.deepEqual(clone(inspect(after)),clone(inspect(before)));
});
test('shared activeChart state remains wired to the classic adapter and Game Center renderer',async()=>{
  const charts=await readFile(join(root,'src/features/game-center/charts.js'),'utf8');
  const render=await readFile(join(root,'src/features/game-center/render.js'),'utf8');
  const chartModule=await readFile(join(root,'src/features/game-center/charts.module.mjs'),'utf8');
  assert.match(charts,/let activeChart=null/);
  for(const text of [charts,render]){
    assert.match(text,/getActiveChart:\(\)=>activeChart/);
    assert.match(text,/setActiveChart:value=>\{activeChart=value;\}/);
  }
  assert.match(chartModule,/setActiveChart\(/);
  assert.match(chartModule,/getActiveChart\(/);
  assert.doesNotMatch(chartModule,/setInterval\s*\(|\bfetch\s*\(/);
});
