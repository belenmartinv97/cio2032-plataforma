/* Capa de guardado: sustituye al espacio compartido del Artifact por Supabase.
   Solo usa dos funciones públicas protegidas (RPC); las tablas no son accesibles directamente. */
(function(){
  var C = window.CIO_CONFIG || {};
  var BASE = String(C.url||"").replace(/\/+$/,""), KEY = String(C.key||"");
  var ONLINE = !!(BASE && KEY);
  window.CIO_ONLINE = ONLINE;

  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function ssGet(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
  function ssSet(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} }
  function ssDel(k){ try{ sessionStorage.removeItem(k); }catch(e){} }
  function rand(n){
    var al="abcdefghjkmnpqrstuvwxyz23456789", a=new Uint8Array(n), s="";
    (window.crypto||window.msCrypto).getRandomValues(a);
    for(var i=0;i<n;i++) s+=al.charAt(a[i]%al.length);
    return s;
  }

  /* identificador personal: ?p=... en el enlace, o el guardado en este navegador, o uno nuevo */
  var TOKEN_RE=/^[A-Za-z0-9_-]{8,64}$/, token=null;
  try{ var q=new URLSearchParams(location.search).get("p"); if(q && TOKEN_RE.test(q)){ var prev=lsGet("cio_tok"); if(prev && prev!==q){ try{ localStorage.removeItem("fcc.state.v1"); }catch(_){} } token=q; lsSet("cio_tok",q); } }catch(e){}
  if(!token){ var st=lsGet("cio_tok"); if(st && TOKEN_RE.test(st)) token=st; }
  if(!token){ token=rand(16); lsSet("cio_tok",token); }
  window.CIO_LINK = location.origin + location.pathname + "?p=" + token;

  function rpc(name, body){
    var ctl = ("AbortController" in window)? new AbortController() : null, to=setTimeout(function(){ if(ctl) ctl.abort(); }, 15000);
    return fetch(BASE+"/rest/v1/rpc/"+name, {method:"POST", headers:{"apikey":KEY,"Content-Type":"application/json"}, body:JSON.stringify(body), signal: ctl? ctl.signal : undefined})
      .then(function(r){
        clearTimeout(to);
        if(!r.ok){ var e={code: (r.status===401||r.status===403)? "not_granted" : (r.status===400? "invalid_argument":"unavailable"), status:r.status}; throw e; }
        return r.text().then(function(t){ return t? JSON.parse(t) : null; });
      }, function(){ clearTimeout(to); throw {code:"unavailable"}; });
  }

  var db = {
    doc:function(path){
      var id=String(path).split("/")[1];
      return {
        get:function(){ return rpc("get_response",{p_token:id}).then(function(d){ return {exists:d!=null, data:function(){ return d; }}; }); },
        set:function(data){ return rpc("save_response",{p_token:id, p_data:data}); }
      };
    },
    collection:function(){
      return { onSnapshot:function(ok, err){
        var stop=false, t=null;
        function tick(){
          rpc("admin_list",{p_key:ssGet("cio_admin")||""}).then(function(rows){
            if(stop) return;
            ok({docs:(rows||[]).map(function(r){ return {id:r.token, data:function(){ return r.data; }}; })});
            t=setTimeout(tick, 10000);
          }).catch(function(e){ stop=true; err(e); });
        }
        tick();
        return function(){ stop=true; clearTimeout(t); };
      } };
    }
  };

  var adminOK=false;
  var user = {
    id:function(){ return Promise.resolve(token); },
    can:function(){ return Promise.resolve(true); },
    canEdit:function(){ return Promise.resolve(adminOK); },
    isOwner:function(){ return adminOK; }
  };
  var downloads = {
    save:function(q){
      return new Promise(function(res, rej){
        try{
          var d=q.data, blob = (d instanceof Blob)? d : new Blob([d], {type:"text/plain;charset=utf-8"});
          var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=q.filename; a.style.display="none";
          document.body.appendChild(a); a.click();
          setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          res({status:"saved"});
        }catch(e){ rej({code:"unavailable"}); }
      });
    }
  };

  /* acceso de administración: abrir la página con ?admin e introducir la clave */
  function adminGate(){
    var wantsAdmin=false; try{ wantsAdmin = new URLSearchParams(location.search).has("admin"); }catch(e){}
    if(!ONLINE) return Promise.resolve();
    var k=ssGet("cio_admin");
    function check(key){ return rpc("admin_check",{p_key:key}).then(function(v){ return v===true; }).catch(function(){ return false; }); }
    if(k){ return check(k).then(function(ok){ adminOK=ok; if(!ok) ssDel("cio_admin"); if(!ok && wantsAdmin) return askKey(); }); }
    if(!wantsAdmin) return Promise.resolve();
    return askKey();
    function askKey(){
      return new Promise(function(done){
        var w=document.createElement("div");
        w.setAttribute("style","position:fixed;inset:0;z-index:99999;background:rgba(2,11,29,.92);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif");
        w.innerHTML='<form style="background:#10223a;color:#eef1f8;border:1px solid rgba(166,226,46,.5);border-radius:16px;padding:24px;max-width:380px;width:100%"><h2 style="margin:0 0 6px;font-size:1.2rem">Acceso del equipo</h2><p id="gm" style="margin:0 0 14px;color:#9aa6bd;font-size:.95rem">Introduce la clave de administración.</p><input id="gk" type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #2a3550;background:#0b1626;color:#fff;font-size:1rem"><div style="display:flex;gap:10px;margin-top:14px"><button type="submit" style="flex:1;padding:12px;border-radius:10px;border:0;background:#a6e22e;color:#020b1d;font-weight:700;font-size:1rem;cursor:pointer">Entrar</button><button type="button" id="gc" style="padding:12px 16px;border-radius:10px;border:1px solid #2a3550;background:none;color:#eef1f8;cursor:pointer">Cancelar</button></div></form>';
        document.body.appendChild(w);
        var f=w.querySelector("form"), inp=w.querySelector("#gk"), msg=w.querySelector("#gm");
        setTimeout(function(){ inp.focus(); },50);
        w.querySelector("#gc").onclick=function(){ w.remove(); done(); };
        f.onsubmit=function(e){ e.preventDefault(); var key=inp.value; if(!key) return;
          check(key).then(function(ok){
            if(ok){ ssSet("cio_admin",key); adminOK=true; try{ history.replaceState(null,"",location.pathname+location.hash); }catch(_){} w.remove(); done(); window.dispatchEvent(new Event("cio-admin")); }
            else { msg.textContent="Clave incorrecta."; msg.style.color="#ff8a80"; inp.value=""; inp.focus(); }
          });
        };
      });
    }
  }
  var gate=adminGate();

  if(!window.claude) window.claude={};
  window.claude.use=function(name){
    if(name==="downloads") return Promise.resolve(downloads);
    if(!ONLINE) return Promise.resolve(null);
    if(name==="db") return Promise.resolve(db);
    if(name==="user") return gate.then(function(){ return user; });
    return Promise.resolve(null);
  };
})();
