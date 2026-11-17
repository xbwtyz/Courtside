  // Preserve original resize bookkeeping as one classic-script state owner.
  let chartResizeWidth=0,chartResizeFrame=0;
  CourtsideGameCenterHandlers.registerGameCenterHandlers({
    $,viewerState,getState:()=>state,Math,
    ResizeObserver:typeof ResizeObserver==='undefined'?undefined:ResizeObserver,
    requestAnimationFrame:(...args)=>requestAnimationFrame(...args),
    cancelAnimationFrame:(...args)=>cancelAnimationFrame(...args),
    setStatsTab:(...args)=>setStatsTab(...args),
    setChartView:(...args)=>setChartView(...args),
    inspectShot:(...args)=>inspectShot(...args),
    renderStats:(...args)=>renderStats(...args),
    chartInput:(...args)=>chartInput(...args),
    inspectChartPointer:(...args)=>inspectChartPointer(...args),
    chartKeydown:(...args)=>chartKeydown(...args),
    getChartResizeWidth:()=>chartResizeWidth,
    setChartResizeWidth:value=>{chartResizeWidth=value;},
    getChartResizeFrame:()=>chartResizeFrame,
    setChartResizeFrame:value=>{chartResizeFrame=value;}
  });
