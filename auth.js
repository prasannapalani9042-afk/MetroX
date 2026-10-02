const $ = s => document.querySelector(s);
const VIEWS=['login','register','forgotChoose','forgotIdentify','forgotOtp','resetPass'];
const IDS={login:'loginForm',register:'registerForm',forgotChoose:'forgotChoose',forgotIdentify:'forgotIdentify',forgotOtp:'forgotOtp',resetPass:'resetPass'};
let forgotState={method:null,email:null,otp:null};

function showView(v){
  VIEWS.forEach(k=>{const el=document.getElementById(IDS[k]); if(el) el.classList.toggle('active',k===v);});
  const tabs=document.getElementById('authTabs');
  if(tabs) tabs.style.display=(v==='login'||v==='register')?'grid':'none';
  const loginTab=document.getElementById('tabLogin'), regTab=document.getElementById('tabRegister');
  if(loginTab) loginTab.classList.toggle('active',v==='login');
  if(regTab) regTab.classList.toggle('active',v==='register');
  const msg=document.getElementById('msg'); if(msg) msg.textContent='';
}

function togglePwd(id,btn){
  const i=document.getElementById(id); const show=i.type==='password';
  i.type=show?'text':'password'; btn.textContent=show?'🙈':'👁';
}

async function postJSON(url,data){
  const r=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const j=await r.json().catch(()=>({ok:false,error:'Server returned an invalid response.'}));
  if(!r.ok || !j.ok) throw new Error(j.error||'Request failed.');
  return j;
}

function saveSession(user){
  localStorage.setItem('metroSession',JSON.stringify({email:user.email,name:user.name,role:user.role||'user'}));
}

async function login(e){
  e.preventDefault();
  const email=$('#loginEmail').value.trim().toLowerCase();
  const password=$('#loginPassword').value;
  const msg=$('#msg');
  try{
    const data=await postJSON('/api/auth/login',{email,password});
    saveSession(data.user); location.href='index.html';
  }catch(err){msg.textContent=err.message;}
}

async function register(e){
  e.preventDefault();
  const name=$('#regName').value.trim(), email=$('#regEmail').value.trim().toLowerCase();
  const phone=$('#regPhone').value.trim(), password=$('#regPassword').value, confirm=$('#regConfirm').value;
  const msg=$('#msg');
  if(!name||!email||phone.length<10||password.length<4||password!==confirm){
    msg.textContent='Enter valid details. Password must be 4+ characters and match.'; return;
  }
  try{
    const data=await postJSON('/api/auth/register',{name,email,phone,password});
    saveSession(data.user); location.href='index.html';
  }catch(err){msg.textContent=err.message;}
}

function startForgot(method){
  forgotState={method,email:null,otp:null};
  $('#msg').textContent=''; $('#forgotIdentifier').value='';
  $('#forgotLabel').textContent=method==='sms'?'REGISTERED PHONE NUMBER':'REGISTERED EMAIL';
  $('#forgotIdentifier').placeholder=method==='sms'?'10-digit mobile number':'you@example.com';
  $('#identifySub').textContent=method==='sms'?'We will send a demo OTP to your registered phone.':'We will send a demo OTP to your registered email.';
  showView('forgotIdentify');
}

async function sendOtp(){
  const value=$('#forgotIdentifier').value.trim(); const msg=$('#msg');
  try{
    const data=await postJSON('/api/auth/request-otp',{method:forgotState.method,value});
    forgotState.email=data.email;
    forgotState.otp=data.demo_otp;
    $('#otpSentMsg').textContent=`Demo OTP sent via ${data.display}: ${data.demo_otp}`;
    $('#otpInput').value=''; msg.textContent=''; showView('forgotOtp');
  }catch(err){msg.textContent=err.message;}
}

function verifyOtp(){
  const val=$('#otpInput').value.trim(); const msg=$('#msg');
  if(val!==forgotState.otp){msg.textContent='Incorrect OTP. Please try again.';return;}
  msg.textContent=''; $('#newPass1').value=''; $('#newPass2').value=''; showView('resetPass');
}

async function resetPassword(){
  const p1=$('#newPass1').value, p2=$('#newPass2').value, msg=$('#msg');
  if(!p1||p1.length<4){msg.textContent='Password must be at least 4 characters.';return;}
  if(p1!==p2){msg.textContent='Passwords do not match.';return;}
  try{
    await postJSON('/api/auth/reset-password',{email:forgotState.email,otp:forgotState.otp,password:p1});
    $('#loginEmail').value=forgotState.email; $('#loginPassword').value=''; forgotState={method:null,email:null,otp:null}; showView('login');
  }catch(err){msg.textContent=err.message;}
}

document.addEventListener('DOMContentLoaded',()=>{
  $('#loginForm').onsubmit=login;
  $('#registerForm').onsubmit=register;
  fetch('/api/session',{credentials:'same-origin'}).then(r=>r.json()).then(s=>{if(s.authenticated) location.href='index.html';}).catch(()=>{});
});
