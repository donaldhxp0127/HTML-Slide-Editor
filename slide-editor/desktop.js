/* Optional native Mac host; the regular browser edition is unchanged. */
if(window.slideStudioDesktop){
  $('openFolder').hidden=false;
  const captures=new Map();
  window.captureSlideNative=html=>new Promise((resolve,reject)=>{
    const id=crypto.randomUUID(),timer=setTimeout(()=>{captures.delete(id);reject(Error('Native render timed out'));},60000);
    captures.set(id,{resolve,reject,timer});window.webkit.messageHandlers.desktop.postMessage({action:'captureSlide',id,html});
  });
  window.slideStudioCaptureResult=response=>{
    const pending=captures.get(response.id);if(!pending)return;clearTimeout(pending.timer);captures.delete(response.id);
    if(response.error)pending.reject(Error(response.error));else pending.resolve(response.data);
  };
  $('language').addEventListener('change',()=>window.webkit.messageHandlers.desktop.postMessage({action:'setLanguage',language:$('language').value}));
  $('openFolder').onclick=()=>window.webkit.messageHandlers.desktop.postMessage({action:'openFolder'});
  async function openRequestedDeck(){
    await window.slideStudioDecksReady;
    const name=window.slideStudioOpenFile;
    if(!name)return;
    const files=await fetch('/api/decks').then(r=>r.json());
    const target=files.find(file=>file===name);
    if(!target)return;
    if(![...$('decks').options].some(option=>option.value===target)){
      const option=document.createElement('option');option.value=target;option.textContent=target;$('decks').append(option);
    }
    $('decks').value=target;window.slideStudioOpenFile=null;await load();
  }
  window.addEventListener('desktop-file-ready',openRequestedDeck);
  openRequestedDeck();
}
