/* The iframe is a disposable view. Export removes editor-only annotations. */
const $=id=>document.getElementById(id), frame=$('canvas');
let path='',version='',current=0,selected=null,history=[],cursor=-1,dirty=false,scale=1,originalScripts=[];
let savedHTML='', statusKey='就绪', sourceDraft=false, sourceLocationKey='';
const status=s=>{statusKey=s;$('status').textContent=t(s);};
async function api(route,data){if(window.slideStudioStorage.handles(data.path))return window.slideStudioStorage[route](data.path&&route==='load'?data.path:data);const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
function doc(){return frame.contentDocument;}
function slides(){return [...doc().querySelectorAll('.slide')];}
// Mark the selected clone with temporary comments to obtain exact source offsets.
// Markers never reach the saved document; duplicate text is mapped by DOM identity.
function serializeDocument(locate=false) {
  const clone=doc().documentElement.cloneNode(true);
  const target=locate ? (clone.querySelector('[data-editor-selected=primary]')||clone.querySelector('[data-editor-selected]')) : null;
  const token='editor-location-'+crypto.randomUUID();
  const startMarker='<!--'+token+'-start-->', endMarker='<!--'+token+'-end-->';
  if(target){
    target.before(document.createComment(token+'-start'));
    target.after(document.createComment(token+'-end'));
  }
  clone.querySelectorAll('[data-editor-ui]').forEach(e=>e.remove());
  clone.querySelectorAll('[data-editor-selected],[data-editor-page],[data-editor-editing]').forEach(e=>{
    if(e.hasAttribute('data-editor-editing'))e.removeAttribute('contenteditable');
    e.removeAttribute('data-editor-selected');e.removeAttribute('data-editor-page');e.removeAttribute('data-editor-editing');
  });
  clone.querySelectorAll('base[data-editor-base]').forEach(e=>e.remove());
  originalScripts.forEach(item=>{
    const template=document.createElement('template');template.innerHTML=item.html;
    const marker=clone.querySelector(`[data-editor-script="${item.id}"]`);
    if(marker)marker.replaceWith(template.content);
  });
  let html='<!doctype html>\n'+clone.outerHTML;
  if(locate)html=formatSource(html);
  let start=target?html.indexOf(startMarker):-1;
  if(start<0)return {html,start:-1,end:-1};
  html=html.replace(startMarker,'');
  let end=html.indexOf(endMarker);
  html=html.replace(endMarker,'');
  while(start<end&&/\s/.test(html[start]))start++;
  while(end>start&&/\s/.test(html[end-1]))end--;
  return {html,start,end};
}
function clean(){return serializeDocument().html;}
function formatSource(html){
  // Leave scripts, CSS and whitespace-sensitive text intact.
  return html.split(/(<(?:script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/(?:script|style|pre|textarea)\s*>)/gi)
    .map((part,i)=>i%2?part:part.replace(/>(<(?:head|body|main|section|div|aside|footer|h[1-6]|p|ul|ol|li|table|thead|tbody|tr|script|link|meta)\b)/g,'>\n$1')).join('');
}
function syncSource(reveal=false){
  if(!path)return;
  if(reveal)$('sourcePane').hidden=false;
  if($('sourcePane').hidden)return;
  if(sourceDraft){
    sourceLocationKey='源码有待应用的修改，应用或还原后即可定位元素。';
    $('sourceLocation').textContent=t(sourceLocationKey);
    return;
  }
  const snapshot=serializeDocument(true), field=$('source');
  field.value=snapshot.html;
  if(snapshot.start>=0){
    field.setSelectionRange(snapshot.start,snapshot.end);
    // Do not focus: the canvas keeps keyboard focus for double-click editing.
    const line=field.value.slice(0,snapshot.start).split('\n').length;
    const lineHeight=parseFloat(getComputedStyle(field).lineHeight)||20;
    field.scrollLeft=0;
    field.scrollTop=Math.max(0,(line-1)*lineHeight-field.clientHeight/3);
    sourceLocationKey='定位到所选元素';
    $('sourceLocation').textContent=t(sourceLocationKey)+' · L'+line;
    field.classList.add('source-located');
    field.parentElement.classList.add('has-location');
    updateSourceHighlight();
  }else{
    sourceLocationKey='';$('sourceLocation').textContent='';field.classList.remove('source-located');field.parentElement.classList.remove('has-location');
  }
  resize();
}
function updateSourceHighlight(){
  const field=$('source'), container=field.parentElement;
  if(!container.classList.contains('has-location'))return;
  const first=field.value.slice(0,field.selectionStart).split('\n').length-1;
  const last=field.value.slice(0,field.selectionEnd).split('\n').length-1;
  const css=getComputedStyle(field), lineHeight=parseFloat(css.lineHeight)||20;
  container.style.setProperty('--location-top',(parseFloat(css.paddingTop)+first*lineHeight-field.scrollTop)+'px');
  container.style.setProperty('--location-height',((last-first+1)*lineHeight)+'px');
}
function refreshDynamicLanguage(){
  status(statusKey);
  $('selection').textContent=selected?selected.tagName.toLowerCase():t('尚未选择元素');
  $('selector').textContent=selected?selected.className||t('无 class'):t('点击画布中的文字或图片');
  if(path&&doc()?.querySelector('.slide')){renderList();updatePageTitle();}
  if(sourceLocationKey){
    const line=$('sourceLocation').textContent.match(/ · L\d+$/)?.[0]||'';
    $('sourceLocation').textContent=t(sourceLocationKey)+line;
  }
}
function updatePageTitle(){
  $('pageTitle').textContent=`${path==='@tutorial'?t('教学示例'):path.startsWith('@import/')?path.slice(8):path.split('/').slice(-2,-1)} / ${current+1} · ${slides().length} ${t('页')}`;
}

function checkpoint(){const html=clean();if(history[cursor]===html)return;history=history.slice(0,cursor+1);history.push(html);if(history.length>80)history.shift();cursor=history.length-1;dirty=true;status('有未保存的修改');buttons();renderList();syncSource();}
function buttons(){$('undo').disabled=cursor<=0;$('redo').disabled=cursor>=history.length-1;}
function resize(){const stage=$('stage');scale=Math.max(.1,Math.min((stage.clientWidth-48)/1280,(stage.clientHeight-48)/720));$('frameWrap').style.width=1280*scale+'px';$('frameWrap').style.height=720*scale+'px';frame.style.transform=`scale(${scale})`;}
new ResizeObserver(resize).observe($('stage'));
function mount(html){selected=null;const parsed=new DOMParser().parseFromString(html,'text/html');if(path==='@tutorial')window.localizeTutorial(parsed,language);originalScripts=[];parsed.querySelectorAll('script').forEach((s,i)=>{originalScripts.push({id:i,html:s.outerHTML});const marker=parsed.createElement('template');marker.dataset.editorScript=i;s.replaceWith(marker);});const base=parsed.createElement('base');base.href=deckBaseURL();base.setAttribute('data-editor-base','');parsed.head.prepend(base);const policy=parsed.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="script-src 'none'; object-src 'none'";policy.dataset.editorUi='';parsed.head.prepend(policy);const style=parsed.createElement('style');style.dataset.editorUi='';style.textContent=`html,body{width:1280px!important;height:720px!important;overflow:hidden!important;margin:0!important}.slide{display:none!important}.slide[data-editor-page]{display:block!important;opacity:1!important;visibility:visible!important;position:absolute!important;inset:0!important;width:1280px!important;height:720px!important;transform:none!important}.hud{display:none!important}[data-editor-selected]{outline:2px solid #5274ef!important;outline-offset:3px}[data-editor-editing]{cursor:text!important;outline:2px dashed #5274ef!important}`;parsed.head.append(style);frame.onload=()=>{wire();show(current);syncSource();resize();};frame.srcdoc='<!doctype html>'+parsed.documentElement.outerHTML;}
function renderList(){const list=$('slides');list.replaceChildren();slides().forEach((s,i)=>{const b=document.createElement('button');b.className='page'+(i===current?' current':'');const n=document.createElement('em');n.textContent=String(i+1).padStart(2,'0');const label=document.createElement('span');label.textContent=(s.querySelector('h1,h2,h3')?.textContent||t('幻灯片')).slice(0,45);b.append(n,label);b.onclick=()=>{finish();show(i);};list.append(b);});}
function show(i){const all=slides();current=Math.max(0,Math.min(i,all.length-1));all.forEach((s,n)=>s.toggleAttribute('data-editor-page',n===current));select(null);renderList();updatePageTitle();syncSource();}
function rgbHex(v){const m=v.match(/\d+/g);return m?'#'+m.slice(0,3).map(n=>(+n).toString(16).padStart(2,'0')).join(''):'#000000';}
function select(el){if(selected)selected.removeAttribute('data-editor-selected');selected=el;if(el)el.setAttribute('data-editor-selected','');$('selection').textContent=el?el.tagName.toLowerCase():t('尚未选择元素');$('selector').textContent=el?el.className||t('无 class'):t('点击画布中的文字或图片');if(!el)return;const css=frame.contentWindow.getComputedStyle(el);$('fontSize').value=parseFloat(css.fontSize);$('width').value=Math.round(el.getBoundingClientRect().width);$('height').value=Math.round(el.getBoundingClientRect().height);$('color').value=rgbHex(css.color);$('background').value=rgbHex(css.backgroundColor);$('imageSrc').value=el.tagName==='IMG'?el.getAttribute('src'):'';syncSource(true);}
function finish(){const e=doc()?.querySelector('[data-editor-editing]');if(e){e.removeAttribute('contenteditable');e.removeAttribute('data-editor-editing');checkpoint();}}
function wire(){const d=doc();d.addEventListener('click',e=>{if(e.target.closest('a')&&!e.target.isContentEditable)e.preventDefault();if(e.target.closest('.slide')&&!e.target.isContentEditable)select(e.target.closest('a')||e.target);});d.addEventListener('dblclick',e=>{if($('move').checked)return;const el=e.target;if(!el.closest('.slide')||el.closest('svg')||['IMG','SECTION','TABLE','TBODY','TR'].includes(el.tagName))return;finish();select(el);el.setAttribute('data-editor-editing','');el.contentEditable='true';el.focus();});d.addEventListener('focusout',()=>finish());d.addEventListener('keydown',key);d.addEventListener('pointerdown',e=>{if(!$('move').checked||!e.target.closest('.slide')||e.target.classList.contains('slide'))return;e.preventDefault();finish();select(e.target);const el=selected,x=e.clientX,y=e.clientY,old=el.style.translate||'0px 0px',nums=old.split(' ').map(parseFloat);let moved=false;const move=ev=>{moved=true;el.style.translate=`${(nums[0]||0)+ev.clientX-x}px ${(nums[1]||0)+ev.clientY-y}px`;};const up=()=>{d.removeEventListener('pointermove',move);d.removeEventListener('pointerup',up);if(moved)checkpoint();};d.addEventListener('pointermove',move);d.addEventListener('pointerup',up);});}
async function load(){if((dirty||sourceDraft)&&!confirm(t('当前有未保存的修改，确定打开其他文件吗？')))return;try{const target=$('decks').value;const result=await api('load',{path:target});if(!new DOMParser().parseFromString(result.html,'text/html').querySelector('.slide'))throw Error(t('源码需要包含 .slide 元素'));path=target;savedHTML=result.html;version=result.version;current=0;sourceDraft=false;mount(result.html);history=[result.html];cursor=0;dirty=false;buttons();status(window.slideStudioStorage.handles(path)?'已打开 · 浏览器本地草稿':'已打开 · 本地文件');window.slideStudioStorage.updateLabels();$('resetTutorial').hidden=path!=='@tutorial';try{localStorage.setItem('slide-studio-last-deck',path);}catch{}}catch(e){alert(t(e.message));}}
$('open').onclick=load;
$('save').onclick=async()=>{if(!path)return;if(sourceDraft)return alert(t('源码有待应用的修改，应用或还原后即可定位元素。'));finish();try{const r=await api('save',{path,version,html:clean()});version=r.version;dirty=false;status('已保存 · 已自动备份');}catch(e){alert(t(e.message));}};
$('export').onclick=()=>{if(!path)return;if(sourceDraft)return alert(t('源码有待应用的修改，应用或还原后即可定位元素。'));finish();const url=URL.createObjectURL(new Blob([clean()],{type:'text/html'}));const a=document.createElement('a');a.href=url;a.download=path==='@tutorial'?'landing-page-tutorial.html':path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('undo').onclick=()=>{if(cursor>0){cursor--;mount(history[cursor]);dirty=true;buttons();status('已撤销 · 尚未保存');}};
$('redo').onclick=()=>{if(cursor<history.length-1){cursor++;mount(history[cursor]);dirty=true;buttons();status('已重做 · 尚未保存');}};
document.querySelectorAll('[data-prop]').forEach(input=>input.onchange=()=>{if(!selected)return;selected.style.setProperty(input.dataset.prop,input.value+(input.type==='number'?'px':''));checkpoint();});
document.querySelectorAll('[data-align]').forEach(b=>b.onclick=()=>{if(selected){selected.style.textAlign=b.dataset.align;checkpoint();}});
$('bold').onclick=()=>{if(selected){selected.style.fontWeight=frame.contentWindow.getComputedStyle(selected).fontWeight==='700'?'400':'700';checkpoint();}};
$('imageSrc').onchange=()=>{if(selected?.tagName==='IMG'){selected.setAttribute('src',$('imageSrc').value);checkpoint();}};
$('parent').onclick=()=>{if(selected?.parentElement?.closest('.slide'))select(selected.parentElement);};
$('delete').onclick=()=>{if(selected&&!selected.classList.contains('slide')){selected.remove();select(null);checkpoint();}};
$('add').onclick=()=>{if(!slides()[current])return;const p=doc().createElement('p');p.textContent=t('双击编辑文本');p.style.cssText='position:absolute;left:120px;top:180px;font-size:32px;z-index:10;';slides()[current].append(p);select(p);checkpoint();};
$('duplicate').onclick=()=>{const s=slides()[current];if(!s)return;const clone=s.cloneNode(true);clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));clone.removeAttribute('id');clone.querySelectorAll('[data-editor-selected]').forEach(e=>e.removeAttribute('data-editor-selected'));s.after(clone);slides().forEach((el,i)=>{if(el.hasAttribute('data-slide'))el.dataset.slide=i+1;});show(current+1);checkpoint();};
$('sourceToggle').onclick=()=>{
  if(!path)return;finish();$('sourcePane').hidden=!$('sourcePane').hidden;syncSource();resize();
};
$('source').addEventListener('input',()=>{
  sourceDraft=true;sourceLocationKey='源码尚未应用';
  $('sourceLocation').textContent=t(sourceLocationKey);$('source').classList.remove('source-located');$('source').parentElement.classList.remove('has-location');
});
$('source').addEventListener('scroll',updateSourceHighlight);
$('source').addEventListener('pointerdown',()=>{$('source').parentElement.classList.remove('has-location');});
$('revertSource').onclick=()=>{sourceDraft=false;syncSource();};
$('applySource').onclick=()=>{
  const html=$('source').value;
  if(!new DOMParser().parseFromString(html,'text/html').querySelector('.slide'))return alert(t('源码需要包含 .slide 元素'));
  sourceDraft=false;mount(html);history=history.slice(0,cursor+1);history.push(html);cursor++;dirty=true;buttons();status('源码已应用 · 尚未保存');
};
$('preview').onclick=()=>{if(!path)return;if(dirty){alert(t('请先保存，再放映最新内容。'));return;}window.open('/'+path.split('/').map(encodeURIComponent).join('/')+'#'+(current+1),'_blank','noopener');};
function key(e){if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();}if(e.key==='Escape')finish();if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!e.target.isContentEditable&&e.target.tagName!=='TEXTAREA'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}}
document.addEventListener('keydown',key);window.addEventListener('beforeunload',e=>{if(dirty||sourceDraft){e.preventDefault();e.returnValue='';}});
initializeLanguage();
window.slideStudioDecksReady=new Promise(resolve=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolve,{once:true});else resolve();}).then(async()=>{
  const storage=window.slideStudioStorage;storage.setup();
  const files=await storage.list();
  files.forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=storage.label(name);$('decks').append(option);});
  let previous;try{previous=localStorage.getItem('slide-studio-last-deck');}catch{}
  if(files.includes(previous))$('decks').value=previous;
  if(files.length)return load();
}).catch(error=>status(error.message));

$('properties').onclick=()=>document.body.classList.toggle('show-inspector');
