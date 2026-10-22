import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({console,setTimeout,clearTimeout,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Buffer});
vm.runInContext(await readFile(new URL('../slide-editor/vendor/pptxgen.bundle.js',import.meta.url),'utf8'),context);
vm.runInContext(await readFile(new URL('../slide-editor/pptx-editable.js',import.meta.url),'utf8'),context);
const exporter=context.SlideStudioPptx;
const rect=(x,y,w,h)=>({left:x,top:y,right:x+w,bottom:y+h,width:w,height:h});
const defaults={display:'block',position:'static',visibility:'visible',opacity:'1',transform:'none',rotate:'none',scale:'none',filter:'none',mixBlendMode:'normal',writingMode:'horizontal-tb',backgroundImage:'none',backgroundColor:'rgba(0, 0, 0, 0)',boxShadow:'none',textShadow:'none',borderTopLeftRadius:'0px',fontFamily:'Arial, sans-serif',fontSize:'24px',fontWeight:'400',fontStyle:'normal',color:'rgb(0, 0, 0)',textDecorationLine:'none',letterSpacing:'normal',whiteSpace:'normal',direction:'ltr',zIndex:'auto',clipPath:'none'};
for(const side of ['Top','Right','Bottom','Left'])Object.assign(defaults,{['border'+side+'Color']:'rgb(0, 0, 0)',['border'+side+'Width']:'0px',['border'+side+'Style']:'none'});
function fixture(){
  const document={defaultView:{getComputedStyle:(el,pseudo)=>pseudo?{content:'none'}:el.css},createRange(){let node,from,to;return {setStart(n,i){node=n;from=i;},setEnd(n,i){to=i;},getBoundingClientRect(){return rect(node.parentElement.box.left+from*12,node.parentElement.box.top,(to-from)*12,28);}};}};
  function element(tag,box,css={},children=[]){
    const el={nodeType:1,tagName:tag,box,css:{...defaults,...css},ownerDocument:document,childNodes:children,getBoundingClientRect(){return this.box;},matches(){return false;}};
    el.children=children.filter(n=>n.nodeType===1);for(const child of children)child.parentElement=el;return el;
  }
  const text=s=>({nodeType:3,textContent:s});
  const span=element('SPAN',rect(120,80,48,28),{display:'inline',fontWeight:'700'},[text('bold')]);
  const paragraph=element('P',rect(96,80,500,28),{opacity:'.5'},[text('Hi'),span]);
  const hidden=element('P',rect(0,0,100,30),{display:'none'},[text('Do not export')]);
  const svg=element('SVG',rect(800,100,96,96));
  const root=element('SECTION',rect(0,0,1280,720),{backgroundColor:'rgb(255, 255, 255)'},[paragraph,hidden,svg]);
  return {root};
}
test('DOM export retains styled inline text once, opacity, positions and independent fallback objects',async()=>{
  const calls=[];const {root}=fixture();const objects=await exporter.collect(root,{rasterize:async(el,mode)=>{calls.push([el.tagName,mode]);return 'data:image/png;base64,AA==';}});
  const texts=objects.filter(o=>o.type==='text');assert.equal(texts.length,1);
  assert.equal(texts[0].runs.map(r=>r.text).join(''),'Hibold');assert.equal(texts[0].x,1);assert.equal(texts[0].runs[0].options.fontSize,18);
  assert.equal(texts[0].runs[1].options.bold,true);assert.equal(texts[0].runs[1].options.transparency,50);
  assert.equal(objects[0].type,'shape');assert.equal(objects[0].fill.color,'FFFFFF');assert.deepEqual(calls,[['SVG','subtree']]);assert.equal(objects.at(-1).x,800/96);
});
test('written PPTX contains native text runs, rounded rectangles and separately selectable pictures',async()=>{
  const pptx=new context.PptxGenJS();pptx.layout='LAYOUT_WIDE';const slide=pptx.addSlide();
  exporter.addObjects(slide,[{type:'text',x:1,y:1,w:4,h:.5,runs:[{text:'Editable 中文 日本語',options:{fontFace:'Arial',fontSize:24,bold:true,color:'123456'}}]},{type:'shape',x:1,y:2,w:3,h:1,radius:18,fill:{color:'ABCDEF'},line:{color:'112233',width:1}},{type:'image',x:8,y:1,w:1,h:1,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}],pptx);
  slide.addNotes('Speaker note');
  const zip=await context.JSZip.loadAsync(await pptx.write({outputType:'uint8array'}));
  const xml=await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(xml,/<a:t>Editable 中文 日本語<\/a:t>/);assert.match(xml,/<a:rPr[^>]*sz="2400"[^>]*b="1"/);
  assert.match(xml,/<p:txBody><a:bodyPr wrap="none"/);assert.match(xml,/<a:prstGeom prst="roundRect"/);assert.equal((xml.match(/<p:pic>/g)||[]).length,1);
  assert.match(await zip.file('ppt/notesSlides/notesSlide1.xml').async('string'),/Speaker note/);
});
test('cancel interrupts collection before rendering any element',async()=>{
  const {root}=fixture();await assert.rejects(()=>exporter.collect(root,{check(){throw Error('EXPORT_CANCELLED');},rasterize(){throw Error('must not render');}}),/EXPORT_CANCELLED/);
});
