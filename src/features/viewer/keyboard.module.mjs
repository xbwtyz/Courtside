/** Viewer Escape and focus-trap registration, unchanged behavior. */
export function registerViewerKeyboard({document,$,closeViewer}){
  document.addEventListener('keydown',e=>{
    if($('viewer').hidden)return;
    if(e.key==='Escape'){e.preventDefault();closeViewer();}
    if(e.key==='Tab'){
      const focusables=Array.from($('viewerDialog').querySelectorAll('button:not(:disabled),a[href]:not([hidden]),select:not([disabled]),input:not([disabled])'))
        .filter(el=>!el.hidden&&!el.closest('[hidden]'));
      if(!focusables.length)return;
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
}
