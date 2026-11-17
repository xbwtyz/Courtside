/** Original settings and What's New startup order, with explicit dependencies. */
export function initializeSettings({initWhatsNew,alertsInit,syncSettingsControls,applySettingsPrefs,
  getLanding,setMainView}){
  initWhatsNew();alertsInit();syncSettingsControls();applySettingsPrefs();
  // The chosen launch page is used only at startup; switching tabs never saves a new default.
  if(getLanding()!=='scores')setMainView(getLanding());

}
