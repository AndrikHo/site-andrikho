/* ===== Core: map, delivery parcels, building popup (addresses + parcels + notes), search =====
   Loaded after i18n.js, buildings.js, parcels.js. draw.js (editor) loads after this. */
const KAKAO_KEY='53f83a531954055ca29efd3e8a0d1a45';
const DONE_KEY='woni-test-done-v1',NOTES_KEY='woni-notes-v1';
const REMOVED_KEY='woni-removed-v1',COLORS_KEY='woni-colors-v1',HIST_KEY='woni-history-v1';
const AREA_C=[35.20755,129.00615],AREA_R=1500;

/* parcel colours: editable in account, persisted to woni-colors-v1 */
const PAY_DEFAULT={PP:'#2f9e44',CC:'#e03131',PART:'#f08c00',CR:'#1c7ed6',ETC:'#7048e8'};
const DONE_DEFAULT='#9aa4ad';
let _savedColors=store.get(COLORS_KEY,{})||{};
let PAY_COLOR=Object.assign({},PAY_DEFAULT);
Object.keys(PAY_COLOR).forEach(k=>{if(/^#[0-9a-f]{6}$/i.test(_savedColors[k]))PAY_COLOR[k]=_savedColors[k]});
let DONE_COLOR=/^#[0-9a-f]{6}$/i.test(_savedColors.DONE)?_savedColors.DONE:DONE_DEFAULT;
const saveColors=()=>store.set(COLORS_KEY,{...PAY_COLOR,DONE:DONE_COLOR});
const PAY_PRIORITY=['CC','PART','CR','ETC','PP'];
const won=n=>Number(n).toLocaleString(T.locale);

let delivered=new Set(store.get(DONE_KEY,[]));
const saveDone=()=>store.set(DONE_KEY,[...delivered]);
let removed=new Set(store.get(REMOVED_KEY,[]));
const saveRemoved=()=>store.set(REMOVED_KEY,[...removed]);
let notes=store.get(NOTES_KEY,{});
const saveNotes=()=>store.set(NOTES_KEY,notes);

/* delivery history snapshots (woni-history-v1): logged on every deliver toggle */
let history=store.get(HIST_KEY,[]);
const saveHistory=()=>store.set(HIST_KEY,history);
const todayKST=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
function logDeliver(p,on){
  const d=todayKST(),i=history.findIndex(h=>h.id===p.id&&h.date===d);
  if(on){if(i<0){history.push({id:p.id,date:d,at:Date.now(),road:p.road||'',dtl:p.dtl||'',payType:p.payType,amount:p.amount||0,total:p.total||0,instr:p.instr||''});saveHistory();}}
  else if(i>=0){history.splice(i,1);saveHistory();}
}
window.getHistory=()=>history;
window.loggedIn=false;
/* colour accessors for the account colour panel */
window.getColors=()=>({...PAY_COLOR,DONE:DONE_COLOR});
window.setColor=(k,hex)=>{if(!/^#[0-9a-f]{6}$/i.test(hex))return;if(k==='DONE')DONE_COLOR=hex;else if(PAY_COLOR[k]!=null)PAY_COLOR[k]=hex;else return;saveColors();applyColorVars();drawPins();if(curG){highlight(curG);renderPop(curG)}};
function applyColorVars(){const s=document.documentElement.style;
  s.setProperty('--pp',PAY_COLOR.PP);s.setProperty('--cc',PAY_COLOR.CC);s.setProperty('--part',PAY_COLOR.PART);
  s.setProperty('--cr',PAY_COLOR.CR);s.setProperty('--etc',PAY_COLOR.ETC);s.setProperty('--done',DONE_COLOR);}

let map,geocoder;
const LL=p=>new kakao.maps.LatLng(p[0],p[1]);
let tapBlock=0;

/* ---------- buildings index ---------- */
const buildings=[];
function loadBuildings(){
  (window.VWORLD_BUILDINGS||[]).forEach(b=>{
    let a=90,c=180,d=-90,e=-180;
    b.path.forEach(([la,ln])=>{a=Math.min(a,la);c=Math.min(c,ln);d=Math.max(d,la);e=Math.max(e,ln)});
    buildings.push({path:b.path,bb:[a,c,d,e],rd:b.rd,no:b.no,fl:b.fl});
  });
}
function inPoly(lat,lng,path){let ins=false;for(let i=0,j=path.length-1;i<path.length;j=i++){const[yi,xi]=path[i],[yj,xj]=path[j];
  if((yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)ins=!ins}return ins}
function buildingAt(lat,lng){let best=null,area=1e9;
  for(const b of buildings){const[a,c,d,e]=b.bb;if(lat<a||lat>d||lng<c||lng>e)continue;
    if(inPoly(lat,lng,b.path)){const ar=(d-a)*(e-c);if(ar<area){area=ar;best=b}}}return best}
function centroid(path){
  // area-weighted polygon centroid (true geometric centre); path = [[lat,lng],...]
  let A=0,cx=0,cy=0;
  for(let i=0,n=path.length;i<n;i++){
    const[y0,x0]=path[i],[y1,x1]=path[(i+1)%n];
    const cr=x0*y1-x1*y0;A+=cr;cx+=(x0+x1)*cr;cy+=(y0+y1)*cr;
  }
  if(Math.abs(A)<1e-12){let la=0,ln=0;path.forEach(p=>{la+=p[0];ln+=p[1]});return[la/path.length,ln/path.length];}
  A*=0.5;return[cy/(6*A),cx/(6*A)];
}

/* ---------- parcel groups per building ---------- */
const groups=[];
function buildGroups(){
  groups.length=0;
  const byBld=new Map();
  (window.MOCK_PARCELS||[]).forEach(p=>{
    if(removed.has(p.id))return;
    const b=buildingAt(p.lat,p.lng);
    const key=b?(b.rd+'|'+b.no):('pt:'+p.lat.toFixed(5)+','+p.lng.toFixed(5));
    if(!byBld.has(key))byBld.set(key,{bld:b,parcels:[]});
    byBld.get(key).parcels.push(p);
  });
  for(const g of byBld.values()){
    g.at=g.bld?centroid(g.bld.path):[g.parcels[0].lat,g.parcels[0].lng];
    groups.push(g);
  }
}
/* reload parcel source, prune stale statuses/removals, rebuild pins.
   test build reuses the static MOCK_PARCELS; the Hanjin fetch will replace it here. */
function rebuildParcels(){
  const src=window.MOCK_PARCELS||[],rawIds=new Set(src.map(p=>p.id));
  [...removed].forEach(id=>{if(!rawIds.has(id))removed.delete(id)});saveRemoved();
  buildGroups();
  const live=new Set(src.filter(p=>!removed.has(p.id)).map(p=>p.id));
  [...delivered].forEach(id=>{if(!live.has(id))delivered.delete(id)});saveDone();
  drawPins();updateProgress();
}
window.refreshParcels=function(){closePop();rebuildParcels();msg(tr('refreshed'),false,2500);};
function groupFor(b){return groups.find(g=>g.bld===b)||{bld:b,parcels:[],at:centroid(b.path)}}
function keyOf(g){return g.bld?(g.bld.rd+'|'+g.bld.no):('pt:'+g.at[0].toFixed(5)+','+g.at[1].toFixed(5))}

/* ---------- pins + highlight ---------- */
let poly=null,pins=[],pop=null,curG=null;
function allDone(g){return g.parcels.length>0&&g.parcels.every(p=>delivered.has(p.id))}
function pinColor(g){
  if(allDone(g))return DONE_COLOR;
  const live=g.parcels.filter(p=>!delivered.has(p.id)).map(p=>p.payType);
  for(const t of PAY_PRIORITY)if(live.includes(t))return PAY_COLOR[t];
  return PAY_COLOR.PP;
}
function pinSVG(color,count){
  return `<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
    <circle cx="13" cy="13" r="11" fill="${color}" stroke="#fff" stroke-width="2.2"/>
    <text x="13" y="17.4" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">${count}</text>
  </svg>`;
}
function drawPins(){
  pins.forEach(o=>o.setMap(null));pins=[];
  groups.forEach(g=>{
    const el=document.createElement('div');
    el.className='pin'+(allDone(g)?' done':'');
    el.innerHTML=pinSVG(pinColor(g),g.parcels.length);
    el.onclick=ev=>{ev.stopPropagation();if(window.editing)return;openBuilding(g.bld)};
    const ov=new kakao.maps.CustomOverlay({map,position:LL(g.at),content:el,yAnchor:.5,xAnchor:.5,zIndex:5,clickable:true});
    ov.setMap(map);pins.push(ov);
  });
}
function highlight(g){
  if(poly){poly.setMap(null);poly=null}
  if(!g.bld)return;
  const done=allDone(g);
  poly=new kakao.maps.Polygon({map,path:g.bld.path.map(LL),strokeWeight:3,
    strokeColor:done?DONE_COLOR:'#2d8cf0',strokeOpacity:1,
    fillColor:done?DONE_COLOR:'#2d8cf0',fillOpacity:done?.18:.22,zIndex:4});
}
function updateProgress(){
  const live=(window.MOCK_PARCELS||[]).filter(p=>!removed.has(p.id));
  const total=live.length,done=live.filter(p=>delivered.has(p.id)).length;
  $('progBig').textContent=done+'/'+total;
  $('progSm').textContent=T.deliveredN;
}
function toggleOne(p){const on=!delivered.has(p.id);on?delivered.add(p.id):delivered.delete(p.id);logDeliver(p,on);saveDone();afterChange()}
function setAll(g,on){g.parcels.forEach(p=>{on?delivered.add(p.id):delivered.delete(p.id);logDeliver(p,on)});saveDone();afterChange()}
function deleteParcel(p){confirmAsk(tr('del_parcel_q'),tr('del'),true,()=>{
  const b=curG&&curG.bld;removed.add(p.id);saveRemoved();rebuildParcels();
  const g=b&&groups.find(x=>x.bld===b);if(g&&g.parcels.length)openBuilding(b);else closePop();
});}
function confirmAsk(text,okText,danger,onOk){
  $('cfTxt').textContent=text;const ok=$('cfOk');ok.textContent=okText||tr('ok');ok.className=danger?'pri danger':'pri';
  $('cfCancel').textContent=tr('cancel');
  const close=()=>{$('confirm').classList.add('out');document.body.classList.remove('modal')};
  ok.onclick=()=>{close();onOk&&onOk()};$('cfCancel').onclick=close;$('cfBack').onclick=close;
  $('confirm').classList.remove('out');document.body.classList.add('modal');
}
function afterChange(){drawPins();updateProgress();if(curG){highlight(curG);renderPop(curG)}}

/* ---------- popup ---------- */
function payBadge(p){const c=PAY_COLOR[p.payType],lbl=T.payL[p.payType];let cash='';
  if(p.payType==='CC')cash=`<span class="cash" style="color:${c}">${T.won}${won(p.amount)}</span>`;
  else if(p.payType==='PART')cash=`<span class="cash" style="color:${c}">${T.won}${won(p.amount)}/${won(p.total)}</span>`;
  return `<span class="pay" style="background:${c}">${lbl}</span>${cash}`;
}
function resolveAddr(g,cb){
  if(g.addr){cb();return;}
  const[lat,lng]=g.at;
  geocoder.coord2Address(lng,lat,(r,st)=>{
    if(st===kakao.maps.services.Status.OK&&r[0]){
      const ra=r[0].road_address,ad=r[0].address;
      g.addr={road:ra?short(ra.address_name):'',bld:(ra&&ra.building_name)||'',jibun:ad?short(ad.address_name):''};
    }else{g.addr={road:g.bld?short((g.bld.rd+' '+g.bld.no).trim()):'',bld:'',jibun:''}}
    cb();
  });
}
function openBuilding(b){
  if(!b){closePop();return;}
  const g=groupFor(b);curG=g;highlight(g);
  resolveAddr(g,()=>{renderPop(g);
    const pt=map.getProjection().containerPointFromCoords(LL(g.at));if(pt.y<340)map.panBy(0,pt.y-340);});
}
function onMapTap(ll){
  if($('sbar').classList.contains('open')){openSearch(false);return;}
  if(window.drawOnTap&&window.drawOnTap(ll))return; // editor handled it (sheets / edit mode)
  const b=buildingAt(ll.getLat(),ll.getLng());
  if(b)openBuilding(b);else closePop();
}
function notesBlock(g){
  const k=keyOf(g),list=(notes[k]&&notes[k].list)||[];
  const items=list.length?list.map((n,i)=>`<div class="note"><div class="t">${esc(n.t)}</div>
      <div class="d">${new Date(n.at).toLocaleString(T.locale,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      <button data-ndel="${i}" aria-label="${esc(T.note_del)}">✕</button></div>`).join(''):`<div class="nempty">${T.no_notes}</div>`;
  return `<div class="pnotes"><div class="ntitle">${T.notes_title}</div>
    <div class="nlist">${items}</div>
    <textarea class="nin" placeholder="${esc(T.note_ph)}"></textarea>
    <button class="nadd">${T.save}</button></div>`;
}
function renderPop(g){
  if(pop)pop.setMap(null);
  const a=g.addr||{road:'',bld:'',jibun:''},k=keyOf(g);
  const el=document.createElement('div');el.className='pop';
  const head=`<div class="phead">
      ${a.road?`<div class="rd"><span class="lbl n">도로명</span>${esc(a.road)}${a.bld?` <span class="bld">${esc(a.bld)}</span>`:''}</div>`:''}
      <div class="jb"><span class="lbl o">지번</span>${esc(a.jibun||T.noAddr)}</div>
    </div>`;
  let body;
  if(g.parcels.length){
    const rows=g.parcels.map((p,i)=>{
      const done=delivered.has(p.id),longIns=(p.instr||'').length>14;
      return `<div class="pc${done?' done':''}" data-i="${i}">
        <span class="dot" style="background:${done?'var(--done)':PAY_COLOR[p.payType]}"></span>
        <div class="mid"><div class="unit">${esc(p.dtl)} ${payBadge(p)}</div>
          ${p.instr?`<div class="ins${longIns?' clip':''}" data-ins>${esc(p.instr)}</div>${longIns?`<button class="exp" data-exp>${T.more}</button>`:''}`:''}
        </div>
        <div class="pcbtns">
          <button class="chk" data-chk aria-label="deliver">${done?'✓':'○'}</button>
          <button class="del1" data-del aria-label="${esc(T.del_parcel)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
        </div>
      </div>`;
    }).join('');
    const everyDone=allDone(g);
    body=`<div class="plist">${rows}</div>
      <div class="pfoot">${everyDone?`<button class="undo" data-undoall>${T.undoAll}</button>`:`<button class="all" data-all>${T.deliverAll}</button>`}</div>`;
  }else body=`<div class="pempty">${T.noParcels}</div>`;
  el.innerHTML=`<button class="x" aria-label="close">✕</button>${head}${body}${notesBlock(g)}`;
  ['click','mousedown','touchstart','touchend','wheel','pointerdown','dblclick'].forEach(ev=>el.addEventListener(ev,e=>e.stopPropagation()));
  el.querySelector('.x').onclick=closePop;
  el.querySelectorAll('.pc').forEach(row=>{
    const i=+row.dataset.i,p=g.parcels[i];
    row.querySelector('[data-chk]').onclick=()=>toggleOne(p);
    row.querySelector('[data-del]').onclick=()=>deleteParcel(p);
    const ex=row.querySelector('[data-exp]');
    if(ex)ex.onclick=()=>{const ins=row.querySelector('[data-ins]'),clip=ins.classList.toggle('clip');ex.textContent=clip?T.more:T.less};
  });
  const allBtn=el.querySelector('[data-all]');if(allBtn)allBtn.onclick=()=>setAll(g,true);
  const undoBtn=el.querySelector('[data-undoall]');if(undoBtn)undoBtn.onclick=()=>setAll(g,false);
  // notes
  el.querySelector('.nadd').onclick=()=>{const t=el.querySelector('.nin').value.trim();if(!t)return;
    notes[k]=notes[k]||{list:[]};notes[k].list.push({t,at:Date.now()});saveNotes();renderPop(g)};
  el.querySelectorAll('[data-ndel]').forEach(b=>b.onclick=()=>{notes[k].list.splice(+b.dataset.ndel,1);
    if(!notes[k].list.length)delete notes[k];saveNotes();renderPop(g)});
  pop=new kakao.maps.CustomOverlay({map,position:LL(g.at),content:el,yAnchor:1,zIndex:10,clickable:true});
  pop.setMap(map);pop.__g=g;
}
function closePop(){if(pop){pop.setMap(null);pop=null}if(poly){poly.setMap(null);poly=null}curG=null}

/* ---------- press & hold a house (normal mode) ---------- */
function pressHouse(ll){const b=buildingAt(ll.getLat(),ll.getLng());if(b)openBuilding(b)}

/* ---------- search (slides DOWN from the top) ---------- */
const sq=()=>$('sq'),sugg=()=>$('sugg');
function openSearch(on){
  $('sbar').classList.toggle('open',on);$('stab').setAttribute('aria-expanded',on);
  $('stab').classList.toggle('hide',on);
  if(on)setTimeout(()=>sq().focus(),200);else{sq().blur();sugg().innerHTML=''}
}
let sTimer,sSeq=0,sItems=[];
const inArea=(lat,lng,addr)=>{if(typeof D!=='undefined'&&D.zone&&D.zone.length>2)return inPoly(lat,lng,D.zone);
  const d=Math.hypot((lat-AREA_C[0])*111000,(lng-AREA_C[1])*91000);return d<=AREA_R&&(!addr||/구포|북구/.test(addr))};
function runSearch(){
  const q=sq().value.trim(),seq=++sSeq;if(!q){sugg().innerHTML='';sItems=[];return}
  if(!map)return;
  const out=[],seen=new Set(),push=it=>{const k=it.lat.toFixed(5)+','+it.lng.toFixed(5);if(seen.has(k))return;seen.add(k);out.push(it)};
  const ql=q.toLowerCase();
  // local notes first
  for(const key in notes){const g=groups.find(x=>keyOf(x)===key);const txt=notes[key].list.map(n=>n.t).join(' ');
    if(txt.toLowerCase().includes(ql)&&g)push({nm:(g.addr&&g.addr.road)||short((g.bld?g.bld.rd+' '+g.bld.no:'')),ad:txt.slice(0,40),lat:g.at[0],lng:g.at[1],noted:true})}
  const S=kakao.maps.services,loc=new kakao.maps.LatLng(AREA_C[0],AREA_C[1]);let left=2;
  const fin=()=>{if(--left||seq!==sSeq)return;sItems=out.slice(0,12);renderSugg()};
  geocoder.addressSearch('부산 북구 '+q,(r,st)=>{if(st===S.Status.OK)r.forEach(adr=>{const lat=+adr.y,lng=+adr.x;if(!inArea(lat,lng,adr.address_name))return;
      const ra=adr.road_address,ad=adr.address;push({nm:ra?short(ra.address_name)+(ra.building_name?' '+ra.building_name:''):short(adr.address_name),ad:ad?'지번 '+short(ad.address_name):'',lat,lng})});fin()},{size:10});
  new S.Places().keywordSearch(q,(r,st)=>{if(st===S.Status.OK)r.forEach(p=>{const lat=+p.y,lng=+p.x;if(!inArea(lat,lng,p.address_name))return;
      push({nm:p.place_name,ad:short(p.road_address_name||p.address_name),lat,lng})});fin()},{location:loc,radius:AREA_R,sort:S.SortBy.DISTANCE});
}
function renderSugg(){
  sugg().innerHTML=sItems.length?sItems.map((it,i)=>`<li data-i="${i}"><div class="nm">${esc(it.nm)}${it.noted?`<span class="tg">${T.tag_note}</span>`:''}</div>${it.ad?`<div class="ad">${esc(it.ad)}</div>`:''}</li>`).join(''):`<li class="none">${T.nothing}</li>`;
  sugg().querySelectorAll('li[data-i]').forEach(li=>li.onclick=()=>pick(sItems[+li.dataset.i]));
}
function pick(it){
  openSearch(false);if(window.editing&&window.setEditing)window.setEditing(false);
  const ll=new kakao.maps.LatLng(it.lat,it.lng);map.setLevel(2);map.setCenter(ll);pressHouse(ll);
}

/* ---------- language ---------- */
function applyLang(){
  document.documentElement.lang=LANG;document.title=T.h1;
  $('sq').placeholder=T.search_ph;$('stab').setAttribute('aria-label',T.search_open);
  if(window.drawApplyLang)window.drawApplyLang();
  updateProgress();
  if(curG)renderPop(curG);
}

/* ---------- boot ---------- */
function init(){
  applyColorVars();
  loadBuildings();buildGroups();
  map=new kakao.maps.Map($('map'),{center:new kakao.maps.LatLng(AREA_C[0],AREA_C[1]),level:3});
  geocoder=new kakao.maps.services.Geocoder();
  kakao.maps.event.addListener(map,'click',e=>onMapTap(e.latLng));
  const bnd=new kakao.maps.LatLngBounds();groups.forEach(g=>bnd.extend(LL(g.at)));
  if(groups.length)map.setBounds(bnd,90,90,90,90);
  drawPins();applyLang();
  if(window.drawInit)window.drawInit();
  msg(T.hello,false,5000);
  $('stab').onclick=()=>openSearch(true);
  $('sclose').onclick=()=>{$('sq').value='';openSearch(false)};
  $('sq').addEventListener('input',()=>{clearTimeout(sTimer);sTimer=setTimeout(runSearch,250)});
  $('sq').addEventListener('keydown',e=>{if(e.key==='Enter'&&sItems[0]){e.preventDefault();pick(sItems[0])}if(e.key==='Escape')openSearch(false)});
}

const sdk=document.createElement('script');
sdk.src='https://dapi.kakao.com/v2/maps/sdk.js?appkey='+KAKAO_KEY+'&libraries=services&autoload=false';
sdk.onload=()=>kakao.maps.load(init);
sdk.onerror=()=>msg(T.sdk_fail,true);
document.head.appendChild(sdk);
