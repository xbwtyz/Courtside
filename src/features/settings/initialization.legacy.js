  initWhatsNew();alertsInit();syncSettingsControls();applySettingsPrefs();
  // The chosen launch page is used only at startup; switching tabs never saves a new default.
  if(settingsPrefs.landing!=='scores')setMainView(settingsPrefs.landing);

