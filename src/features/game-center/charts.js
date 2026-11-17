  // Preserve original global chart state across Game Center tabs and handlers.
  let activeChart=null;
  const {resetChartGame,chartNumber,chartClock,chartPeriodLabel,chartModel,chartWidth,chartTeamLegend,chartSelected,chartDetail,chartStepPath,lineChartMarkup,shotDetail,shotChartMarkup,chartsMarkup,setChartView,inspectChart,inspectShot,inspectChartPointer,chartInput,chartKeydown}=CourtsideGameCenterCharts.createGameCenterCharts({
    $,window,viewerState,Date,Math,Map,Set,Number,String,
    safe:(...args)=>safe(...args),getState:()=>state,
    renderStats:(...args)=>renderStats(...args),
    getActiveChart:()=>activeChart,setActiveChart:value=>{activeChart=value;}
  });
