/** Register the refresh-panel Settings shortcut; do not capture the dialog eagerly. */
export function registerSettingsShortcut({ $, openAppSettings }){
  // Settings events are registered near the end after leaderboard definitions.
  $('refreshSettingsToggle').addEventListener('click',()=>openAppSettings('data'));

}
