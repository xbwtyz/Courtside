  const {renderStats}=CourtsideGameCenterRender.createGameCenterRender({
    $,document,viewerState,Date,
    statsOverviewMarkup:(...args)=>statsOverviewMarkup(...args),
    statsTeamMarkup:(...args)=>statsTeamMarkup(...args),
    chartsMarkup:(...args)=>chartsMarkup(...args),
    boxScoreMarkup:(...args)=>boxScoreMarkup(...args),
    inspectChart:(...args)=>inspectChart(...args),
    getActiveChart:()=>activeChart,setActiveChart:value=>{activeChart=value;}
  });
