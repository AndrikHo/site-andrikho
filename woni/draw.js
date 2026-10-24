/* ===== Editor: zone, shapes, arrows, fonts, colors, history, account sheet =====
   Loaded last, after i18n.js + buildings.js + parcels.js + app.js.
   Reuses app.js globals (map, geocoder, LL, closePop, pressHouse, buildingAt,
   inPoly, tapBlock, notes, NOTES_KEY, saveNotes, curG, renderPop, drawPins,
   updateProgress, delivered, saveDone, openSearch) and i18n globals ($, esc,
   store, msg, tr, setLang). Exposes window.drawInit / drawOnTap / drawApplyLang
   / setEditing / editing for app.js integration. */
const DRAW_KEY='woni-draw-v1';
const show=(el,on,dir)=>el&&el.classList.toggle('out-'+dir,!on);

/* ---------- palettes ---------- */
const COLORS=['#e8590c','#c92a2a','#f59f00','#2b8a3e','#1f4fd1','#7048e8','#111827','#ffffff'];
const FONTS=[['sys','f_sys','system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif'],
  ['noto','Noto Sans 한글','"Noto Sans KR",system-ui,sans-serif'],['black','Black Han Sans 굵은','"Black Han Sans","Noto Sans KR",sans-serif'],
  ['jua','Jua 둥근','"Jua","Noto Sans KR",sans-serif'],['pen','Nanum Pen 손글씨','"Nanum Pen Script",cursive'],['mono','f_mono','ui-monospace,Menlo,Consolas,monospace']];
const FONT_CSS=Object.fromEntries(FONTS.map(f=>[f[0],f[2]]));
const SHAPES=['pin','round','rect','pill','ellipse','flag'].map(k=>[k]);const shapeName=k=>tr('s_'+k);
const ARROWS=['plain','thick','num','chev','dash'].map(k=>[k]);const arrowName=k=>tr('a_'+k);
const defFont=()=>({f:'sys',ls:0,vert:false,b:true,i:false,c:'#ffffff',a:1});

/* ---------- model + history ---------- */
let D=store.get(DRAW_KEY,null);
D=Object.assign({items:[],zone:[],zoneStyle:{c:'#1f4fd1',a:1},def:{}},D||{});
D.def=Object.assign({shape:'pin',arrow:'plain',c:'#e8590c',a:1,font:defFont()},D.def);
D.items.forEach((it,i)=>it.id=it.id||('i'+Date.now().toString(36)+i));
const saveD=()=>store.set(DRAW_KEY,D);
const hist=[],fut=[];let lastSnap=0;
function snap(soft){
  if(soft&&Date.now()-lastSnap<900){lastSnap=Date.now();return;}
  hist.push(JSON.stringify(D));if(hist.length>80)hist.shift();fut.length=0;lastSnap=soft?Date.now():0;updHist();}
function restore(json){const keepSel=sel&&sel.id;D=JSON.parse(json);sel=keepSel?D.items.find(i=>i.id===keepSel)||null:null;saveD();drawAll();refreshUI();}
function updHist(){const u=$('hUndo'),r=$('hRedo');if(u)u.disabled=!hist.length;if(r)r.disabled=!fut.length;}
const newId=()=>'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

/* zoom scaling: drawn shapes/badges/zone points grow & shrink with the map,
   clamped so they never vanish or swallow the screen. factor = 2^(base-level). */
const BASE_LEVEL=3,ZF_MIN=.55,ZF_MAX=2.6;let zf=1;
function computeZf(){if(!map)return;zf=Math.max(ZF_MIN,Math.min(ZF_MAX,Math.pow(2,BASE_LEVEL-map.getLevel())));}

/* ---------- edit mode, tools, panels ---------- */
let editing=false,tool=null,sel=null,panel=null,arrowStart=null,arrowTmp=null,txtCtx=null;
window.editing=false;
function setEditing(on){
  editing=on;window.editing=on;document.body.classList.toggle('edit',on);
  if(on&&typeof openSearch==='function'&&$('sbar').classList.contains('open'))openSearch(false);
  show($('mainIsl'),!on,'b');show($('closeBtn'),on,'b');show($('toolIsl'),on,'r');show($('histIsl'),on,'l');show($('fly'),false,'r');
  if(on){closePop();updHist();$('msg').classList.add('hide');}else{setTool(null);sel=null;openPanel(null);show($('ctxIsl'),false,'t');}
  if(map)map.setZoomable(!(on&&sel));
  drawAll();refreshUI();
}
window.setEditing=setEditing;

function setTool(t){
  tool=t;arrowStart=null;if(arrowTmp){arrowTmp.setMap(null);arrowTmp=null;}
  const cr=$('cross');if(cr)cr.hidden=t!=='zone';if(t)select(null,true);
  drawAll();refreshUI();
}
function select(it,quiet){sel=it;if(map)map.setZoomable(!it);if(!quiet){drawAll();refreshUI();}}

function openPanel(k){panel=k;const f=$('fly');show(f,!!k,'r');if(k)renderPanel();refreshToolBtns();}
function refreshToolBtns(){
  const set=(id,on)=>{const e=$(id);if(e)e.classList.toggle('on',on);};
  set('tZone',tool==='zone');set('tShape',panel==='shape'||tool==='shape');
  set('tArrow',panel==='arrow'||tool==='arrow');set('tFont',panel==='font');set('tColor',panel==='color');
  const c=colorTarget(),d=$('cDot');if(d)d.style.background=c.get().c;
}
function colorTarget(){
  if(sel&&sel.k==='shape')return{name:tr('tg_shape'),get:()=>({c:sel.fill,a:sel.a}),set:v=>{if(v.c!=null)sel.fill=v.c;if(v.a!=null)sel.a=v.a;}};
  if(sel&&sel.k==='arrow')return{name:tr('tg_arrow'),get:()=>({c:sel.c,a:sel.o}),set:v=>{if(v.c!=null)sel.c=v.c;if(v.a!=null)sel.o=v.a;}};
  if(tool==='zone')return{name:tr('tg_zone'),get:()=>D.zoneStyle,set:v=>Object.assign(D.zoneStyle,v)};
  return{name:tr('tg_new'),get:()=>({c:D.def.c,a:D.def.a}),set:v=>{if(v.c!=null)D.def.c=v.c;if(v.a!=null)D.def.a=v.a;}};
}
function fontTarget(){return sel&&sel.k==='shape'?{name:tr('tg_selshape'),f:sel.font}:{name:tr('tg_newshape'),f:D.def.font};}

function shapeIcon(form){const m={pin:'<rect x="4" y="3" width="44" height="18" rx="6"/><path d="M22 21l4 6 4-6z"/>',round:'<rect x="4" y="5" width="44" height="20" rx="7"/>',rect:'<rect x="4" y="5" width="44" height="20" rx="1"/>',
  pill:'<rect x="2" y="5" width="48" height="20" rx="10"/>',ellipse:'<ellipse cx="26" cy="15" rx="23" ry="12"/>',flag:'<rect x="8" y="2" width="40" height="16" rx="1"/><rect x="8" y="18" width="2.5" height="11"/>'}[form];
  return `<svg viewBox="0 0 52 30" fill="currentColor" style="color:${D.def.c}">${m}</svg>`;}
function arrowIcon(type){const c=D.def.c,h=`<path d="M40 8l9 7-9 7" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 52 30">${{plain:`<path d="M4 15h42" stroke="${c}" stroke-width="3"/>`+h,
    thick:`<path d="M4 11h30V5l14 10-14 10v-6H4z" fill="${c}"/>`,
    num:`<path d="M12 15h28" stroke="${c}" stroke-width="3"/>${h}<circle cx="7" cy="15" r="6" fill="${c}"/><text x="7" y="18.5" font-size="8" fill="#fff" text-anchor="middle" font-weight="800">1</text>`,
    chev:`<path d="M4 15h44" stroke="${c}" stroke-width="2.5"/><path d="M12 9l7 6-7 6M26 9l7 6-7 6M40 9l7 6-7 6" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/>`,
    dash:`<path d="M4 15h40" stroke="${c}" stroke-width="3" stroke-dasharray="8 3 2 3"/>`+h}[type]}</svg>`;}

function renderPanel(){
  const f=$('fly');if(!f)return;
  if(panel==='shape'){
    f.innerHTML=`<h3>${tr('shapes')}</h3><div class="grid">${SHAPES.map(([k])=>`<button class="opt${tool==='shape'&&D.def.shape===k?' on':''}" data-k="${k}">${shapeIcon(k)}${shapeName(k)}</button>`).join('')}</div>
      <div class="target">${tr('shapes_hint')}</div>`;
    f.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{D.def.shape=b.dataset.k;saveD();setTool('shape');openPanel(null);});
  }else if(panel==='arrow'){
    f.innerHTML=`<h3>${tr('arrows')}</h3><div class="grid">${ARROWS.map(([k])=>`<button class="opt${tool==='arrow'&&D.def.arrow===k?' on':''}" data-k="${k}">${arrowIcon(k)}${arrowName(k)}</button>`).join('')}</div>`;
    f.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{D.def.arrow=b.dataset.k;saveD();setTool('arrow');openPanel(null);});
  }else if(panel==='font'){
    const Tg=fontTarget(),F=Tg.f;
    f.innerHTML=`<h3>${tr('font')}</h3><div class="target">${tr('changes',{x:Tg.name})}</div>
     <div class="fonts">${FONTS.map(([k,n,css])=>`<button data-f="${k}" class="${F.f===k?'on':''}" style="font-family:${css.replace(/"/g,'&quot;')}">${n.startsWith('f_')?tr(n):n}</button>`).join('')}</div>
     <div class="seg"><button data-t="b" class="${F.b?'on':''}" style="font-weight:800">${tr('bold')}</button><button data-t="i" class="${F.i?'on':''}" style="font-style:italic">${tr('italic')}</button>
       <button data-t="h" class="${!F.vert?'on':''}">${tr('horiz')}</button><button data-t="v" class="${F.vert?'on':''}">${tr('vert')}</button></div>
     <label class="row">${tr('spacing')}<input type="range" id="fLs" min="-2" max="12" step="0.5" value="${F.ls}"><b id="fLsV">${F.ls}</b></label>
     <h3>${tr('text_color')}</h3><div class="sws">${COLORS.map(c=>`<button class="sw${F.c===c?' on':''}" data-c="${c}" style="background:${c}" aria-label="${tr('text_color')}"></button>`).join('')}</div>
     <label class="row">${tr('opacity')}<input type="range" id="fA" min="10" max="100" step="5" value="${Math.round(F.a*100)}"><b id="fAV">${Math.round(F.a*100)}%</b></label>`;
    const ch=()=>{saveD();drawAll();};
    f.querySelectorAll('.fonts button').forEach(b=>b.onclick=()=>{snap();F.f=b.dataset.f;ch();renderPanel();});
    f.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{snap();const t=b.dataset.t;if(t==='b')F.b=!F.b;if(t==='i')F.i=!F.i;if(t==='h')F.vert=false;if(t==='v')F.vert=true;ch();renderPanel();});
    f.querySelectorAll('.sw').forEach(b=>b.onclick=()=>{snap();F.c=b.dataset.c;ch();renderPanel();});
    $('fLs').oninput=e=>{snap(true);F.ls=+e.target.value;$('fLsV').textContent=F.ls;ch();};
    $('fA').oninput=e=>{snap(true);F.a=e.target.value/100;$('fAV').textContent=e.target.value+'%';ch();};
  }else if(panel==='color'){
    const Tg=colorTarget(),cur=Tg.get();
    f.innerHTML=`<h3>${tr('color')}</h3><div class="target">${tr('changes',{x:Tg.name})}</div>
     <div class="wheelBox"><canvas id="wheel" width="400" height="400"></canvas><div class="knob" id="knob"></div></div>
     <label class="row">${tr('bright')}<input type="range" id="cV" min="0" max="100" value="100"><b id="cVV">100%</b></label>
     <div class="sws">${COLORS.map(c=>`<button class="sw${cur.c===c?' on':''}" data-c="${c}" style="background:${c}" aria-label="${tr('color')}"></button>`).join('')}</div>
     <label class="row">${tr('opacity')}<input type="range" id="cA" min="10" max="100" step="5" value="${Math.round((cur.a==null?1:cur.a)*100)}"><b id="cAV">${Math.round((cur.a==null?1:cur.a)*100)}%</b></label>
     <div class="prev"><i id="cPrev"></i></div>`;
    colorWheel(Tg);
  }
}
/* HSV colour wheel */
function hsv2rgb(h,s,v){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1));};return[f(5),f(3),f(1)].map(x=>Math.round(x*255));}
function rgb2hex(r){return'#'+r.map(x=>x.toString(16).padStart(2,'0')).join('');}
function hex2hsv(hex){const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}
  return{h,s:mx?d/mx:0,v:mx};}
function colorWheel(Tg){
  const cv=$('wheel'),ctx=cv.getContext('2d'),R=200;let {h,s,v}=hex2hsv(Tg.get().c);
  const draw=()=>{const img=ctx.createImageData(400,400);
    for(let y=0;y<400;y++)for(let x=0;x<400;x++){const dx=x-R,dy=y-R,d=Math.hypot(dx,dy),i=(y*400+x)*4;if(d>R)continue;
      const [r,g,b]=hsv2rgb((Math.atan2(dy,dx)*180/Math.PI+360)%360,d/R,v);img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255;}
    ctx.putImageData(img,0,0);};
  const knob=()=>{const a=h*Math.PI/180;$('knob').style.left=(100+Math.cos(a)*s*100)+'px';$('knob').style.top=(100+Math.sin(a)*s*100)+'px';
    const hex=rgb2hex(hsv2rgb(h,s,v));$('knob').style.background=hex;$('cPrev').style.background=hex;$('cPrev').style.opacity=(Tg.get().a==null?1:Tg.get().a);};
  const apply=()=>{Tg.set({c:rgb2hex(hsv2rgb(h,s,v))});saveD();drawAll();knob();refreshToolBtns();};
  $('cV').value=Math.round(v*100);$('cVV').textContent=Math.round(v*100)+'%';draw();knob();
  const pickAt=e=>{const r=cv.getBoundingClientRect(),dx=e.clientX-r.left-100,dy=e.clientY-r.top-100;
    h=(Math.atan2(dy,dx)*180/Math.PI+360)%360;s=Math.min(1,Math.hypot(dx,dy)/100);apply();};
  let down=false;
  cv.addEventListener('pointerdown',e=>{down=true;cv.setPointerCapture(e.pointerId);snap(true);pickAt(e);});
  cv.addEventListener('pointermove',e=>{if(down){snap(true);pickAt(e);}});
  cv.addEventListener('pointerup',()=>down=false);cv.addEventListener('pointercancel',()=>down=false);
  $('cV').oninput=e=>{snap(true);v=e.target.value/100;$('cVV').textContent=e.target.value+'%';draw();apply();};
  $('cA').oninput=e=>{snap(true);Tg.set({a:e.target.value/100});$('cAV').textContent=e.target.value+'%';saveD();drawAll();knob();};
  $('fly').querySelectorAll('.sw').forEach(b=>b.onclick=()=>{snap();Tg.set({c:b.dataset.c});({h,s,v}=hex2hsv(b.dataset.c));saveD();drawAll();renderPanel();refreshToolBtns();});
}

/* context island: hint + actions for the current tool or selection */
function refreshUI(){
  refreshToolBtns();
  if(!editing){show($('ctxIsl'),false,'t');return;}
  let hint='',btns=[];
  if(tool==='zone'){
    hint=tr('h_zone',{n:D.zone.length});
    btns=[[tr('put_pt'),'pri',()=>{snap();const c=map.getCenter();D.zone.push([r6(c.getLat()),r6(c.getLng())]);saveD();drawAll();refreshUI();}],
      [tr('rm_pt'),'',()=>{if(!D.zone.length)return;snap();D.zone.pop();saveD();drawAll();refreshUI();}],
      ...(D.zone.length?[[tr('erase'),'danger',function(){if(this.dataset.sure){snap();D.zone=[];saveD();drawAll();refreshUI();}else{this.dataset.sure=1;this.textContent=tr('sure_erase');}}]]:[]),
      [tr('ok'),'',()=>setTool(null)]];
  }else if(tool==='shape'){hint=tr('h_shape',{x:shapeName(D.def.shape)});btns=[[tr('ok'),'',()=>setTool(null)]];}
  else if(tool==='arrow'){hint=arrowStart?tr('h_arrow2'):tr('h_arrow',{x:arrowName(D.def.arrow)});btns=[[tr('ok'),'',()=>setTool(null)]];}
  else if(sel&&sel.k==='shape'){hint=tr('h_selshape');
    btns=[[tr('text'),'',()=>openText(sel,false)],[tr('del'),'danger',delSel],[tr('unsel'),'',()=>select(null)]];}
  else if(sel&&sel.k==='arrow'){hint=tr('h_selarrow');
    btns=[...(sel.type==='num'?[[tr('numbers'),'',()=>openText(sel,false)]]:[]),[tr('del'),'danger',delSel],[tr('unsel'),'',()=>select(null)]];}
  else hint=tr('h_idle');
  $('ctxHint').textContent=hint;const bx=$('ctxBtns');bx.innerHTML='';
  btns.forEach(([t,c,fn])=>{const b=document.createElement('button');b.textContent=t;if(c)b.className=c;b.onclick=fn;bx.append(b);});
  show($('ctxIsl'),true,'t');
  if(panel==='color'||panel==='font')renderPanel();
}
function delSel(){if(!sel)return;snap();D.items=D.items.filter(i=>i!==sel);sel=null;if(map)map.setZoomable(true);saveD();drawAll();refreshUI();}

/* taps on the map while editing */
function editTap(ll){
  const p=[r6(ll.getLat()),r6(ll.getLng())];
  if(panel){openPanel(null);return;}
  if(tool==='zone'){snap();D.zone.push(p);saveD();drawAll();refreshUI();return;}
  if(tool==='shape'){const it={id:newId(),k:'shape',form:D.def.shape,p,t:'',fill:D.def.c,a:D.def.a,s:1,font:{...D.def.font}};openText(it,true);return;}
  if(tool==='arrow'){
    if(!arrowStart){arrowStart=p;arrowTmp=new kakao.maps.Circle({map,center:ll,radius:3,strokeWeight:3,strokeColor:D.def.c,fillColor:D.def.c,fillOpacity:1,zIndex:6});refreshUI();return;}
    const type=D.def.arrow,it={id:newId(),k:'arrow',type,a:arrowStart,b:p,c:D.def.c,o:D.def.a,w:type==='thick'?14:5};
    arrowStart=null;arrowTmp.setMap(null);arrowTmp=null;
    if(type==='num'){it.n1='';it.n2='';openText(it,true);}else{snap();D.items.push(it);saveD();drawAll();}
    refreshUI();return;}
  const q=map.getProjection().containerPointFromCoords(ll),h=findArrowAt([q.x,q.y]);select(h?h.obj:null);
}

/* text / numbers sheet */
function openText(it,isNew){
  txtCtx={it,isNew};const isNum=it.k==='arrow';
  $('txtTitle').textContent=isNum?tr('txt_num'):(isNew?tr('txt_new'):tr('txt_edit'));
  $('txtIn').hidden=isNum;$('numRow').hidden=!isNum;$('txtDel').hidden=isNew;
  $('txtIn').value=it.t||'';$('n1').value=it.n1||'';$('n2').value=it.n2||'';
  show($('txtSheet'),true,'b');show($('closeBtn'),false,'b');
  setTimeout(()=>(isNum?$('n1'):$('txtIn')).focus(),120);
}
function closeText(){show($('txtSheet'),false,'b');show($('closeBtn'),editing,'b');if(document.activeElement)document.activeElement.blur();txtCtx=null;}

/* account sheet: language, backup, clear, reset */
function showAcc(on){show($('accSheet'),on,'b');show($('mainIsl'),!on&&!editing,'b');}

/* ---------- rendering ---------- */
const elOf=new WeakMap(),ovOf=new Map(),objsOf=new Map();let zoneShape=null,vtx=[];
const A1=v=>v==null?1:v;
function hexA(hex,a){const n=parseInt(hex.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
function styleShape(el,it){
  const F=it.font||defFont();
  el.className='shp '+it.form+(F.vert?' vert':'')+(sel===it?' sel':'');
  el.style.setProperty('--bg',it.fill);el.style.background=it.fill;el.style.opacity=A1(it.a);
  el.style.fontSize=(14*(it.s||1)*zf).toFixed(1)+'px';el.style.fontFamily=FONT_CSS[F.f]||FONT_CSS.sys;
  el.style.fontWeight=F.b?'700':'400';el.style.fontStyle=F.i?'italic':'normal';el.style.letterSpacing=(F.ls||0)+'px';
  el.style.color=hexA(F.c||'#ffffff',A1(F.a));el.textContent=it.t||'';
}
function geoLen(a,b){return Math.hypot((a[0]-b[0])*111000,(a[1]-b[1])*91000);}
function drawItem(it){
  undraw(it);const objs=[];
  if(it.k==='shape'){
    const el=document.createElement('div');styleShape(el,it);elOf.set(el,it);
    ['mousedown','touchstart','touchend','dblclick'].forEach(ev=>el.addEventListener(ev,e=>{if(editing)e.stopPropagation();}));
    el.addEventListener('click',e=>{if(!editing)return;e.stopPropagation();if(Date.now()-tapBlock<400)return;tapBlock=Date.now();if(tool)setTool(null);select(it);});
    const anch=it.form==='pin'?1:it.form==='flag'?1:.5,xa=it.form==='flag'?0:.5;
    const ov=new kakao.maps.CustomOverlay({map,position:LL(it.p),content:el,xAnchor:xa,yAnchor:anch,zIndex:6,clickable:true});
    ovOf.set(it.id,ov);objs.push(ov);
  }else{
    const w=it.w||5,c=it.c,o=.95*A1(it.o),path=[LL(it.a),LL(it.b)];
    if(sel===it)objs.push(new kakao.maps.Polyline({map,path,strokeWeight:w+12,strokeColor:'#1f4fd1',strokeOpacity:.4,zIndex:4}));
    if(it.type==='chev'){
      const n=Math.max(2,Math.min(24,Math.round(geoLen(it.a,it.b)/22)));
      objs.push(new kakao.maps.Polyline({map,path,strokeWeight:Math.max(2,w*.6),strokeColor:c,strokeOpacity:o,zIndex:5}));
      for(let i=1;i<=n;i++){const t0=(i-.35)/n,t1=i/n,P=t=>new kakao.maps.LatLng(it.a[0]+(it.b[0]-it.a[0])*t,it.a[1]+(it.b[1]-it.a[1])*t);
        objs.push(new kakao.maps.Polyline({map,path:[P(t0),P(t1)],strokeWeight:w,strokeColor:c,strokeOpacity:o,endArrow:true,zIndex:5}));}
    }else{
      objs.push(new kakao.maps.Polyline({map,path,strokeWeight:w,strokeColor:c,strokeOpacity:o,endArrow:true,zIndex:5,
        strokeStyle:it.type==='dash'?'dashdot':'solid'}));
    }
    if(it.type==='num'){[['n1',it.a],['n2',it.b]].forEach(([k,p])=>{if(!it[k])return;const el=document.createElement('div');el.className='numb';el.style.background=c;el.style.opacity=A1(it.o);el.textContent=it[k];
      el.style.fontSize=(12.5*zf).toFixed(1)+'px';el.style.minWidth=(24*zf).toFixed(1)+'px';el.style.height=(24*zf).toFixed(1)+'px';
      objs.push(new kakao.maps.CustomOverlay({map,position:LL(p),content:el,xAnchor:k==='n1'?1.15:-.15,yAnchor:.5,zIndex:6}));});}
  }
  objsOf.set(it.id,objs);
}
function undraw(it){(objsOf.get(it.id)||[]).forEach(o=>o.setMap(null));objsOf.delete(it.id);ovOf.delete(it.id);}
function drawAll(){
  if(!map)return;for(const [id,objs] of objsOf)objs.forEach(o=>o.setMap(null));objsOf.clear();ovOf.clear();
  vtx.forEach(m=>m.setMap(null));vtx=[];if(zoneShape){zoneShape.setMap(null);zoneShape=null;}
  const z=D.zoneStyle;
  if(D.zone.length>1)zoneShape=new kakao.maps.Polygon({map,path:D.zone.map(LL),strokeWeight:4,strokeColor:z.c,strokeStyle:'dash',strokeOpacity:.95*A1(z.a),fillColor:z.c,fillOpacity:(tool==='zone'?.08:.04)*A1(z.a),zIndex:2});
  if(editing&&tool==='zone'){const vs=Math.round(26*zf),vh=vs/2;const img=new kakao.maps.MarkerImage('data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="8" fill="#fff" stroke="${z.c}" stroke-width="4"/></svg>`),new kakao.maps.Size(vs,vs),{offset:new kakao.maps.Point(vh,vh)});
    D.zone.forEach((p,i)=>{const m=new kakao.maps.Marker({map,position:LL(p),draggable:true,image:img,zIndex:7});
      kakao.maps.event.addListener(m,'dragstart',()=>snap());
      kakao.maps.event.addListener(m,'dragend',()=>{const q=m.getPosition();D.zone[i]=[r6(q.getLat()),r6(q.getLng())];saveD();drawAll();});vtx.push(m);});}
  D.items.forEach(drawItem);
}

/* ---------- gestures ---------- */
const mapEl=()=>$('map');
const evPt=e=>{const r=mapEl().getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
const toLLpx=([x,y])=>map.getProjection().coordsFromContainerPoint(new kakao.maps.Point(x,y));
const toPx=p=>{const q=map.getProjection().containerPointFromCoords(LL(p));return[q.x,q.y];};
function segDist(P,A,B){const dx=B[0]-A[0],dy=B[1]-A[1],l=dx*dx+dy*dy||1;let u=((P[0]-A[0])*dx+(P[1]-A[1])*dy)/l;u=Math.max(0,Math.min(1,u));return Math.hypot(P[0]-A[0]-u*dx,P[1]-A[1]-u*dy);}
function findArrowAt(P){let best=null,bd=18;
  D.items.forEach(a=>{if(a.k!=='arrow')return;const A=toPx(a.a),B=toPx(a.b),d=segDist(P,A,B)-(a.w||5)/2;if(d<bd){bd=d;
    const part=Math.hypot(P[0]-B[0],P[1]-B[1])<28?'b':Math.hypot(P[0]-A[0],P[1]-A[1])<28?'a':'all';best={obj:a,part};}});return best;}
function initGestures(){
  const EL=mapEl();let st=null,pinch=null;
  function down(e){
    if(!map||e.button>0||!e.isPrimary)return;
    if(e.target.closest&&e.target.closest('.pop'))return;
    const P=evPt(e);
    if(!editing){ // normal mode: press & hold a house = open it
      st={kind:'house',x:P[0],y:P[1],timer:setTimeout(()=>{st=null;pressHouse(toLLpx(P));tapBlock=Date.now();if(navigator.vibrate)try{navigator.vibrate(20)}catch(e){}},500)};return;}
    if(tool==='zone'||tool==='arrow')return;
    const el=e.target.closest&&e.target.closest('.shp');let hit=null;
    if(el&&elOf.has(el))hit={obj:elOf.get(el),el};
    else{const a=findArrowAt(P);if(a)hit={obj:a.obj,part:a.part};}
    if(!hit)return;
    st={...hit,x:P[0],y:P[1],dragging:false};
    if(sel===hit.obj)start();else st.timer=setTimeout(start,400);
  }
  function start(){
    if(!st)return;if(tool)setTool(null);if(sel!==st.obj)select(st.obj);
    snap();st.dragging=true;map.setDraggable(false);EL.classList.add('dragging');
    if(navigator.vibrate)try{navigator.vibrate(20)}catch(e){}
    const o=st.obj;
    if(o.k==='shape'){st.P0=toPx(o.p);const ov=ovOf.get(o.id);st.el=ov&&ov.getContent?ov.getContent():document.querySelector('.shp.sel');if(st.el)st.el.classList.add('lift');}
    else{st.A=toPx(o.a);st.B=toPx(o.b);}
  }
  function move(e){
    if(!st||pinch)return;const P=evPt(e);
    if(!st.dragging){if(Math.hypot(P[0]-st.x,P[1]-st.y)>8){clearTimeout(st.timer);st=null;}return;}
    e.preventDefault();e.stopPropagation();
    const dx=P[0]-st.x,dy=P[1]-st.y,o=st.obj,mv=S=>{const ll=toLLpx([S[0]+dx,S[1]+dy]);return[r6(ll.getLat()),r6(ll.getLng())];};
    if(o.k==='shape'){o.p=mv(st.P0);const ov=ovOf.get(o.id);if(ov)ov.setPosition(LL(o.p));}
    else{if(st.part!=='b')o.a=mv(st.A);if(st.part!=='a')o.b=mv(st.B);drawItem(o);}
  }
  function up(){
    if(!st)return;clearTimeout(st.timer);
    if(st.dragging){tapBlock=Date.now();map.setDraggable(true);EL.classList.remove('dragging');if(st.el)st.el.classList.remove('lift');saveD();}
    st=null;
  }
  function tstart(e){
    if(e.touches.length>1&&st&&!st.dragging){clearTimeout(st.timer);st=null;}
    if(!editing||!sel||e.touches.length!==2)return;
    if(st){if(st.dragging){map.setDraggable(true);EL.classList.remove('dragging');}st=null;}
    const [a,b]=e.touches;snap();
    pinch={d0:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)||1,v0:sel.k==='shape'?(sel.s||1):(sel.w||5)};
    e.preventDefault();e.stopPropagation();
  }
  function tmove(e){
    if(pinch&&e.touches.length===2){e.preventDefault();e.stopPropagation();
      const [a,b]=e.touches;resizeSel(pinch.v0*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/pinch.d0);return;}
    if(st&&st.dragging){e.preventDefault();e.stopPropagation();}
  }
  function tend(e){if(pinch&&e.touches.length<2){pinch=null;tapBlock=Date.now();saveD();}}
  EL.addEventListener('pointerdown',down,true);
  window.addEventListener('pointermove',move,{capture:true,passive:false});
  window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',up,true);
  EL.addEventListener('touchstart',tstart,{capture:true,passive:false});
  EL.addEventListener('touchmove',tmove,{capture:true,passive:false});
  EL.addEventListener('touchend',tend,true);EL.addEventListener('touchcancel',tend,true);
  EL.addEventListener('mousemove',e=>{if(st&&st.dragging){e.preventDefault();e.stopPropagation();}},true);
  EL.addEventListener('wheel',e=>{if(!editing||!sel)return;e.preventDefault();e.stopPropagation();snap(true);
    const v=sel.k==='shape'?(sel.s||1):(sel.w||5);resizeSel(v*(e.deltaY<0?1.1:1/1.1));saveD();},{capture:true,passive:false});
  EL.addEventListener('contextmenu',e=>{if(st)e.preventDefault();});
}
function resizeSel(v){
  if(!sel)return;
  if(sel.k==='shape'){sel.s=+Math.max(.5,Math.min(4,v)).toFixed(2);const ov=ovOf.get(sel.id),el=ov&&ov.getContent?ov.getContent():document.querySelector('.shp.sel');if(el)el.style.fontSize=(14*sel.s*zf).toFixed(1)+'px';}
  else{sel.w=+Math.max(2,Math.min(30,v)).toFixed(1);drawItem(sel);}
}

/* ---------- static button wiring (DOM ready at load) ---------- */
$('bEdit').onclick=()=>setEditing(true);
$('closeBtn').onclick=()=>setEditing(false);
$('hUndo').onclick=()=>{if(!hist.length)return;fut.push(JSON.stringify(D));restore(hist.pop());updHist();};
$('hRedo').onclick=()=>{if(!fut.length)return;hist.push(JSON.stringify(D));restore(fut.pop());updHist();};
['tZone','tShape','tArrow','tFont','tColor'].forEach(id=>$(id).onclick=()=>{
  const k={tZone:'zone',tShape:'shape',tArrow:'arrow',tFont:'font',tColor:'color'}[id];
  if(k==='zone'){openPanel(null);setTool(tool==='zone'?null:'zone');return;}
  openPanel(panel===k?null:k);
});
$('txtCancel').onclick=closeText;
$('txtOk').onclick=()=>{if(!txtCtx)return;const {it,isNew}=txtCtx;snap();
  if(it.k==='arrow'){it.n1=$('n1').value.trim();it.n2=$('n2').value.trim();}else it.t=$('txtIn').value.replace(/\s+$/,'');
  if(isNew)D.items.push(it);saveD();closeText();drawAll();refreshUI();};
$('txtDel').onclick=()=>{if(!txtCtx)return;snap();D.items=D.items.filter(i=>i!==txtCtx.it);if(sel===txtCtx.it)select(null,true);saveD();closeText();drawAll();refreshUI();};
$('txtIn').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('txtOk').click();}});

$('bAcc').onclick=()=>showAcc(true);
$('accClose').onclick=()=>showAcc(false);
document.querySelectorAll('#langSeg button').forEach(b=>b.onclick=()=>setLang(b.dataset.l));
$('accExp').onclick=()=>{const blob=new Blob([JSON.stringify({app:'woni-map',at:Date.now(),notes,draw:D},null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='woni-map-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();msg(tr('exp_ok'),false,3000);};
$('accImp').onclick=()=>$('impFile').click();
$('impFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const j=JSON.parse(await f.text());if(j.app!=='woni-map')throw 0;
  if(j.notes){notes=j.notes;saveNotes();}D=Object.assign(D,j.draw||{});saveD();drawAll();if(curG)renderPop(curG);msg(tr('imp_ok'),false,3000);showAcc(false);}
  catch(err){msg(tr('imp_bad'),true,4000);}e.target.value='';};
$('accClear').onclick=function(){if(this.dataset.sure){snap();D.items=[];D.zone=[];saveD();drawAll();delete this.dataset.sure;this.textContent=tr('acc_clear');msg(tr('cleared'),false,4000);}
  else{this.dataset.sure=1;this.textContent=tr('sure_del');}};
$('accReset').onclick=function(){if(this.dataset.sure){delivered.clear();saveDone();closePop();drawPins();updateProgress();delete this.dataset.sure;this.textContent=tr('reset');msg(tr('cleared'),false,2500);showAcc(false);}
  else{this.dataset.sure=1;this.textContent=tr('sure_del');}};

/* ---------- integration hooks for app.js ---------- */
window.drawOnTap=function(ll){
  if(Date.now()-tapBlock<400)return true;
  if(!$('txtSheet').classList.contains('out-b')){$('txtCancel').click();return true;}
  if(!$('accSheet').classList.contains('out-b')){showAcc(false);return true;}
  if(editing){editTap(ll);return true;}
  return false;
};
window.drawApplyLang=function(){
  const T2=(id,k)=>{const e=$(id);if(e)e.textContent=tr(k);},Aa=(id,k,ti)=>{const e=$(id);if(!e)return;e.setAttribute('aria-label',tr(k));if(ti)e.title=tr(k);};
  T2('lAcc','acc');T2('lEdit','draw');Aa('closeBtn','close_edit');Aa('toolIsl','tools');
  Aa('tZone','t_zone',1);Aa('tShape','t_shape',1);Aa('tArrow','t_arrow',1);Aa('tFont','t_font',1);Aa('tColor','t_color',1);
  Aa('hUndo','undo',1);Aa('hRedo','redo',1);
  $('txtIn').placeholder=tr('text_ph');$('n1').placeholder=tr('from');Aa('n1','from');$('n2').placeholder=tr('to');Aa('n2','to');
  T2('txtDel','del');T2('txtCancel','cancel');T2('txtOk','ok');
  T2('accH','acc');T2('accP','acc_p');T2('accClear','acc_clear');T2('accImp','acc_imp');T2('accExp','acc_exp');T2('accReset','reset');T2('accClose','close');T2('langL','lang');
  T2('loginSoon','login_soon');$('loginEmp').placeholder=tr('login_emp');$('loginPhone').placeholder=tr('login_phone');$('loginPw').placeholder=tr('login_pw');T2('loginBtn','login');
  document.querySelectorAll('#langSeg button').forEach(b=>b.classList.toggle('on',b.dataset.l===LANG));
  if(D){refreshUI();if(panel)renderPanel();}
};
window.drawInit=function(){computeZf();initGestures();drawAll();updHist();
  kakao.maps.event.addListener(map,'zoom_changed',()=>{computeZf();drawAll();});};
updHist();
