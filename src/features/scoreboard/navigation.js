  CourtsideScoreboardNavigation.registerScoreboardNavigation({
    $,getState:()=>state,
    changeDay:(...args)=>changeDay(...args),selectDay:(...args)=>selectDay(...args),
    today:(...args)=>today(...args),setMainView:(...args)=>setMainView(...args),
    render:(...args)=>render(...args),fetchScores:(...args)=>fetchScores(...args)
  });
