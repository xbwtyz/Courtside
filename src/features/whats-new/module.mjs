/**
 * Isolated, dependency-injected What's New controller.
 * This module is imported natively by the Node build and tested independently.
 * It is embedded as a classic-script factory in the final standalone HTML.
 * Keep the factory self-contained: all external dependencies arrive as parameters.
 */
export function createWhatsNew({ $, safe, releases: WHATS_NEW_RELEASES,
                                currentRelease: COURTSIDE_RELEASE, getStorage }) {
  const WHATS_NEW_SEEN_KEY='courtside.whatsnew.seen.v1';
  const WHATS_NEW_SELECTED_KEY='courtside.whatsnew.selected.v1';
  let whatsNewSeenThisSession=false;
  let whatsNewSelected=WHATS_NEW_RELEASES[0].version;
  function whatsNewReadStored(key){
    try{return getStorage().getItem(key)||'';}catch{return '';}
  }
  function whatsNewWriteStored(key,value){
    try{getStorage().setItem(key,value);}catch{/* Local-file privacy settings can disable storage. */}
  }
  function updateWhatsNewIndicators(){
    const unread=!whatsNewSeenThisSession&&whatsNewReadStored(WHATS_NEW_SEEN_KEY)!==COURTSIDE_RELEASE;
    for(const id of ['whatsNewNavBadge','whatsNewMainDot','whatsNewViewerDot'])$(id).hidden=!unread;
    $('appSettingsOpen').setAttribute('aria-label',unread?'Open Courtside settings; new release notes available':'Open Courtside settings');
    $('viewerSettingsOpen').setAttribute('aria-label',unread?'Courtside settings; new release notes available':'Courtside settings');
  }
  function markWhatsNewRead(){
    whatsNewSeenThisSession=true;
    whatsNewWriteStored(WHATS_NEW_SEEN_KEY,COURTSIDE_RELEASE);
    updateWhatsNewIndicators();
  }
  function renderWhatsNew(){
    const index=WHATS_NEW_RELEASES.findIndex(r=>r.version===whatsNewSelected);
    const i=index>=0?index:0,release=WHATS_NEW_RELEASES[i];
    whatsNewSelected=release.version;
    $('whatsNewVersion').value=release.version;
    $('whatsNewOlder').disabled=i===WHATS_NEW_RELEASES.length-1;
    $('whatsNewNewer').disabled=i===0;
    $('whatsNewCount').textContent=`${i+1} of ${WHATS_NEW_RELEASES.length}`;
    const note=release.reconstructed?'<p class="cs-wn-historical">This older release summary was reconstructed from development discussions; the exact original version attribution has not been independently verified.</p>':'';
    $('whatsNewDetails').innerHTML=`<div class="cs-wn-release-head"><span class="cs-wn-version">VERSION ${safe(release.version)}</span><h4 id="whatsNewReleaseTitle">${safe(release.title)}</h4><span class="cs-wn-type">${safe(release.type)}</span></div><div class="cs-wn-changes">${release.changes.map(([kind,description])=>`<div class="cs-wn-change"><span class="cs-wn-kind ${['Added','Improved','Fixed'].includes(kind)?kind.toLowerCase():''}">${safe(kind)}</span><p>${safe(description)}</p></div>`).join('')}</div>${note}`;
    $('whatsNewAnnounce').textContent=`Showing version ${release.version}: ${release.title}`;
    whatsNewWriteStored(WHATS_NEW_SELECTED_KEY,release.version);
  }
  function initWhatsNew(){
    const select=$('whatsNewVersion');
    select.innerHTML=WHATS_NEW_RELEASES.map(r=>`<option value="${safe(r.version)}">v${safe(r.version)} — ${safe(r.title)}</option>`).join('');
    const saved=whatsNewReadStored(WHATS_NEW_SELECTED_KEY);
    if(WHATS_NEW_RELEASES.some(r=>r.version===saved))whatsNewSelected=saved;
    select.addEventListener('change',event=>{whatsNewSelected=event.target.value;renderWhatsNew();});
    $('whatsNewOlder').addEventListener('click',()=>{
      const index=WHATS_NEW_RELEASES.findIndex(r=>r.version===whatsNewSelected);
      if(index<0||index===WHATS_NEW_RELEASES.length-1)return;
      whatsNewSelected=WHATS_NEW_RELEASES[index+1].version;renderWhatsNew();
    });
    $('whatsNewNewer').addEventListener('click',()=>{
      const index=WHATS_NEW_RELEASES.findIndex(r=>r.version===whatsNewSelected);
      if(index<=0)return;
      whatsNewSelected=WHATS_NEW_RELEASES[index-1].version;renderWhatsNew();
    });
    renderWhatsNew();updateWhatsNewIndicators();
  }


  return { initWhatsNew, renderWhatsNew, markWhatsNewRead, updateWhatsNewIndicators };
}
