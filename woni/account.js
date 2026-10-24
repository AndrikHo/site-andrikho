/* ===== Account features: refresh parcels, parcel-colour settings, delivery history =====
   Loaded LAST (after i18n.js + buildings.js + parcels.js + app.js + draw.js).
   Imported only by index.html via <script src="account.js">.

   Reuses globals:
     i18n.js  -> $, esc, tr, T, LANG
     draw.js  -> show, COLORS, showAcc, hex2hsv, hsv2rgb, rgb2hex, window.drawApplyLang
     app.js   -> todayKST, window.getColors, window.setColor, window.getHistory,
                 window.refreshParcels, window.loggedIn
   Data (owned by app.js): colours persisted to woni-colors-v1 via setColor();
     history read from woni-history-v1 = [{id,date:'YYYY-MM-DD'(KST),at,road,dtl,payType,amount,total,instr}]. */

/* parcel categories -> i18n label key (DONE = delivered colour) */
const CATS=[['PP','pp'],['CC','cc'],['PART','part'],['CR','cr'],['ETC','etc'],['DONE','done']];
const DEF_COLORS={PP:'#2f9e44',CC:'#e03131',PART:'#f08c00',CR:'#1c7ed6',ETC:'#7048e8',DONE:'#9aa4ad'};
const pad2=n=>n<10?'0'+n:''+n;
const dkey=(y,m,d)=>y+'-'+pad2(m+1)+'-'+pad2(d);

/* ---------- colour settings ---------- */
function openColors(){show($('accSheet'),false,'b');renderColorList();show($('colorSheet'),true,'b');}
function closeColors(){show($('colorSheet'),false,'b');showAcc(true);}
function renderColorList(){
  const cols=window.getColors();
  $('colHint').textContent=tr('colors_hint');
  $('colList').innerHTML=CATS.map(([k,i])=>`<div class="colrow" data-k="${k}"><span class="cc" style="background:${cols[k]}"></span><span class="cn">${esc(tr(i))}</span><span class="chev">›</span></div>`).join('');
  $('colList').querySelectorAll('.colrow').forEach(r=>r.onclick=()=>openColorEditor(r.dataset.k));
}
function openColorEditor(key){
  $('colHint').textContent='';
  $('colList').innerHTML=`<div class="coledit">
    <div class="wheelBox"><canvas id="cwheel" width="200" height="200"></canvas><div class="knob" id="cknob"></div></div>
    <label class="row">${tr('bright')}<input type="range" id="cbright" min="0" max="100" value="100"></label>
    <div class="sws">${COLORS.map(c=>`<button class="sw" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
    <div class="hx" id="chx"></div>
    <div class="acts"><button id="creset">${tr('reset_color')}</button><button class="pri" id="cback">${tr('back')}</button></div>
  </div>`;
  colorWheelAcct(key);
  $('cback').onclick=renderColorList;
}
function colorWheelAcct(key){
  const cv=$('cwheel'),ctx=cv.getContext('2d'),R=100;
  let {h,s,v}=hex2hsv(window.getColors()[key]);
  const paint=()=>{const img=ctx.createImageData(200,200);
    for(let y=0;y<200;y++)for(let x=0;x<200;x++){const dx=x-R,dy=y-R,d=Math.hypot(dx,dy),i=(y*200+x)*4;if(d>R)continue;
      const[r,g,b]=hsv2rgb((Math.atan2(dy,dx)*180/Math.PI+360)%360,d/R,v);img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255;}
    ctx.putImageData(img,0,0);};
  const knob=()=>{const a=h*Math.PI/180;$('cknob').style.left=(100+Math.cos(a)*s*100)+'px';$('cknob').style.top=(100+Math.sin(a)*s*100)+'px';
    const hex=rgb2hex(hsv2rgb(h,s,v));$('cknob').style.background=hex;$('chx').textContent=hex.toUpperCase();};
  const apply=()=>{window.setColor(key,rgb2hex(hsv2rgb(h,s,v)));knob();};
  paint();knob();
  const pick=e=>{const r=cv.getBoundingClientRect(),dx=e.clientX-r.left-100,dy=e.clientY-r.top-100;
    h=(Math.atan2(dy,dx)*180/Math.PI+360)%360;s=Math.min(1,Math.hypot(dx,dy)/100);apply();};
  let down=false;
  cv.addEventListener('pointerdown',e=>{down=true;cv.setPointerCapture(e.pointerId);pick(e);});
  cv.addEventListener('pointermove',e=>{if(down)pick(e);});
  cv.addEventListener('pointerup',()=>down=false);cv.addEventListener('pointercancel',()=>down=false);
  $('cbright').value=Math.round(v*100);$('cbright').oninput=e=>{v=e.target.value/100;paint();apply();};
  $('colorSheet').querySelectorAll('.coledit .sw').forEach(b=>b.onclick=()=>{({h,s,v}=hex2hsv(b.dataset.c));$('cbright').value=Math.round(v*100);paint();apply();});
  $('creset').onclick=()=>{({h,s,v}=hex2hsv(DEF_COLORS[key]));$('cbright').value=Math.round(v*100);paint();apply();};
}

/* ---------- delivery history (calendar + day list + word search) ---------- */
let hY=0,hM=0,hSel=null,hQ='';
function openHistory(){
  const[y,m]=todayKST().split('-').map(Number);hY=y;hM=m-1;hSel=null;hQ='';
  show($('accSheet'),false,'b');renderHistory();show($('histSheet'),true,'b');
}
function closeHistory(){show($('histSheet'),false,'b');showAcc(true);}
function histListHtml(){
  if(!hSel)return `<div class="none">${tr('pick_day')}</div>`;
  let items=(window.getHistory()||[]).filter(e=>e.date===hSel);
  if(hQ){const q=hQ.toLowerCase();items=items.filter(e=>((e.road||'')+' '+(e.dtl||'')+' '+(e.instr||'')).toLowerCase().includes(q));}
  if(!items.length)return `<div class="none">${tr('no_deliv_day')}</div>`;
  items=items.slice().sort((a,b)=>a.at-b.at);
  const cols=window.getColors();
  return items.map(e=>{const tm=new Date(e.at).toLocaleTimeString(T.locale,{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'});
    const col=cols[e.payType]||'#888',lbl=(T.payL&&T.payL[e.payType])||e.payType;
    return `<div class="he"><div class="u">${esc(e.dtl||'')}<span class="pay" style="background:${col}">${esc(lbl)}</span></div><div class="tm">${esc(tm)}</div><div class="r">${esc(e.road||'')}${e.instr?' · '+esc(e.instr):''}</div></div>`;}).join('');
}
function renderHistory(){
  const body=$('histBody'),entries=window.getHistory()||[],counts={};
  entries.forEach(e=>{counts[e.date]=(counts[e.date]||0)+1;});
  const startDow=new Date(hY,hM,1).getDay(),days=new Date(hY,hM+1,0).getDate();
  const todayK=todayKST(),mlbl=new Date(hY,hM,1).toLocaleDateString(T.locale,{month:'long',year:'numeric'});
  const dow=[];for(let i=0;i<7;i++)dow.push(new Date(2023,0,1+i).toLocaleDateString(T.locale,{weekday:'short'}));
  let cells='';for(let i=0;i<startDow;i++)cells+='<button class="cell empty" disabled></button>';
  for(let d=1;d<=days;d++){const k=dkey(hY,hM,d),c=counts[k]||0;
    cells+=`<button class="cell${k===todayK?' today':''}${k===hSel?' sel':''}" data-d="${k}">${d}${c?`<span class="bdg">${c}</span>`:''}</button>`;}
  body.innerHTML=`${window.loggedIn?'':`<p class="histlock">${tr('history_locked')}</p>`}
    <div class="cal"><div class="calhead"><button id="hPrev" aria-label="${esc(tr('history_prev'))}">‹</button><div class="mlbl">${esc(mlbl)}</div><button id="hNext" aria-label="${esc(tr('history_next'))}">›</button></div>
      <div class="caldow">${dow.map(d=>`<span>${esc(d)}</span>`).join('')}</div>
      <div class="calgrid">${cells}</div></div>
    <input class="histsearch" id="hSearch" placeholder="${esc(tr('hist_search_ph'))}" value="${esc(hQ)}">
    <div class="histlist">${histListHtml()}</div>`;
  $('hPrev').onclick=()=>{if(--hM<0){hM=11;hY--;}renderHistory();};
  $('hNext').onclick=()=>{if(++hM>11){hM=0;hY++;}renderHistory();};
  body.querySelectorAll('.cell[data-d]').forEach(b=>b.onclick=()=>{hSel=hSel===b.dataset.d?null:b.dataset.d;renderHistory();});
  const si=$('hSearch');si.oninput=()=>{hQ=si.value;const el=body.querySelector('.histlist');if(el)el.innerHTML=histListHtml();};
}

/* ---------- wiring ---------- */
$('accRefresh').onclick=()=>{if(window.refreshParcels)window.refreshParcels();};
$('accColors').onclick=openColors;
$('accHistory').onclick=openHistory;
$('colClose').onclick=closeColors;
$('histClose').onclick=closeHistory;

/* extend language refresh with account labels (chain draw.js handler) */
const _drawLang=window.drawApplyLang;
window.drawApplyLang=function(){
  if(_drawLang)_drawLang();
  const t=(id,k)=>{const e=$(id);if(e)e.textContent=tr(k);};
  t('accRefresh','refresh_parcels');t('accColors','colors_title');t('accHistory','history');
  t('colH','colors_title');t('colClose','back');
  t('histH','history');t('histClose','back');
  if(!$('colorSheet').classList.contains('out-b'))renderColorList();
  if(!$('histSheet').classList.contains('out-b'))renderHistory();
};
