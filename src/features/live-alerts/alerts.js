  // Preserve the classic-script alert interface; late-bound shared state and
  // replacement preferences must be read at call time, not module creation.
  const {
    ALERT_TEAMS,
    ALERT_TOAST_DURATION,
    ALERT_HISTORY_LIMIT,
    ALERT_LEAD_COOLDOWN,
    alertsState,
    alertIsActive,
    alertShouldOverlay,
    alertsResetBaseline,
    alertsScore,
    alertsWatchGame,
    alertsAdd,
    alertsObserveScoreboard,
    alertsUpdateToastVisibility,
    alertsRenderToasts,
    alertsPauseToast,
    alertsScheduleToast,
    alertsDismissToast,
    alertsUpdateBells,
    alertsStatusText,
    alertsRenderHistory,
    alertsOpenHistory,
    alertsCloseHistory,
    alertsViewGame,
    alertsMaybeSound,
    alertsRenderTeamChoices,
    alertsSyncSettings,
    alertsInit
  } = CourtsideLiveAlerts.createLiveAlerts({
    $,document,window,Date,setTimeout,clearTimeout,alert,confirm,
    getState:()=>state,getViewerState:()=>viewerState,getPrefs:()=>settingsPrefs,
    today:()=>today(),classify:game=>classify(game),safe:value=>safe(value),
    saveSettingsPrefs:()=>saveSettingsPrefs(),
    openAppSettings:tab=>openAppSettings(tab),openViewer:id=>openViewer(id),
    changeViewerGame:id=>changeViewerGame(id)
  });
