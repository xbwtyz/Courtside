  // One dialog instance, with private focus state and injected event dependencies.
  const {syncSettingsControls,selectAppSettingsTab,openAppSettings,closeAppSettings}=
    CourtsideSettingsDialog.createSettingsDialog({
      $,document,window,confirm,
      getPrefs:()=>settingsPrefs,setPrefs:next=>{settingsPrefs=next;},
      getStorageAvailable:()=>settingsStorageAvailable,SETTINGS_DEFAULTS,
      saveSettingsPrefs,applySettingsPrefs,alertsSyncSettings,renderDataLogPerformance,
      markWhatsNewRead,renderWhatsNew,alertsUpdateToastVisibility,leaderSetCategory,
      leaderState,renderLeaders,alertsResetBaseline,alertsRenderToasts
    });
