  const {formatStart,gameMarkupCache,getStatus,teamData,logoHTML,scoreHTML,detailHTML,gameCard,sectionHTML,patchGameDOM,reconcileGameSections,render}=CourtsideScoreboardRender.createScoreboardRender({
    $,document,Node,Date,WeakMap,getState:()=>state,
    safe:(...args)=>safe(...args),safeLogo:(...args)=>safeLogo(...args)
  });
