  // Isolated settings persistence with the original shared settingsPrefs binding.
  const settingsPreferences = CourtsideSettingsPreferences.createSettingsPreferences({$,getStorage:()=>localStorage});
  const {SETTINGS_STORAGE_KEY,SETTINGS_DEFAULTS} = settingsPreferences;
  let settingsStorageAvailable=settingsPreferences.isStorageAvailable();
  let settingsPrefs=settingsPreferences.getPrefs();
  function loadSettingsPrefs(){
    const result=settingsPreferences.loadSettingsPrefs();
    settingsStorageAvailable=settingsPreferences.isStorageAvailable();
    return result;
  }
  function saveSettingsPrefs(){
    settingsPreferences.setPrefs(settingsPrefs);
    settingsPreferences.saveSettingsPrefs();
    settingsStorageAvailable=settingsPreferences.isStorageAvailable();
  }
  function applySettingsPrefs(){
    settingsPreferences.setPrefs(settingsPrefs);
    settingsPreferences.applySettingsPrefs();
  }
