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
const VIEWS=['login','register','forgotChoose','forgotIdentify','forgotOtp','resetPass'];
const IDS={login:'loginForm',register:'registerForm',forgotChoose:'forgotChoose',
  forgotIdentify:'forgotIdentify',forgotOtp:'forgotOtp',resetPass:'resetPass'};

function seedDemoUser(){
  const users=getUsers();
  if(!users['demo@metrox.com']){
    users['demo@metrox.com']={name:'Demo User',phone:'9999999999',pass:'metrox123',role:'user'};
  }
  if(!users['admin@metrox.com']){
    users['admin@metrox.com']={name:'Admin',phone:'8888888888',pass:'admin123',role:'admin'};
  }
  saveUsers(users);
}
seedDemoUser();

function showView(v){
  VIEWS.forEach(k=>{
    const el=document.getElementById(IDS[k]);
    if(el) el.classList.toggle('active', k===v);
  });
  const onTabs=(v==='login'||v==='register');
  document.getElementById('authTabs').style.display=onTabs?'grid':'none';
  document.getElementById('tabLogin').classList.toggle('active', v==='login');
  document.getElementById('tabRegister').classList.toggle('active', v==='register');
  document.getElementById('msg').textContent='';
}

document.getElementById('loginForm').onsubmit=e=>{
  e.preventDefault();
  const email=document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass=document.getElementById('loginPassword').value;
  const users=getUsers();
  const msg=document.getElementById('msg');
  if(!users[email]||users[email].pass!==pass){msg.textContent='Invalid email or password.';return;}
  localStorage.setItem('metroSession',JSON.stringify({email,name:users[email].name,role:users[email].role||'user'}));
  msg.textContent=''; location.href='index.html';
};

document.getElementById('registerForm').onsubmit=e=>{
  e.preventDefault();
  const name=document.getElementById('regName').value.trim();
  const email=document.getElementById('regEmail').value.trim().toLowerCase();
  const phone=document.getElementById('regPhone').value.trim();
  const pass=document.getElementById('regPassword').value;
  const confirm=document.getElementById('regConfirm').value;
  const msg=document.getElementById('msg');
  if(!name||!email||!phone||pass.length<4||pass!==confirm){
    msg.textContent='Enter valid details. Password must be 4+ characters and match.'; return;
  }
  const users=getUsers();
  if(users[email]){msg.textContent='An account already exists for this email. Please login instead.';return;}
  users[email]={name,phone,pass,role:'user'}; saveUsers(users);
  localStorage.setItem('metroSession',JSON.stringify({email,name,role:'user'}));
  msg.textContent=''; location.href='index.html';
};

/* ---- Forgot password: SMS or Email recovery (demo OTP, simulated) ---- */
let forgotState={method:null,email:null,otp:null};
function startForgot(method){
  forgotState={method,email:null,otp:null};
  document.getElementById('msg').textContent='';
  document.getElementById('forgotIdentifier').value='';
  document.getElementById('forgotLabel').textContent = method==='sms' ? 'REGISTERED PHONE NUMBER' : 'REGISTERED EMAIL';
  document.getElementById('forgotIdentifier').placeholder = method==='sms' ? '10-digit mobile number' : 'you@example.com';
  document.getElementById('identifySub').textContent = method==='sms' ? 'We will send a demo OTP to your registered phone.' : 'We will send a demo OTP to your registered email.';
  showView('forgotIdentify');
}
function sendOtp(){
  const val=document.getElementById('forgotIdentifier').value.trim();
  const msg=document.getElementById('msg');
  const users=getUsers();
  let matchEmail=null;
  if(forgotState.method==='sms'){
    matchEmail=Object.keys(users).find(e=>users[e].phone===val);
    if(!matchEmail){msg.textContent='No account found with this phone number.';return;}
  }else{
    const email=val.toLowerCase();
    if(!users[email]){msg.textContent='No account found with this email.';return;}
    matchEmail=email;
  }
  forgotState.email=matchEmail;
  forgotState.otp=String(Math.floor(100000+Math.random()*900000));
  const via = forgotState.method==='sms' ? `SMS to ${users[matchEmail].phone}` : `email to ${matchEmail}`;
  document.getElementById('otpSentMsg').textContent=`Demo OTP sent via ${via}: ${forgotState.otp}`;
  document.getElementById('otpInput').value='';
  msg.textContent='';
  showView('forgotOtp');
}
function verifyOtp(){
  const val=document.getElementById('otpInput').value.trim();
  const msg=document.getElementById('msg');
  if(val!==forgotState.otp){msg.textContent='Incorrect OTP. Please try again.';return;}
  msg.textContent='';
  document.getElementById('newPass1').value='';
  document.getElementById('newPass2').value='';
  showView('resetPass');
}
function resetPassword(){
  const p1=document.getElementById('newPass1').value, p2=document.getElementById('newPass2').value;
  const msg=document.getElementById('msg');
  if(!p1||p1.length<4){msg.textContent='Password must be at least 4 characters.';return;}
  if(p1!==p2){msg.textContent='Passwords do not match.';return;}
  const users=getUsers();
  users[forgotState.email].pass=p1; saveUsers(users);
  document.getElementById('loginEmail').value=forgotState.email;
  document.getElementById('loginPassword').value='';
  forgotState={method:null,email:null,otp:null};
  showView('login');
}
