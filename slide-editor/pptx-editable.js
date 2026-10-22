/* DOM → native PowerPoint objects. No editor annotations enter the source HTML.
 * CSS pixels are measured in the isolated 1280 × 720 export frame (96 px/in).
 * Text is split at rendered lines so browser wrapping survives without relying
 * on PowerPoint's different font metrics. Each line remains an editable textbox.
 */
(function(global){
  'use strict';
  const PX=96, PT=.75;
  function color(value){
    const m=String(value).match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
    if(!m)return null;
    const alpha=m[4]===undefined?1:Number(m[4]);
    return {color:m.slice(1,4).map(n=>Math.round(Number(n)).toString(16).padStart(2,'0')).join('').toUpperCase(),transparency:100*(1-alpha)};
  }
  function fontFace(css){
    const families=css.fontFamily.split(',').map(s=>s.trim().replace(/^['"]|['"]$/g,''));
    return families.find(s=>!['-apple-system','BlinkMacSystemFont','system-ui','sans-serif','serif','monospace'].includes(s))||(/monospace/.test(css.fontFamily)?'Courier New':'Arial');
  }
  function bounds(rect,origin){return {x:(rect.left-origin.left)/PX,y:(rect.top-origin.top)/PX,w:rect.width/PX,h:rect.height/PX};}
  function opacity(el,root,win){let alpha=1;for(let p=el;p;p=p.parentElement){alpha*=Number(win.getComputedStyle(p).opacity);if(p===root)break;}return alpha;}
  function textStyle(css,alpha){
    const ink=color(css.color)||{color:'000000',transparency:0};
    return {fontFace:fontFace(css),fontSize:parseFloat(css.fontSize)*PT,bold:Number(css.fontWeight)>=600||css.fontWeight==='bold',italic:css.fontStyle==='italic',color:ink.color,transparency:100-(100-ink.transparency)*alpha,underline:css.textDecorationLine.includes('underline'),strike:css.textDecorationLine.includes('line-through'),charSpacing:(parseFloat(css.letterSpacing)||0)*PT};
  }
  // Inline nodes share a text flow; positioned or block children get their own.
  function isInline(el,win){const c=win.getComputedStyle(el);return ['inline','contents'].includes(c.display)&&!['absolute','fixed'].includes(c.position)&&c.transform==='none'&&c.filter==='none'&&c.textShadow==='none'&&c.backgroundImage==='none'&&(!color(c.backgroundColor)||color(c.backgroundColor).transparency===100);}
  function textLines(el,root,win,origin){
    const tokens=[],range=el.ownerDocument.createRange();
    function visit(node){
      if(node.nodeType===3){
        const css=win.getComputedStyle(node.parentElement);if(css.visibility!=='visible')return;
        const preserve=/pre|break-spaces/.test(css.whiteSpace),style=textStyle(css,opacity(node.parentElement,root,win));
        // A range per code point preserves inline styling, CJK and browser wraps.
        let offset=0;
        for(const character of node.textContent){
          range.setStart(node,offset);offset+=character.length;range.setEnd(node,offset);
          const rect=range.getBoundingClientRect();if(!rect.width||!rect.height)continue;
          let text=character;if(!preserve&&/\s/.test(text))text=' ';
          if(css.textTransform==='uppercase')text=text.toLocaleUpperCase();
          if(css.textTransform==='lowercase')text=text.toLocaleLowerCase();
          tokens.push({text,rect,style,dir:css.direction});
        }
      }else if(node.nodeType===1&&isInline(node,win))for(const child of node.childNodes)visit(child);
    }
    for(const child of el.childNodes)visit(child);
    const lines=[];
    for(const token of tokens){
      let line=lines.at(-1);
      if(!line||Math.abs(line.top-token.rect.top)>Math.max(3,token.rect.height*.45)){
        line={left:token.rect.left,right:token.rect.right,top:token.rect.top,bottom:token.rect.bottom,runs:[],dir:token.dir};lines.push(line);
      }
      line.left=Math.min(line.left,token.rect.left);line.right=Math.max(line.right,token.rect.right);line.bottom=Math.max(line.bottom,token.rect.bottom);
      const previous=line.runs.at(-1);
      if(previous&&JSON.stringify(previous.options)===JSON.stringify(token.style))previous.text+=token.text;
      else line.runs.push({text:token.text,options:token.style});
    }
    return lines.filter(line=>line.runs.some(run=>run.text.trim())).map(line=>({
      type:'text',...bounds({left:line.left,top:line.top,width:line.right-line.left,height:line.bottom-line.top},origin),runs:line.runs,rtl:line.dir==='rtl'
    }));
  }
  function hasOwnText(el,win){return [...el.childNodes].some(n=>n.nodeType===3?n.textContent.trim():n.nodeType===1&&isInline(n,win)&&hasOwnText(n,win));}
  function transformed(css){return css.transform!=='none'||(css.rotate&&css.rotate!=='none')||(css.scale&&css.scale!=='none'&&css.scale!=='1');}
  function imageData(el,css,alpha){
    if(css.boxShadow!=='none'||css.clipPath!=='none'||parseFloat(css.borderTopWidth)||parseFloat(css.paddingTop))return null;
    const w=el.clientWidth,h=el.clientHeight,canvas=el.ownerDocument.createElement('canvas');
    canvas.width=Math.ceil(w*2);canvas.height=Math.ceil(h*2);const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.globalAlpha=alpha;
    const radius=css.borderTopLeftRadius.endsWith('%')?Math.min(w,h)*parseFloat(css.borderTopLeftRadius)/100:parseFloat(css.borderTopLeftRadius)||0;
    ctx.beginPath();if(ctx.roundRect)ctx.roundRect(0,0,w,h,radius);else ctx.rect(0,0,w,h);ctx.clip();
    const iw=el.naturalWidth,ih=el.naturalHeight;
    let dw=w,dh=h;
    if(['cover','contain','scale-down','none'].includes(css.objectFit)){
      let scale=css.objectFit==='cover'?Math.max(w/iw,h/ih):Math.min(w/iw,h/ih);
      if(css.objectFit==='none')scale=1;if(css.objectFit==='scale-down')scale=Math.min(scale,1);
      dw=iw*scale;dh=ih*scale;
    }
    const position=css.objectPosition.split(/\s+/),place=(p,space)=>p?.endsWith('%')?space*parseFloat(p)/100:parseFloat(p)||0;
    ctx.drawImage(el,place(position[0],w-dw),place(position[1]||position[0],h-dh),dw,dh);
    const data=canvas.toDataURL('image/png');canvas.width=canvas.height=1;return data;
  }
  async function collect(page,{rasterize,check=()=>{}}){
    const win=page.ownerDocument.defaultView,origin=page.getBoundingClientRect(),items=[];
    async function raster(el,mode,alpha){
      const rect=el.getBoundingClientRect();const data=(el.tagName==='IMG'&&imageData(el,win.getComputedStyle(el),alpha))||await rasterize(el,mode);check();
      if(data)items.push({type:'image',...bounds(rect,origin),data});
    }
    async function walk(el,textHandled=false){
      check();const css=win.getComputedStyle(el),rect=el.getBoundingClientRect();
      if(css.display==='none'||el.matches('.speaker-notes,.hud,[data-editor-ui]')||!rect.width||!rect.height||Number(css.opacity)===0)return;
      // Hidden parents may contain explicitly visible children.
      const visible=css.visibility==='visible',alpha=opacity(el,page,win);
      if(rect.right<=origin.left||rect.bottom<=origin.top||rect.left>=origin.right||rect.top>=origin.bottom)return;
      if(visible&&((el!==page&&['hidden','clip','scroll','auto'].includes(css.overflow)&&(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1))||css.backgroundClip==='text'||css.webkitBackgroundClip==='text'||(css.textShadow!=='none'&&hasOwnText(el,win))||css.clipPath!=='none'||transformed(css)||css.filter!=='none'||css.mixBlendMode!=='normal'||['SVG','CANVAS','VIDEO','IFRAME'].includes(el.tagName.toUpperCase())||css.writingMode!=='horizontal-tb')){
        await raster(el,'subtree',alpha);return;
      }
      const radius=parseFloat(css.borderTopLeftRadius)||0;
      if(visible&&el.tagName==='IMG'){
        // Rasterize just this image: CSS object-fit, crop and rounded corners
        // survive, while the result remains an independent picture in PPT.
        await raster(el,'subtree',alpha);return;
      }
      if(visible){
        const bg=color(css.backgroundColor),border=color(css.borderTopColor);
        const widths=['Top','Right','Bottom','Left'].map(side=>parseFloat(css['border'+side+'Width'])||0);
        const hasBorder=widths.some(n=>n>0);
        const simpleBorder=widths.every(n=>n===widths[0])&&['Top','Right','Bottom','Left'].every(side=>css['border'+side+'Style']===css.borderTopStyle&&css['border'+side+'Color']===css.borderTopColor)&&(!hasBorder||css.borderTopStyle==='solid');
        const pseudo=['::before','::after'].some(p=>{const s=win.getComputedStyle(el,p);return s.content!=='none'&&s.content!=='normal';});
        if(css.backgroundImage!=='none'||css.boxShadow!=='none'||!simpleBorder||pseudo){
          await raster(el,'surface',alpha);
        }else if((bg&&bg.transparency<100)||hasBorder){
          items.push({type:'shape',...bounds(rect,origin),radius,fill:bg&&bg.transparency<100?{...bg,transparency:100-(100-bg.transparency)*alpha}:null,line:hasBorder&&border?{...border,transparency:100-(100-border.transparency)*alpha,width:widths[0]*PT}:null});
        }
        if(!textHandled&&hasOwnText(el,win)){
          items.push(...textLines(el,page,win,origin));
        }
      }
      // Preserve ordinary stacking/layer order, including negative z-index.
      const children=[...el.children];
      children.sort((a,b)=>(parseInt(win.getComputedStyle(a).zIndex)||0)-(parseInt(win.getComputedStyle(b).zIndex)||0));
      for(const child of children)await walk(child,isInline(child,win));
    }
    await walk(page);return items;
  }
  function addObjects(slide,items,pptx){
    for(const item of items){
      if(![item.x,item.y,item.w,item.h].every(Number.isFinite)||item.w<=0||item.h<=0)continue;
      const box={x:item.x,y:item.y,w:item.w,h:item.h};
      if(item.type==='text'){
        slide.addText(item.runs,{...box,w:box.w+.025,margin:0,breakLine:false,valign:'mid',fontSize:item.runs[0].options.fontSize,fontFace:item.runs[0].options.fontFace,paraSpaceAfter:0,paraSpaceBefore:0,lineSpacingMultiple:1,rtlMode:item.rtl,wrap:false});
      }else if(item.type==='shape'){
        slide.addShape(item.radius>0?pptx.ShapeType.roundRect:pptx.ShapeType.rect,{...box,rectRadius:item.radius/PX,fill:item.fill||{color:'FFFFFF',transparency:100},line:item.line||{color:'FFFFFF',transparency:100,width:0}});
      }else if(item.type==='image')slide.addImage({...box,data:item.data});
    }
  }
  global.SlideStudioPptx={collect,addObjects,color,textStyle};
})(typeof window==='undefined'?globalThis:window);
