/* Offline PDF/PPTX export. Source HTML is never rewritten by this pipeline. */
let exportCancelled=false;
const exportLibraries=new Map();
function loadExportLibrary(name){
  if(!exportLibraries.has(name))exportLibraries.set(name,new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='/slide-editor/vendor/'+name;
    script.onload=resolve;script.onerror=()=>{exportLibraries.delete(name);script.remove();reject(Error('Unable to load '+name));};document.head.append(script);
  }));
  return exportLibraries.get(name);
}
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function exportCheck(){if(exportCancelled)throw Error('EXPORT_CANCELLED');}
async function captureSlides(consume){
  const html=clean(),parsed=new DOMParser().parseFromString(html,'text/html');
  parsed.querySelectorAll('script,base').forEach(el=>el.remove());
  const base=parsed.createElement('base');base.href=deckBaseURL();parsed.head.prepend(base);
  const style=parsed.createElement('style');style.textContent=`html,body{width:1280px!important;height:720px!important;margin:0!important;overflow:hidden!important}.deck{width:1280px!important;height:720px!important;transform:none!important}.slide{display:none!important}.slide[data-export-active]{display:block!important;position:absolute!important;inset:0!important;width:1280px!important;height:720px!important;transform:none!important;opacity:1!important;visibility:visible!important}.hud,.speaker-notes{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`;parsed.head.append(style);
  const captureFrame=document.createElement('iframe');captureFrame.setAttribute('sandbox','allow-same-origin');captureFrame.setAttribute('aria-hidden','true');captureFrame.style.cssText='position:fixed;left:-20000px;top:0;width:1280px;height:720px;border:0;transform:none;pointer-events:none;';
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(t('资源加载失败，请检查图片和字体链接。'))),30000);captureFrame.onload=()=>{clearTimeout(timer);resolve();};captureFrame.srcdoc='<!doctype html>'+parsed.documentElement.outerHTML;document.body.append(captureFrame);});
    exportCheck();const d=captureFrame.contentDocument,win=captureFrame.contentWindow;
    const pageList=[...d.querySelectorAll('.slide')];if(!pageList.length)throw Error('No slides');
    if(d.fonts)await Promise.race([d.fonts.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error(t('资源加载失败，请检查图片和字体链接。'))),20000))]);
    const images=[...d.images].filter(img=>!img.closest('[hidden]'));
    await Promise.all(images.map(img=>new Promise((resolve,reject)=>{
      if(img.complete)return img.naturalWidth?resolve():reject(Error(t('资源加载失败，请检查图片和字体链接。')+' '+img.getAttribute('src')));
      const timer=setTimeout(()=>reject(Error(t('资源加载失败，请检查图片和字体链接。'))),20000);
      img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error(t('资源加载失败，请检查图片和字体链接。')));};
    })));
    for(const img of images){
      const remote=new URL(img.currentSrc||img.src,d.baseURI);
      if(['http:','https:'].includes(remote.protocol)&&remote.origin!==location.origin){
        try{
          const response=await fetch(remote.href,{mode:'cors'});if(!response.ok)throw Error('HTTP '+response.status);
          const blob=await response.blob();img.src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});await img.decode();
        }catch{throw Error(t('资源加载失败，请检查图片和字体链接。')+' '+remote.href);}
      }
    }
    $('exportProgress').max=pageList.length;
    for(let i=0;i<pageList.length;i++){
      exportCheck();const page=pageList[i];pageList.forEach((el,n)=>el.toggleAttribute('data-export-active',i===n));
      // html2canvas handles transform matrices, but not the separate translate property.
      [page,...page.querySelectorAll('*')].forEach(el=>{
        const css=win.getComputedStyle(el),translation=css.translate;
        if(translation&&translation!=='none'){
          const parts=translation.split(/\s+/);el.style.transform=`translate(${parts[0]},${parts[1]||'0px'}) ${css.transform==='none'?'':css.transform}`;el.style.translate='none';
        }
      });
      $('exportStatus').textContent=`${i+1} / ${pageList.length}`;
      await new Promise(resolve=>setTimeout(resolve,40));
      let canvas;
      if(window.captureSlideNative){
        const data=await window.captureSlideNative('<!doctype html>'+d.documentElement.outerHTML);
        const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data;});
        canvas=document.createElement('canvas');canvas.width=2560;canvas.height=1440;canvas.getContext('2d').drawImage(image,0,0,2560,1440);
      }else{
        canvas=await Promise.race([html2canvas(page,{scale:2,width:1280,height:720,windowWidth:1280,windowHeight:720,scrollX:0,scrollY:0,backgroundColor:'#ffffff',useCORS:true,allowTaint:false,logging:false,onclone:cloned=>{cloned.querySelectorAll('[data-editor-ui]').forEach(el=>el.remove());}}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Page rendering timed out')),45000))]);
      }
      exportCheck();await consume(canvas,i,page.querySelector('.speaker-notes')?.textContent||'');canvas.width=1;canvas.height=1;
      $('exportProgress').value=i+1;
    }
  }finally{captureFrame.remove();}
}
async function exportDeck(format){
  if(!path||!slides().length)return;
  if(sourceDraft)return alert(t('源码有待应用的修改，应用或还原后即可定位元素。'));
  finish();exportCancelled=false;
  $('exportDescription').textContent=t('导出包含当前未保存的修改，不会覆盖原文件。PPTX 为高清图片页面，文字不能单独编辑。');
  $('exportProgress').value=0;$('exportStatus').textContent='';$('exportDialog').showModal();
  try{
    if(!window.captureSlideNative)await loadExportLibrary('html2canvas.min.js');exportCheck();
    const name=path==='@tutorial'?'landing-page-tutorial':path.split('/').pop().replace(/\.html?$/i,'');
    if(format==='pdf'){
      await loadExportLibrary('jspdf.umd.min.js');exportCheck();
      const pdf=new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:[960,540],compress:true});
      await captureSlides((canvas,i)=>{if(i)pdf.addPage([960,540],'landscape');pdf.addImage(canvas.toDataURL('image/jpeg',0.96),'JPEG',0,0,960,540,undefined,'FAST');});
      exportCheck();downloadBlob(pdf.output('blob'),name+'.pdf');
    }else{
      await loadExportLibrary('pptxgen.bundle.js');exportCheck();
      const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='Slide Studio';pptx.subject='HTML slide export';pptx.title=doc().title||name;pptx.lang=doc().documentElement.lang||'en-US';
      await captureSlides((canvas,i,notes)=>{const slide=pptx.addSlide();slide.addImage({data:canvas.toDataURL('image/png'),x:0,y:0,w:13.333333,h:7.5});if(notes.trim())slide.addNotes(notes);});
      $('exportStatus').textContent=t('正在生成文件');const blob=await pptx.write({outputType:'blob'});exportCheck();downloadBlob(blob,name+'.pptx');
    }
    status('导出完成');
  }catch(error){if(error.message==='EXPORT_CANCELLED')status('已取消导出');else{status('导出失败');alert(t('导出失败')+': '+error.message);}}
  finally{$('exportDialog').close();}
}
$('exportPDF').onclick=()=>exportDeck('pdf');$('exportPPTX').onclick=()=>exportDeck('pptx');
$('cancelExport').onclick=()=>{exportCancelled=true;$('exportStatus').textContent=t('已取消导出');};
$('exportDialog').addEventListener('cancel',e=>{e.preventDefault();exportCancelled=true;});
