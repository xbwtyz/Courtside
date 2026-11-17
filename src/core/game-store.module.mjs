/**
 * Central owner of Courtside's selected game date and scoreboard game list.
 * Legacy consumers still receive the SAME mutable `state` object for now.
 * Browser / network / viewer state are deliberately outside this module.
 */
export function createGameStore({ date, defaultLiveOnly }) {
  const state = {
    date, games:[], lastUpdated:null, error:'', loading:false, firstLoaded:false,
    liveOnly:defaultLiveOnly, query:'', nextAt:0, expanded:new Set(), requestSeq:0, controller:null, fetchDate:null
  };
  const observers = new Set();
  function publish(type) {
    if (!observers.size) return;
    // A frozen shallow envelope prevents observers from reordering the owned list.
    // Game objects themselves remain ESPN data and are not deep-frozen.
    const event = Object.freeze({ type, date: state.date, games: Object.freeze([...state.games]) });
    for (const fn of [...observers]) {
      try { fn(event); } catch { /* Observers must never prevent a score refresh. */ }
    }
  }
  function subscribe(observer) {
    if (typeof observer !== 'function') throw new TypeError('Game store subscriber must be a function');
    observers.add(observer);
    return () => observers.delete(observer);
  }
  function replaceGames(games) {
    // Preserve ESPN game object identity and the existing array replacement policy.
    state.games = games;
    publish('scores');
    return games;
  }
  function selectDate(day) {
    // Original selectDay() reset sequence and original expanded Set identity.
    state.date=day;state.games=[];state.expanded.clear();state.error='';
    state.firstLoaded=false;state.lastUpdated=null;state.nextAt=0;
    publish('date');
  }
  function navigateToDate(day) {
    // Player game-log navigation deliberately retains cached games until fetch.
    state.date=day;state.nextAt=0;
    publish('navigation');
  }
  function findGame(id) { return state.games.find(g=>String(g.id)===String(id)); }
  function getSnapshot() {
    return Object.freeze({ date:state.date, games:Object.freeze([...state.games]) });
  }
  return { state, replaceGames, selectDate, navigateToDate, findGame, getSnapshot, subscribe };
}
