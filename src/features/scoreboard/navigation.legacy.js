  $('prevDay').addEventListener('click',()=>changeDay(-1));
  $('nextDay').addEventListener('click',()=>changeDay(1));
  $('todayBtn').addEventListener('click',()=>selectDay(today()));
  $('homeLink').addEventListener('click',e=>{e.preventDefault();setMainView('scores');selectDay(today());});
  $('datePicker').addEventListener('change',e=>{if(e.target.value)selectDay(e.target.value);});
  $('teamSearch').addEventListener('input',e=>{state.query=e.target.value;render();});
  $('liveOnly').addEventListener('change',e=>{state.liveOnly=e.target.checked;render();});
  $('refreshBtn').addEventListener('click',()=>fetchScores(true));
