/* Native HTML editing tools. All canvas controls are transient data-editor-ui nodes. */
let selectionSet=new Set(), suppressClick=false, pendingSave=null, replacingImage=null, selectingForDrag=false;
const baseSelect=select, baseCheckpoint=checkpoint, baseSyncSource=syncSource;
const locked=el=>!!el?.closest('[data-slide-locked]');
const activeSlide=()=>slides()[current];
const escapeHTML=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const editableTarget=el=>el?.closest('[data-slide-group]')||el?.closest('svg')||el?.closest('a')||el;
function translateXY(el){const v=frame.contentWindow.getComputedStyle(el).translate;const n=v==='none'?[0,0]:v.split(/\s+/).map(parseFloat);return [n[0]||0,n[1]||0];}
function setTranslate(el,x,y){el.style.translate=`${Math.round(x*10)/10}px ${Math.round(y*10)/10}px`;}
function rect(el){return el.getBoundingClientRect();}
function union(items){const rs=items.map(rect);const left=Math.min(...rs.map(r=>r.left)),top=Math.min(...rs.map(r=>r.top));return {left,top,right:Math.max(...rs.map(r=>r.right)),bottom:Math.max(...rs.map(r=>r.bottom)),get width(){return this.right-this.left;},get height(){return this.bottom-this.top;}};}
select=function(el,additive=false){
  if(!additive)selectionSet.clear();
  if(el){
    if(additive&&selectionSet.has(el))selectionSet.delete(el);
    else{
      [...selectionSet].forEach(other=>{if(other.contains(el)||el.contains(other))selectionSet.delete(other);});
      selectionSet.add(el);
    }
  }
  doc()?.querySelectorAll('[data-editor-selected]').forEach(n=>n.removeAttribute('data-editor-selected'));
  const primary=selectionSet.has(el)?el:[...selectionSet].at(-1)||null;
  baseSelect(primary);
  selectionSet.forEach(n=>n.setAttribute('data-editor-selected',n===primary?'primary':'secondary'));
  if(selectionSet.size>1)$('selection').textContent=selectionSet.size+' '+t('元素');
  if(primary?.tagName==='IMG')$('crop').value=parseFloat(primary.style.clipPath.match(/inset\(([\d.]+)%/)?.[1]||0);
  paintSelection();renderLayers();
};
checkpoint=function(){baseCheckpoint();let bytes=history.reduce((sum,s)=>sum+s.length,0);while(history.length>2&&bytes>30000000){bytes-=history.shift().length;cursor--;}buttons();paintSelection();renderLayers();updatePageTitle();};
syncSource=function(reveal=false){baseSyncSource(reveal&&!selectingForDrag);paintSource();};
function paintSource(){
  const code=$('source').value;
  // Highlight HTML tokens without executing source or injecting its markup.
  const tokens=code.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|<![^>]*>|[^<]+|</g)||[];
  $('sourceHighlight').innerHTML=tokens.map(token=>{
    if(token.startsWith('<!--'))return '<span class="syntax-comment">'+escapeHTML(token)+'</span>';
    if(token.startsWith('<')){
      const parts=token.match(/"[^"]*"|'[^']*'|[^"']+/g)||[];
      return '<span class="syntax-tag">'+parts.map(p=>/^['"]/.test(p)?'<span class="syntax-string">'+escapeHTML(p)+'</span>':escapeHTML(p)).join('')+'</span>';
    }
    return escapeHTML(token);
  }).join('')+'\n';
  syncCodeScroll();
}
function syncCodeScroll(){const field=$('source'),pre=$('sourceHighlight');pre.scrollTop=field.scrollTop;pre.scrollLeft=field.scrollLeft;}
$('source').addEventListener('input',paintSource);
$('source').addEventListener('scroll',syncCodeScroll);
function canvasNode(tag,css){const el=doc().createElement(tag);el.dataset.editorUi='';el.style.cssText=css;return el;}
function paintSelection(){
  const d=doc();if(!d?.body)return;
  d.querySelectorAll('[data-editor-overlay]').forEach(el=>el.remove());
  selectionSet=new Set([...selectionSet].filter(el=>el.isConnected&&el.closest('.slide')===activeSlide()));
  const items=[...selectionSet].filter(el=>!el.hidden&&frame.contentWindow.getComputedStyle(el).display!=='none');
  if(!items.length)return;
  const box=union(items);if(!box.width||!box.height)return;
  if(document.activeElement!==$('width'))$('width').value=Math.round(box.width);
  if(document.activeElement!==$('height'))$('height').value=Math.round(box.height);
  const overlay=canvasNode('div',`position:fixed;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;border:2px solid ${items.some(locked)?'#bf8837':'#5274ef'};pointer-events:none;z-index:2147483646;`);
  overlay.dataset.editorOverlay='';
  if(items.length===1&&!locked(items[0])&&!items[0].isContentEditable&&!items[0].classList.contains('slide')){
    ['nw','n','ne','e','se','s','sw','w'].forEach(dir=>{
      const handle=canvasNode('button',`position:absolute;width:${10/scale}px;height:${10/scale}px;padding:0;border:2px solid #5274ef;background:white;border-radius:2px;pointer-events:auto;transform:translate(-50%,-50%);left:${dir.includes('w')?0:dir.includes('e')?100:50}%;top:${dir.includes('n')?0:dir.includes('s')?100:50}%;cursor:${dir}-resize;`);
      handle.dataset.resizeHandle=dir;handle.setAttribute('aria-label',t('调整大小')+' '+dir);handle.addEventListener('pointerdown',event=>startResize(event,items[0],dir));overlay.append(handle);
    });
  }
  d.body.append(overlay);
}
function guides(x,y){
  doc().querySelectorAll('[data-editor-guide]').forEach(n=>n.remove());
  if(x!=null){const line=canvasNode('div',`position:fixed;left:${x}px;top:0;height:720px;border-left:1px solid #e642ad;z-index:2147483645;pointer-events:none`);line.dataset.editorGuide='';doc().body.append(line);}
  if(y!=null){const line=canvasNode('div',`position:fixed;top:${y}px;left:0;width:1280px;border-top:1px solid #e642ad;z-index:2147483645;pointer-events:none`);line.dataset.editorGuide='';doc().body.append(line);}
}
function snapBox(box,dx,dy,disabled=false){
  if(disabled){guides();return {dx,dy};}
  const peers=[...activeSlide().querySelectorAll('h1,h2,h3,p,img,figure,[data-slide-group],.title-box,.content-box')].filter(el=>!el.hidden&&!el.closest('[hidden]')&&![...selectionSet].some(s=>s.contains(el)||el.contains(s)));
  const xr=[0,640,1280],yr=[0,360,720];peers.forEach(el=>{const r=rect(el);xr.push(r.left,(r.left+r.right)/2,r.right);yr.push(r.top,(r.top+r.bottom)/2,r.bottom);});
  let bx=7,by=7,gx=null,gy=null,ax=0,ay=0;
  [box.left+dx,box.left+box.width/2+dx,box.right+dx].forEach(v=>xr.forEach(target=>{if(Math.abs(target-v)<bx){bx=Math.abs(target-v);ax=target-v;gx=target;}}));
  [box.top+dy,box.top+box.height/2+dy,box.bottom+dy].forEach(v=>yr.forEach(target=>{if(Math.abs(target-v)<by){by=Math.abs(target-v);ay=target-v;gy=target;}}));
  guides(gx,gy);return {dx:dx+ax,dy:dy+ay};
}
function trackPointer(event,move,done,cancel){
  const d=doc(), id=event.pointerId;
  try{d.documentElement.setPointerCapture(id);}catch{}
  const onMove=e=>{if(e.pointerId===id)move(e);};
  const end=e=>{if(e.pointerId!==id)return;d.removeEventListener('pointermove',onMove);d.removeEventListener('pointerup',end);d.removeEventListener('pointercancel',abort);guides();try{d.documentElement.releasePointerCapture(id);}catch{}done(e);};
  const abort=e=>{if(e.pointerId!==id)return;d.removeEventListener('pointermove',onMove);d.removeEventListener('pointerup',end);d.removeEventListener('pointercancel',abort);guides();try{d.documentElement.releasePointerCapture(id);}catch{}cancel?.();paintSelection();};
  d.addEventListener('pointermove',onMove);d.addEventListener('pointerup',end);d.addEventListener('pointercancel',abort);
}
function startResize(event,el,dir){
  event.preventDefault();event.stopPropagation();finish();suppressClick=true;
  const initial=rect(el),xy=translateXY(el),old=el.getAttribute('style'),x=event.clientX,y=event.clientY;
  const css=frame.contentWindow.getComputedStyle(el),contentBox=css.boxSizing!=='border-box';
  const extraX=contentBox?parseFloat(css.paddingLeft)+parseFloat(css.paddingRight)+parseFloat(css.borderLeftWidth)+parseFloat(css.borderRightWidth):0;
  const extraY=contentBox?parseFloat(css.paddingTop)+parseFloat(css.paddingBottom)+parseFloat(css.borderTopWidth)+parseFloat(css.borderBottomWidth):0;
  let changed=false;
  trackPointer(event,e=>{
    let dx=e.clientX-x,dy=e.clientY-y,w=initial.width,h=initial.height;
    if(dir.includes('e'))w+=dx;if(dir.includes('w'))w-=dx;if(dir.includes('s'))h+=dy;if(dir.includes('n'))h-=dy;
    w=Math.max(20,w);h=Math.max(20,h);
    if(e.shiftKey&&dir.length===2)h=w*initial.height/initial.width;
    if(!e.altKey){const edgeX=dir.includes('w')?initial.right-w:initial.left+w,edgeY=dir.includes('n')?initial.bottom-h:initial.top+h;let gx=null,gy=null;
      [0,640,1280].forEach(v=>{if(Math.abs(v-edgeX)<7&&/[ew]/.test(dir)){w=dir.includes('w')?initial.right-v:v-initial.left;gx=v;}});
      [0,360,720].forEach(v=>{if(Math.abs(v-edgeY)<7&&/[ns]/.test(dir)){h=dir.includes('n')?initial.bottom-v:v-initial.top;gy=v;}});guides(gx,gy);
    }
    w=Math.max(20,w);h=Math.max(20,h);
    el.style.width=Math.max(1,w-extraX)+'px';el.style.height=Math.max(1,h-extraY)+'px';el.style.maxWidth='none';el.style.maxHeight='none';el.style.flex='none';
    if(el.tagName==='IMG')el.style.objectFit='contain';
    setTranslate(el,xy[0]+(dir.includes('w')?initial.width-w:0),xy[1]+(dir.includes('n')?initial.height-h:0));changed=true;paintSelection();
  },()=>{if(changed)checkpoint();setTimeout(()=>suppressClick=false,0);},()=>{if(old===null)el.removeAttribute('style');else el.setAttribute('style',old);suppressClick=false;});
}
wire=function(){
  selectionSet.clear();const d=doc();
  d.addEventListener('click',e=>{
    if(e.target.closest('[data-editor-ui]'))return;
    if(e.target.closest('a')&&!e.target.isContentEditable)e.preventDefault();
    if(suppressClick){suppressClick=false;return;}
    if(e.target.closest('.slide')&&!e.target.isContentEditable)select(editableTarget(e.target),e.shiftKey||e.metaKey||e.ctrlKey);
  });
  d.addEventListener('dblclick',e=>{
    if(e.target.closest('[data-editor-ui]')||$('move').checked||locked(e.target))return;
    const el=e.target;if(!el.closest('.slide')||el.closest('svg')||['IMG','SECTION','TABLE','TBODY','TR'].includes(el.tagName))return;
    finish();select(el);el.setAttribute('data-editor-editing','');el.contentEditable='true';el.focus();paintSelection();
  });
  d.addEventListener('focusout',()=>finish());d.addEventListener('keydown',key);
  d.addEventListener('input',()=>paintSelection());
  d.addEventListener('pointerdown',e=>{
    if(e.target.closest('[data-editor-ui]')||e.target.isContentEditable||!e.target.closest('.slide'))return;
    if(!$('move').checked||e.shiftKey||e.metaKey||e.ctrlKey)return;
    const el=editableTarget(e.target);if(el.classList.contains('slide')||locked(el))return;
    e.preventDefault();finish();if(!selectionSet.has(el)){selectingForDrag=true;select(el);selectingForDrag=false;}
    const items=[...selectionSet].filter(n=>!locked(n)&&!n.classList.contains('slide'));
    if(!items.length)return;
    const box=union(items),original=items.map(n=>({el:n,xy:translateXY(n)})),x=e.clientX,y=e.clientY;let moved=false;
    trackPointer(e,ev=>{if(Math.hypot(ev.clientX-x,ev.clientY-y)<2&&!moved)return;moved=true;suppressClick=true;const delta=snapBox(box,ev.clientX-x,ev.clientY-y,ev.altKey);original.forEach(({el,xy})=>setTranslate(el,xy[0]+delta.dx,xy[1]+delta.dy));paintSelection();},()=>{if(moved)checkpoint();syncSource(true);setTimeout(()=>suppressClick=false,0);},()=>{original.forEach(({el,xy})=>setTranslate(el,...xy));suppressClick=false;});
  });
  d.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();});
  d.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)addImageFile(f,null,{x:e.clientX,y:e.clientY});});
  d.addEventListener('load',()=>paintSelection(),true);
};
// Real slide previews use the deck's own CSS in isolated, script-free iframes.
renderList=function(){
  const list=$('slides');list.replaceChildren();
  slides().forEach((slide,i)=>{
    const entry=document.createElement('div');entry.className='slide-entry';entry.draggable=true;entry.dataset.slideIndex=i;
    const button=document.createElement('button');button.className='page'+(i===current?' current':'');button.setAttribute('aria-label',`${i+1} ${slide.querySelector('h1,h2,h3')?.textContent||t('幻灯片')}`);
    const thumb=document.createElement('div');thumb.className='thumbnail';
    const iframe=document.createElement('iframe');iframe.tabIndex=-1;iframe.setAttribute('aria-hidden','true');iframe.setAttribute('sandbox','');
    const copy=slide.cloneNode(true);copy.querySelectorAll('script,[data-editor-ui]').forEach(n=>n.remove());copy.querySelectorAll('[data-editor-selected]').forEach(n=>n.removeAttribute('data-editor-selected'));copy.removeAttribute('data-editor-page');
    const head=doc().head.cloneNode(true);head.querySelectorAll('script,[data-editor-ui]').forEach(n=>n.remove());
    const base=doc().body;const attrs=[...base.attributes].filter(a=>['class','style'].includes(a.name)).map(a=>`${a.name}="${escapeHTML(a.value)}"`).join(' ');
    iframe.srcdoc=`<!doctype html><html><head>${head.innerHTML}<style>html,body{width:1280px!important;height:720px!important;margin:0!important;overflow:hidden!important}.deck{width:1280px!important;height:720px!important}.slide{display:block!important;position:absolute!important;inset:0!important;width:1280px!important;height:720px!important;transform:none!important;opacity:1!important;visibility:visible!important}</style></head><body ${attrs}><main class="deck">${copy.outerHTML}</main></body></html>`;
    thumb.append(iframe);const label=document.createElement('span');label.className='slide-label';label.textContent=String(i+1).padStart(2,'0')+'  '+(slide.querySelector('h1,h2,h3')?.textContent||t('幻灯片'));button.append(thumb,label);button.onclick=()=>{finish();show(i);};entry.append(button);const order=document.createElement('div');order.className='slide-order';[-1,1].forEach(delta=>{const control=document.createElement('button');control.textContent=delta<0?'↑':'↓';control.setAttribute('aria-label',t(delta<0?'上移页面':'下移页面')+' '+(i+1));control.disabled=i+delta<0||i+delta>=slides().length;control.onclick=()=>moveSlide(i,i+delta);order.append(control);});entry.append(order);
    configureSlideDrag(entry,i);list.append(entry);
  });
  appendSlideTools(list);
};

function renumber(){slides().forEach((s,i)=>{if(s.hasAttribute('data-slide'))s.dataset.slide=i+1;});}
function moveSlide(from,to){finish();const all=slides(),moving=all[from],target=all[to];if(!moving||!target||moving===target)return;const active=activeSlide();if(from<to)target.after(moving);else target.before(moving);renumber();show(slides().indexOf(active));checkpoint();}
$('deleteSlide').onclick=()=>{if(slides().length<=1)return alert(t('请至少保留一页'));finish();activeSlide().remove();renumber();show(current);checkpoint();};
function renderLayers(){
  const list=$('layers');list.replaceChildren();if(!activeSlide())return;
  const nodes=[...activeSlide().querySelectorAll('*')].filter(el=>!el.closest('[data-editor-ui]')&&!el.parentElement.closest('svg')&&!['SCRIPT','STYLE','TEMPLATE','BR','TBODY','THEAD','TR','SUP','SPAN','STRONG','EM','B'].includes(el.tagName)&&!el.classList.contains('speaker-notes')&&!(el.parentElement.closest('[data-slide-group]')));
  nodes.forEach(el=>{
    const row=document.createElement('div');row.className='layer-row'+(selectionSet.has(el)?' selected':'');
    const button=document.createElement('button');button.className='layer-name';button.textContent=(locked(el)?'🔒 ':'')+(el.hidden?'◌ ':'')+el.tagName.toLowerCase()+' '+(el.getAttribute('alt')||el.textContent.trim()||el.className||'').slice(0,35);button.title=el.className||el.tagName;button.onclick=e=>select(el,e.shiftKey||e.metaKey||e.ctrlKey);
    row.append(button);list.append(row);
  });
}
function mutableSelection(){return [...selectionSet].filter(el=>!locked(el)&&!el.classList.contains('slide'));}
// Existing property controls now apply consistently to every unlocked selected element.
document.querySelectorAll('[data-prop]').forEach(input=>input.onchange=()=>{mutableSelection().forEach(el=>el.style.setProperty(input.dataset.prop,input.value+(input.type==='number'?'px':'')));checkpoint();});
document.querySelectorAll('[data-align]').forEach(button=>button.onclick=()=>{mutableSelection().forEach(el=>el.style.textAlign=button.dataset.align);checkpoint();});
$('bold').onclick=()=>{const weight=selected&&frame.contentWindow.getComputedStyle(selected).fontWeight==='700'?'400':'700';mutableSelection().forEach(el=>el.style.fontWeight=weight);checkpoint();};
$('imageSrc').onchange=()=>{if(selected?.tagName==='IMG'&&!locked(selected)){selected.setAttribute('src',$('imageSrc').value);checkpoint();}};
$('delete').onclick=()=>{const items=mutableSelection();if(!items.length)return;items.forEach(el=>el.remove());select(null);checkpoint();};
$('lock').onclick=()=>{if(!selected)return;const unlock=[...selectionSet].every(el=>el.hasAttribute('data-slide-locked'));selectionSet.forEach(el=>el.toggleAttribute('data-slide-locked',!unlock));checkpoint();};
$('hide').onclick=()=>{mutableSelection().forEach(el=>{if(el.hidden){el.hidden=false;if(el.hasAttribute('data-slide-display')){el.style.display=el.dataset.slideDisplay;el.removeAttribute('data-slide-display');}}else{el.dataset.slideDisplay=el.style.display;el.hidden=true;el.style.display='none';}});checkpoint();};
function layerOrder(delta){mutableSelection().forEach(el=>{const z=parseInt(frame.contentWindow.getComputedStyle(el).zIndex)||0;el.style.zIndex=z+delta;if(frame.contentWindow.getComputedStyle(el).position==='static')el.style.position='relative';});checkpoint();}
$('layerUp').onclick=()=>layerOrder(1);$('layerDown').onclick=()=>layerOrder(-1);
function absoluteAt(el,box,parentBox){
  el.style.position='absolute';el.style.left=(box.left-parentBox.left)+'px';el.style.top=(box.top-parentBox.top)+'px';el.style.right='auto';el.style.bottom='auto';el.style.margin='0';el.style.boxSizing='border-box';el.style.width=box.width+'px';el.style.height=box.height+'px';el.style.translate='none';el.style.flex='none';
}
$('group').onclick=()=>{
  finish();const items=mutableSelection();if(items.length<2||items.some(el=>el.parentElement!==items[0].parentElement))return alert(t('请选择同一容器中的多个元素'));
  const parent=items[0].parentElement,boxes=items.map(rect),bounds=union(items),parentBox=rect(parent);
  // Freeze this container's current geometry before grouping flow-layout children.
  // This prevents unselected siblings from jumping when selected nodes leave the flow.
  const siblings=[...parent.children].filter(el=>!el.hidden&&!['SCRIPT','STYLE','TEMPLATE'].includes(el.tagName));
  if(siblings.some(locked))return alert(t('所选元素已锁定'));
  const siblingBoxes=siblings.map(rect),css=frame.contentWindow.getComputedStyle(parent);
  if(css.position==='static')parent.style.position='relative';
  if(parent!==activeSlide()){
    parent.style.boxSizing='border-box';parent.style.width=parentBox.width+'px';parent.style.height=parentBox.height+'px';
  }
  const origin={left:parentBox.left+(parseFloat(css.borderLeftWidth)||0),top:parentBox.top+(parseFloat(css.borderTopWidth)||0)};
  siblings.forEach((el,i)=>absoluteAt(el,siblingBoxes[i],origin));
  const group=doc().createElement('div');group.dataset.slideGroup='';group.className='slide-group';absoluteAt(group,bounds,origin);parent.append(group);
  items.forEach((el,i)=>{absoluteAt(el,boxes[i],bounds);group.append(el);});select(group);checkpoint();
};
$('ungroup').onclick=()=>{
  const group=selected;if(!group?.hasAttribute('data-slide-group')||locked(group))return;
  const kids=[...group.children],boxes=kids.map(rect),parent=group.parentElement,bounds=rect(parent);
  kids.forEach((el,i)=>{parent.append(el);absoluteAt(el,boxes[i],bounds);});group.remove();select(null);kids.forEach(el=>select(el,true));checkpoint();
};
async function addImageFile(file,replacement=null,point=null){
  const targetSlide=activeSlide(),targetDocument=doc();
  if(!file.type.startsWith('image/'))return;if(file.size>8*1024*1024)return alert(t('图片不能超过 8 MB'));
  if(replacement&&locked(replacement))return alert(t('所选元素已锁定'));
  try{
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    const size=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({w:image.naturalWidth,h:image.naturalHeight});image.onerror=reject;image.src=data;});
    if(targetDocument!==doc()||!targetSlide?.isConnected||(replacement&&!replacement.isConnected))return;
    const img=replacement||doc().createElement('img');img.src=data;img.alt=file.name;
    if(!replacement){const ratio=Math.min(480/size.w,360/size.h,1),width=size.w*ratio,height=size.h*ratio;img.style.cssText=`position:absolute;left:${Math.max(0,Math.min(point?.x??200,1280-width))}px;top:${Math.max(0,Math.min(point?.y??160,720-height))}px;width:${width}px;height:${height}px;object-fit:contain;z-index:10;`;targetSlide.append(img);}
    select(img);checkpoint();
  }catch{alert(t('无法读取图片'));}
}
$('insertImage').onclick=()=>{replacingImage=null;$('imageFile').click();};
$('replaceImage').onclick=()=>{if(selected?.tagName!=='IMG')return alert(t('请选择图片'));replacingImage=selected;$('imageFile').click();};
$('imageFile').onchange=()=>{const f=$('imageFile').files[0];if(f)addImageFile(f,replacingImage);$('imageFile').value='';};
$('crop').oninput=()=>{if(selected?.tagName==='IMG'&&!locked(selected))selected.style.clipPath=`inset(${$('crop').value}%)`;};
$('crop').onchange=()=>{if(selected?.tagName==='IMG'&&!locked(selected))checkpoint();};
$('resetCrop').onclick=()=>{if(selected?.tagName==='IMG'&&!locked(selected)){selected.style.removeProperty('clip-path');$('crop').value=0;checkpoint();}};
// A bounded LCS diff falls back to a full replacement for very large documents.
function lineDiff(before,after){
  const a=before.split('\n'),b=after.split('\n'),out=[];
  if(a.length*b.length>2000000){a.forEach(text=>out.push({kind:'removed',text}));b.forEach(text=>out.push({kind:'added',text}));return out;}
  const dp=Array.from({length:a.length+1},()=>new Uint32Array(b.length+1));
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  let i=0,j=0;while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){out.push({kind:'same',text:a[i]});i++;j++;}else if(j<b.length&&(i===a.length||dp[i][j+1]>=dp[i+1][j]))out.push({kind:'added',text:b[j++]});else out.push({kind:'removed',text:a[i++]});}return out;
}
$('save').onclick=()=>{
  if(!path)return;if(sourceDraft)return alert(t('源码有待应用的修改，应用或还原后即可定位元素。'));finish();
  pendingSave={html:clean(),path,version};
  const rows=lineDiff(formatSource(savedHTML),formatSource(pendingSave.html));
  $('diffBefore').replaceChildren();$('diffAfter').replaceChildren();
  rows.forEach(row=>{const line=document.createElement('div');line.className='diff-line '+row.kind;line.textContent=(row.kind==='added'?'+ ':row.kind==='removed'?'- ':'  ')+row.text;
    if(row.kind!=='added')$('diffBefore').append(line.cloneNode(true));if(row.kind!=='removed')$('diffAfter').append(line.cloneNode(true));
  });
  $('diffSummary').textContent=`+${rows.filter(r=>r.kind==='added').length} ${t('新增行')} / −${rows.filter(r=>r.kind==='removed').length} ${t('删除行')}`;
  $('saveDialog').showModal();
};
$('cancelSave').onclick=()=>{$('saveDialog').close();pendingSave=null;};
$('saveDialog').addEventListener('cancel',()=>pendingSave=null);
$('confirmSave').onclick=async()=>{
  if(!pendingSave)return;$('confirmSave').disabled=true;
  try{const request=pendingSave;const r=await api('save',request);version=r.version;savedHTML=request.html;dirty=clean()!==savedHTML;status(dirty?'有未保存的修改':'已保存 · 已自动备份');$('saveDialog').close();pendingSave=null;}catch(e){alert(t(e.message));}finally{$('confirmSave').disabled=false;}
};
const originalKey=key;
key=function(e){
  const typing=e.target.isContentEditable||['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName);
  if(!typing&&['Delete','Backspace'].includes(e.key)){e.preventDefault();$('delete').click();return;}
  if(!typing&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selectionSet.size){e.preventDefault();const step=e.shiftKey?10:1;mutableSelection().forEach(el=>{const xy=translateXY(el);setTranslate(el,xy[0]+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),xy[1]+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));});checkpoint();return;}
  if(!typing&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='g'){e.preventDefault();$(e.shiftKey?'ungroup':'group').click();return;}
  originalKey(e);
};
// The parent key listener was installed before the extended keyboard handler.
document.removeEventListener('keydown',originalKey);document.addEventListener('keydown',key);

new ResizeObserver(()=>paintSelection()).observe($('stage'));

// Drop boundaries describe gaps (0…N), so a page can be inserted precisely
// between two previews regardless of its original position.
let slideDragIndex=null;
function clearDropIndicator(){document.querySelectorAll('.slide-drop-zone.active').forEach(el=>el.classList.remove('active'));}
function indicateSlideBoundary(boundary){clearDropIndicator();document.querySelector(`.slide-drop-zone[data-boundary="${boundary}"]`)?.classList.add('active');}
function insertSlideAt(from,boundary){
  finish();const pages=slides(),moving=pages[from],active=activeSlide();
  if(!moving||boundary<0||boundary>pages.length||boundary===from||boundary===from+1)return;
  if(boundary===pages.length)pages.at(-1).after(moving);else pages[boundary].before(moving);
  renumber();show(slides().indexOf(active));checkpoint();
}
function boundaryAt(clientY){const entries=[...$('slides').querySelectorAll('.slide-entry')];for(let i=0;i<entries.length;i++){const r=entries[i].getBoundingClientRect();if(clientY<r.top+r.height/2)return i;}return entries.length;}
function configureSlideDrag(entry,index){
  entry.addEventListener('dragstart',e=>{slideDragIndex=index;e.dataTransfer.setData('text/x-slide-index',String(index));e.dataTransfer.effectAllowed='move';entry.classList.add('dragging');});
  entry.addEventListener('dragend',()=>{slideDragIndex=null;clearDropIndicator();entry.classList.remove('dragging');});
  entry.addEventListener('dragover',e=>{if(slideDragIndex===null)return;e.preventDefault();e.stopPropagation();indicateSlideBoundary(boundaryAt(e.clientY));});
  entry.addEventListener('drop',e=>{if(slideDragIndex===null)return;e.preventDefault();e.stopPropagation();const from=slideDragIndex,boundary=boundaryAt(e.clientY);slideDragIndex=null;clearDropIndicator();insertSlideAt(from,boundary);});
  // A dedicated pointer handle also works in native WebKit and touch input.
  const handle=document.createElement('button');handle.className='slide-drag-handle';handle.textContent='⠿';handle.title=t('拖动页面');handle.setAttribute('aria-label',t('拖动页面')+' '+(index+1));
  handle.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();entry.draggable=false;const startY=e.clientY;let moved=false,boundary=index;
    handle.setPointerCapture(e.pointerId);
    const move=ev=>{if(Math.abs(ev.clientY-startY)<4&&!moved)return;moved=true;entry.classList.add('dragging');boundary=boundaryAt(ev.clientY);indicateSlideBoundary(boundary);const panel=$('slides').closest('aside'),r=panel.getBoundingClientRect();if(ev.clientY<r.top+45)panel.scrollTop-=18;if(ev.clientY>r.bottom-45)panel.scrollTop+=18;};
    const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',cancel);entry.draggable=true;clearDropIndicator();entry.classList.remove('dragging');if(moved)insertSlideAt(index,boundary);};
    const cancel=()=>{moved=false;end();};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',cancel);
  });
  entry.querySelector('.slide-order').prepend(handle);
}
function appendSlideTools(list){
  const entries=[...list.querySelectorAll('.slide-entry')];
  for(let boundary=0;boundary<=entries.length;boundary++){
    const zone=document.createElement('div');zone.className='slide-drop-zone';zone.dataset.boundary=boundary;
    zone.addEventListener('dragover',e=>{if(slideDragIndex===null)return;e.preventDefault();e.stopPropagation();indicateSlideBoundary(boundary);});
    zone.addEventListener('drop',e=>{if(slideDragIndex===null)return;e.preventDefault();e.stopPropagation();const from=slideDragIndex;slideDragIndex=null;clearDropIndicator();insertSlideAt(from,boundary);});
    if(entries[boundary])entries[boundary].before(zone);else list.append(zone);
  }
  const add=document.createElement('button');add.id='addSlide';add.className='add-slide';add.textContent=t('＋ 新页面');add.onclick=createSlide;list.append(add);
}
function createSlide(){
  finish();const pages=slides();if(!pages.length)return;
  const reference=pages.find(page=>!page.classList.contains('cover')&&page.querySelector('.content-box'));
  let page;
  if(reference){
    page=reference.cloneNode(true);page.classList.remove('active');page.removeAttribute('data-editor-page');
    page.querySelectorAll('.content-box').forEach(box=>{box.replaceChildren();const p=doc().createElement('p');p.textContent=t('双击输入内容');box.append(p);});
    const heading=page.querySelector('h1,h2,h3');if(heading)heading.textContent=t('新页面');
    page.querySelectorAll('.speaker-notes').forEach(el=>el.textContent='');
  }else{
    page=doc().createElement('section');page.className='slide';
    const heading=doc().createElement('h2');heading.textContent=t('新页面');heading.style.cssText='position:absolute;left:80px;top:60px;margin:0;font-size:44px';
    const content=doc().createElement('p');content.textContent=t('双击输入内容');content.style.cssText='position:absolute;left:80px;top:180px;margin:0;font-size:30px';page.append(heading,content);
  }
  [page,...page.querySelectorAll('*')].forEach(el=>{el.removeAttribute('id');['data-editor-selected','data-editor-editing','contenteditable','data-slide-locked','data-slide-group'].forEach(attr=>el.removeAttribute(attr));});
  page.querySelectorAll('[data-editor-ui]').forEach(el=>el.remove());page.querySelectorAll('footer span').forEach(span=>span.textContent=String(pages.length+1));
  pages.at(-1).after(page);renumber();show(slides().length-1);checkpoint();requestAnimationFrame(()=>$('addSlide')?.scrollIntoView({block:'nearest'}));
}
