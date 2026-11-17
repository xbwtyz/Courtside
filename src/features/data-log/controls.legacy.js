  // Courtside 1.5.6 — Data Log controls. All browsing is local-only.
  $('dataLogSource').addEventListener('change',event=>{dataLog.source=event.target.value;dataLog.shown=50;renderDataLog();});
  $('dataLogOutcome').addEventListener('change',event=>{dataLog.outcome=event.target.value;dataLog.shown=50;renderDataLog();});
  $('dataLogSearch').addEventListener('input',event=>{dataLog.search=event.target.value.trim();dataLog.shown=50;renderDataLog();});
  $('dataLogPause').addEventListener('click',()=>{dataLog.paused=!dataLog.paused;renderDataLog();});
  $('dataLogClear').addEventListener('click',()=>{
    if(!confirm('Clear retained request history? Comparison baselines will be preserved.'))return;
    dataLog.entries.length=0;dataLog.dropped=0;dataLog.shown=50;renderDataLog();
  });
  $('dataLogExport').addEventListener('click',dataLogExport);
  $('dataLogMore').addEventListener('click',()=>{dataLog.shown+=50;renderDataLog();});

