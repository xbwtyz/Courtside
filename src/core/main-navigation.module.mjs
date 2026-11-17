/** Original scores/standings/leaders/log navigation and keyboard arrows. */
export function registerMainNavigation({$,setMainView,fetchStandings}){
  $('csTabScores').addEventListener('click',()=>setMainView('scores'));
  $('csTabStandings').addEventListener('click',()=>setMainView('standings'));
  $('csTabLeaders').addEventListener('click',()=>setMainView('leaders'));
  $('csTabLog').addEventListener('click',()=>setMainView('log'));
  $('standingsRefresh').addEventListener('click',()=>fetchStandings(true));
  $('csTabScores').addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();setMainView('standings');$('csTabStandings').focus();}});
  $('csTabStandings').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();setMainView('scores');$('csTabScores').focus();}if(e.key==='ArrowRight'){e.preventDefault();setMainView('leaders');$('csTabLeaders').focus();}});
  $('csTabLeaders').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();setMainView('standings');$('csTabStandings').focus();}if(e.key==='ArrowRight'){e.preventDefault();setMainView('log');$('csTabLog').focus();}});
  $('csTabLog').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();setMainView('leaders');$('csTabLeaders').focus();}});
}
