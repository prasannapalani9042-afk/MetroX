/* ================= MetroX core (data, logic, auth, shell) ================= */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ---- Metro data (real Chennai Metro Phase 1 topology, 40 base stations) ---- */
const LINES = {
  Blue: { color: "#19d9ff", stations: ["Wimco Nagar","Tiruvottiyur","Tiruvottiyur Theradi","Kaladipet","Tollgate","New Washermanpet",
    "Tondiarpet","Sir Theagaraya College","Washermanpet","Mannadi","High Court","Chennai Central","Government Estate","LIC",
    "Thousand Lights","AG-DMS","Teynampet","Nandanam","Saidapet","Little Mount","Guindy","Alandur","Nanganallur Road",
    "Meenambakkam","Airport"] },
  Green: { color: "#42e6a4", stations: ["Chennai Central","Egmore","Nehru Park","Kilpauk","Pachaiyappa's College","Shenoy Nagar",
    "Anna Nagar East","Anna Nagar Tower","Thirumangalam","Koyambedu","CMBT","Arumbakkam","Vadapalani","Ashok Nagar",
    "Ekkatuthangal","Alandur","St. Thomas Mount"] }
};
const HUBS = ["Chennai Central","Alandur"]; /* real interchange stations shared by both lines */

/* ---- Admin-added stations (from Admin Panel) are merged live into each line ---- */
function getAdminStations(){ return JSON.parse(localStorage.getItem('metroAdminStations')||'[]'); }
function saveAdminStations(a){ localStorage.setItem('metroAdminStations', JSON.stringify(a)); }
function lineStations(lineName){
  const extra = getAdminStations().filter(s=>s.line===lineName).map(s=>s.name);
  return [...LINES[lineName].stations, ...extra];
}
function allStations(){
  const base = {lat:13.0827,lng:80.2707};
  let l = [];
  Object.entries(LINES).forEach(([ln]) => {
    const stations = lineStations(ln);
    stations.forEach((s,i) => l.push({
      name: s, line: ln,
      lat: base.lat + (i*0.006-0.06) * (ln==="Blue"?1:-1),
      lng: base.lng + (i*0.007-0.06) * (ln==="Blue"?-1:1)
    }));
  });
  return l;
}
function uniqueNames(){ return [...new Set(allStations().map(s=>s.name))].sort(); }
function lineOf(name){ return allStations().filter(s=>s.name===name).map(s=>s.line); }
function isInterchange(name){ return lineOf(name).length>1; }

function findPath(from,to){
  if(from===to) return null;
  const fL=lineOf(from), tL=lineOf(to);
  const common=fL.filter(l=>tL.includes(l));
  if(common.length){
    const line=common[0], arr=lineStations(line);
    const i1=arr.indexOf(from), i2=arr.indexOf(to);
    const seg=i1<i2?arr.slice(i1,i2+1):arr.slice(i2,i1+1).reverse();
    return {segments:[{line,stations:seg}],interchange:false};
  }
  /* try every real interchange (Chennai Central, Alandur) and use whichever gives the shortest route */
  let best=null;
  fL.forEach(l1=>{
    tL.forEach(l2=>{
      HUBS.forEach(hub=>{
        if(!lineOf(hub).includes(l1) || !lineOf(hub).includes(l2)) return;
        const a1=lineStations(l1), a2=lineStations(l2);
        const i1=a1.indexOf(from), h1=a1.indexOf(hub);
        if(i1===-1||h1===-1) return;
        const seg1=i1<h1?a1.slice(i1,h1+1):a1.slice(h1,i1+1).reverse();
        const h2=a2.indexOf(hub), i2=a2.indexOf(to);
        if(h2===-1||i2===-1) return;
        const seg2=h2<i2?a2.slice(h2,i2+1):a2.slice(i2,h2+1).reverse();
        const path={segments:[{line:l1,stations:seg1},{line:l2,stations:seg2}],interchange:true};
        const total=path.segments.reduce((n,s)=>n+s.stations.length,0)-1;
        if(!best || total<best.total) best={path,total};
      });
    });
  });
  return best ? best.path : null;
}
function nodeCount(p){ return p.segments.reduce((n,s)=>n+s.stations.length,0)-(p.interchange?1:0); }
function stopCount(p){ return nodeCount(p)-1; }
function fareFor(stops){ return stops<=2?10:stops<=5?20:stops<=9?30:stops<=13?40:50; }
function timeFor(stops,ic){ return Math.round(stops*2.5+(ic?4:0)); }
function haversine(a,b){
  const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function renderPathHTML(path,total){
  let html=`<div style="margin:6px 0 12px;font-size:13px;color:var(--muted)">Total stations in this route: <b style="color:#fff">${total}</b></div>`;
  path.segments.forEach(seg=>{
    html+=`<div style="margin:10px 0 4px"><span class="badge" style="background:${LINES[seg.line].color}22;color:${LINES[seg.line].color}">${seg.line} Line</span></div>`;
    seg.stations.forEach(st=>{
      html+=`<div class="stationline"><span class="dot" style="background:${LINES[seg.line].color}"></span>${st}${isInterchange(st)?' <span style="color:var(--orange);font-size:11px">⇄ interchange</span>':''}</div>`;
    });
  });
  return html;
}

/* ---- Auth / session (localStorage demo). Users have a role: 'admin' or 'user' ---- */
function getUsers(){ try{return JSON.parse(localStorage.getItem('metroUsers')||'{}')}catch(e){return{}} }
function saveUsers(u){ localStorage.setItem('metroUsers', JSON.stringify(u)); }
function getSession(){ try{return JSON.parse(localStorage.getItem('metroSession')||'null')}catch(e){return null} }
function isAdmin(){ const u=getSession(); return !!(u && u.role==='admin'); }
function ensureLogin(){
  const inAdmin = location.pathname.includes('/admin/');
  if(location.pathname.endsWith('auth.html')) return;
  if(!getSession()) location.href = inAdmin ? '../auth.html' : 'auth.html';
}
function ensureAdmin(){
  ensureLogin();
  if(!isAdmin()){
    alert('Admin access only. Redirecting to your dashboard.');
    location.href='../index.html';
  }
}
function logout(){
  localStorage.removeItem('metroSession');
  location.href = location.pathname.includes('/admin/') ? '../auth.html' : 'auth.html';
}

/* ---- Favorites / history ---- */
function getFavs(){ return JSON.parse(localStorage.getItem('metroFavs')||'[]'); }
function isFav(n){ return getFavs().includes(n); }
function toggleFav(n){ let f=getFavs(); f=f.includes(n)?f.filter(x=>x!==n):[...f,n]; localStorage.setItem('metroFavs',JSON.stringify(f)); }
function getHistory(){ return JSON.parse(localStorage.getItem('metroHistory')||'[]'); }
function pushHistory(e){ let h=getHistory(); h.unshift(e); localStorage.setItem('metroHistory',JSON.stringify(h.slice(0,15))); }
function clearHistory(){ localStorage.removeItem('metroHistory'); }

/* ---- Page shell: sidebar / topbar / role-based nav (called on every app page) ---- */
function setupShell(){
  ensureLogin();
  let u = getSession() || {name:'User'};
  /* self-heal: if this session was created before roles existed (or role changed), refresh it from the users table */
  if(u.email){
    const latest = getUsers()[u.email];
    if(latest && u.role !== latest.role){
      u = {...u, role: latest.role};
      localStorage.setItem('metroSession', JSON.stringify(u));
    }
  }
  const name=$('#userName'), avatar=$('#avatar'), date=$('#date'), logoutBtn=$('#logout'), menu=$('#menu'), sidebar=$('#sidebar');
  if(name) name.textContent = u.name;
  if(avatar) avatar.textContent = (u.name||'U').trim().charAt(0).toUpperCase();
  if(date) date.textContent = new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short',year:'numeric'});
  if(logoutBtn) logoutBtn.onclick = logout;
  if(menu && sidebar) menu.onclick = () => sidebar.classList.toggle('open');
  const current = location.pathname.split('/').pop();
  $$('.nav a').forEach(a => { if(a.getAttribute('href').split('/').pop()===current) a.classList.add('active'); });
  /* Only admin accounts can see/use the Admin Panel link */
  if(!isAdmin()){
    $$('.nav a').forEach(a => { if(a.getAttribute('href').includes('admin-dashboard.html')) a.style.display='none'; });
  }
}
function toast(msg){
  const t=$('#toast'); if(!t){alert(msg);return;}
  t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500);
}
function togglePwd(id,btn){
  const i=document.getElementById(id); const show=i.type==='password';
  i.type = show?'text':'password'; btn.textContent = show?'🙈':'👁';
}
document.addEventListener('DOMContentLoaded', () => { if($('#sidebar')) setupShell(); });
/* ================= end MetroX core ================= */

/* ---- page-specific ---- */
let TRAINS=[];
function initTrains(){
  TRAINS=[];
  Object.entries(LINES).forEach(([ln,d])=>{
    [1,-1].forEach(dir=>TRAINS.push({line:ln,dir,pos:Math.floor(Math.random()*(lineStations(ln).length-1)),secLeft:Math.floor(Math.random()*90)+30}));
  });
}
function trainLabel(t){
  const arr=lineStations(t.line);
  const nextIdx=t.dir===1?Math.min(t.pos+1,arr.length-1):Math.max(t.pos-1,0);
  return {curr:arr[t.pos],next:arr[nextIdx],dest:t.dir===1?arr[arr.length-1]:arr[0]};
}
function renderLive(){
  const box=$('#liveList'); if(!box)return;
  box.innerHTML=TRAINS.map(t=>{
    const lab=trainLabel(t), col=LINES[t.line].color;
    const pct=Math.max(5,Math.min(100,Math.round((1-(t.secLeft/90))*100)));
    return `<div class="train-card">
      <div style="display:flex;justify-content:space-between"><span class="badge" style="background:${col}22;color:${col}">${t.line} Line</span>
      <span class="mini">To ${lab.dest}</span></div>
      <div style="margin-top:8px;font-size:13.5px">Between <b>${lab.curr}</b> → <b>${lab.next}</b></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${col}"></div></div>
      <div style="display:flex;justify-content:space-between"><span class="mini">Approaching ${lab.next}</span>
      <span style="color:var(--success);font-weight:700;font-size:12.5px">${t.secLeft}s <span class="blink"></span></span></div>
    </div>`;
  }).join('');
}
setInterval(()=>{
  TRAINS.forEach(t=>{
    t.secLeft--;
    if(t.secLeft<=0){
      const arr=lineStations(t.line);
      t.pos = t.dir===1? t.pos+1 : t.pos-1;
      if(t.pos>=arr.length-1){t.pos=arr.length-1;t.dir=-1;}
      if(t.pos<=0){t.pos=0;t.dir=1;}
      t.secLeft=Math.floor(Math.random()*60)+45;
    }
  });
  renderLive();
  renderTrack();
},1000);
function etaToStation(train, targetName){
  const arr=lineStations(train.line);
  const targetIdx=arr.indexOf(targetName);
  if(targetIdx===-1) return null;
  const avg=75; /* average seconds per inter-station hop, matches the 45-105s randomised range */
  const period=2*(arr.length-1);
  const virtual = train.dir===1 ? train.pos : period-train.pos;
  const candidates=[targetIdx, period-targetIdx].map(c=>((c%period)+period)%period);
  let bestHops=null;
  candidates.forEach(c=>{
    let diff=((c-virtual)%period+period)%period;
    if(diff===0) diff=period; /* train is just leaving this station now, so track its next full pass */
    if(bestHops===null||diff<bestHops) bestHops=diff;
  });
  const eta = bestHops<=1 ? train.secLeft : train.secLeft + (bestHops-1)*avg;
  return {eta, hops:bestHops};
}
function fmtEta(sec){
  const m=Math.floor(sec/60), s=sec%60;
  return m>0 ? `${m}m ${s}s` : `${s}s`;
}
function renderTrack(){
  const box=$('#trackResult'); if(!box) return;
  const name=$('#trackSearch').value.trim();
  if(!name){ box.innerHTML='<div class="empty">Type a station name above to see live arrivals.</div>'; return; }
  const lines=lineOf(name);
  if(!lines.length){ box.innerHTML='<div class="empty">Station not found. Pick one from the list.</div>'; return; }
  let html='';
  lines.forEach(ln=>{
    const col=LINES[ln].color;
    const arr=lineStations(ln);
    const trainsOnLine=TRAINS.filter(t=>t.line===ln);
    const results=trainsOnLine.map(t=>{
      const r=etaToStation(t, name);
      const dest=t.dir===1?arr[arr.length-1]:arr[0];
      return r ? {...r, dest} : null;
    }).filter(Boolean).sort((a,b)=>a.eta-b.eta);
    html+=`<div class="result-box" style="margin-top:${html?'12px':'0'}">
      <span class="badge" style="background:${col}22;color:${col}">${ln} Line</span>
      <div style="margin-top:10px">${results.map(r=>`
        <div class="stationline"><span class="dot" style="background:${col}"></span>Towards ${r.dest}
          <span style="margin-left:auto;color:var(--success);font-weight:700">${fmtEta(r.eta)} <span class="blink"></span></span></div>
      `).join('')}</div>
    </div>`;
  });
  box.innerHTML=html;
}
document.addEventListener('DOMContentLoaded',()=>{
  initTrains();
  renderLive();
  const dl=$('#trackStations');
  dl.innerHTML=uniqueNames().map(n=>`<option value="${n}">`).join('');
  $('#trackSearch').addEventListener('input',renderTrack);
  renderTrack();
});
