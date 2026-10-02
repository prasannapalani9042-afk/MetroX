/* MetroX backend bridge: keeps the original MetroX UI/logic while persisting user data in Flask + SQLite. */
(function(){
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;
  const synced = new Set(['metroFavs','metroHistory','metroAdminStations']);
  let bootstrapping = true;

  function api(method, url, body){
    try{
      fetch(url, {method, credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: body===undefined?undefined:JSON.stringify(body)}).catch(()=>{});
    }catch(e){}
  }

  function bootstrap(){
    try{
      const xhr = new XMLHttpRequest();
      xhr.open('GET','/api/bootstrap',false);
      xhr.send(null);
      if(xhr.status===200){
        const data=JSON.parse(xhr.responseText);
        Object.entries(data.storage||{}).forEach(([k,v])=>originalSet.call(localStorage,k,v));
        if(data.users) originalSet.call(localStorage,'metroUsers',JSON.stringify(data.users));
        if(data.session) originalSet.call(localStorage,'metroSession',JSON.stringify({email:data.session.email,name:data.session.name,role:data.session.role}));
      } else if(xhr.status===401 && !location.pathname.endsWith('auth.html')) {
        originalRemove.call(localStorage,'metroSession');
        location.href = location.pathname.includes('/admin/') ? '../auth.html' : 'auth.html';
      }
    }catch(e){
      // The page can still render if the backend is temporarily unavailable.
    }
  }

  bootstrap();
  bootstrapping=false;

  Storage.prototype.setItem=function(key,value){
    originalSet.call(this,key,value);
    if(this===localStorage && !bootstrapping && synced.has(key)) api('POST','/api/storage',{key,value});
  };
  Storage.prototype.removeItem=function(key){
    originalRemove.call(this,key);
    if(this===localStorage && !bootstrapping && synced.has(key)) api('DELETE','/api/storage/'+encodeURIComponent(key));
    if(this===localStorage && key==='metroSession' && !bootstrapping) api('POST','/api/auth/logout',{});
  };
  Storage.prototype.clear=function(){
    originalClear.call(this);
    if(this===localStorage && !bootstrapping) api('POST','/api/auth/logout',{});
  };
})();
