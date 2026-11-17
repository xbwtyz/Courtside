/** Attach original scoreboard date, search, filtering and manual refresh controls. */
export function registerScoreboardNavigation({$,getState,changeDay,selectDay,today,setMainView,render,fetchScores}){
  $('prevDay').addEventListener('click',()=>changeDay(-1));
  $('nextDay').addEventListener('click',()=>changeDay(1));
  $('todayBtn').addEventListener('click',()=>selectDay(today()));
  $('homeLink').addEventListener('click',e=>{e.preventDefault();setMainView('scores');selectDay(today());});
  $('datePicker').addEventListener('change',e=>{if(e.target.value)selectDay(e.target.value);});
  $('teamSearch').addEventListener('input',e=>{getState().query=e.target.value;render();});
  $('liveOnly').addEventListener('change',e=>{getState().liveOnly=e.target.checked;render();});
  $('refreshBtn').addEventListener('click',()=>fetchScores(true));
}
