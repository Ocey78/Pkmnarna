// Combined with routing.mjs by the builder. No network requests occur until the original game makes them.
const config=globalThis.Poke2DHostConfig;
if(config) {
  const log=[];
  let codeLoaded=false, socketOpened=false, peerConnected=false;
  const originOf=value=>{try{return new URL(String(value),location.href).origin;}catch{return 'unknown origin';}};
  let refresh=()=>{};
  const record=message=>{
    log.push(new Date().toLocaleTimeString()+' '+String(message));
    if(log.length>80)log.shift();refresh();
  };
  const map=(value,kind='http')=>routeURL(value,location.href,config,kind);
  const originalFetch=globalThis.fetch.bind(globalThis);
  globalThis.fetch=function(input,init) {
    let actual=input;
    const before=input instanceof Request?input.url:String(input);
    const after=map(before);
    try {
      if(after!==new URL(before,location.href).href)actual=input instanceof Request?new Request(after,input):after;
    }catch(error){return Promise.reject(error);}
    return originalFetch(actual,init).then(response=>{
      if(!response.ok)record('HTTP '+response.status+' from '+originOf(after));
      return response;
    },error=>{record('Request failed to '+originOf(after)+'. Network/CORS failure is possible; see browser console.');throw error;});
  };
  const xhrOpen=XMLHttpRequest.prototype.open;
  const observedXHR=new WeakSet();
  const xhrDestinations=new WeakMap();
  XMLHttpRequest.prototype.open=function(method,url,...rest){
    const mapped=map(url);xhrDestinations.set(this,originOf(mapped));
    if(!observedXHR.has(this)) {
      observedXHR.add(this);
      this.addEventListener('error',()=>record('XHR failed to '+xhrDestinations.get(this)+'. Network/CORS failure is possible.'));
      this.addEventListener('load',()=>{if(this.status>=400)record('HTTP '+this.status+' from '+xhrDestinations.get(this));});
    }
    return xhrOpen.call(this,method,mapped,...rest);
  };
  const NativeWebSocket=globalThis.WebSocket;
  if(NativeWebSocket)globalThis.WebSocket=new Proxy(NativeWebSocket,{
    construct(Target,args,NewTarget){
      const mapped=map(args[0],'ws'), values=[mapped,...args.slice(1)];
      const socket=Reflect.construct(Target,values,NewTarget);
      socket.addEventListener('open',()=>{socketOpened=true;record('WebSocket transport opened to '+originOf(mapped)+'. Room/team acceptance is NOT proven.');});
      socket.addEventListener('error',()=>record('WebSocket failed to '+originOf(mapped)+'. The server may reject this host origin.'));
      socket.addEventListener('close',event=>record('WebSocket closed: '+event.code+' (reason and tokens omitted).'));
      return socket;
    }
  });
  const NativeEventSource=globalThis.EventSource;
  if(NativeEventSource)globalThis.EventSource=new Proxy(NativeEventSource,{
    construct(Target,args,NewTarget){return Reflect.construct(Target,[map(args[0]),...args.slice(1)],NewTarget);}
  });
  const NativeRTC=globalThis.RTCPeerConnection;
  if(NativeRTC)globalThis.RTCPeerConnection=new Proxy(NativeRTC,{
    construct(Target,args,NewTarget){
      const peer=Reflect.construct(Target,args,NewTarget);
      peer.addEventListener('connectionstatechange',()=>{
        if(peer.connectionState==='connected')peerConnected=true;
        record('Peer transport: '+peer.connectionState+'. Gameplay not validated.');
      });
      return peer;
    }
  });
  // Phaser and similar engines commonly create images and audio through DOM properties.
  for(const [Class,name] of [[globalThis.HTMLImageElement,'src'],[globalThis.HTMLMediaElement,'src'],
    [globalThis.HTMLSourceElement,'src'],[globalThis.HTMLScriptElement,'src'],[globalThis.HTMLLinkElement,'href']]) {
    if(!Class)continue;
    const d=Object.getOwnPropertyDescriptor(Class.prototype,name);
    if(d?.get&&d?.set&&d.configurable)Object.defineProperty(Class.prototype,name,{
      ...d,set(value){return d.set.call(this,map(value));}
    });
  }
  // Attribute-based image creation uses the same mapping, without touching links or forms.
  const setAttribute=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(name,value){
    if(String(name).toLowerCase()==='src'&&['IMG','AUDIO','VIDEO','SOURCE','SCRIPT'].includes(this.tagName))value=map(value);
    return setAttribute.call(this,name,value);
  };
  window.addEventListener('roster-client-module-evaluated',()=>{codeLoaded=true;record('Patched entry module evaluated. Assets, gameplay and online acceptance still require testing.');});
  window.addEventListener('error',event=>{
    // Avoid leaking query-string room tokens, request bodies, or arbitrary error messages.
    if(event.target instanceof HTMLImageElement)record('An image failed to load; a dynamic asset may be missing.');
    else if(event.target instanceof HTMLScriptElement)record('A script failed to load. Check asset/CORS errors in the console.');
    else if(event instanceof ErrorEvent)record('A JavaScript error occurred. Check the browser console.');
  },true);
  window.addEventListener('unhandledrejection',()=>record('An asynchronous operation failed. Check the browser console.'));
  function mount() {
    const host=document.createElement('aside');host.id='poke2d-host-tools';
    host.style.cssText='position:fixed;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));z-index:2147483647;';
    const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>
      :host{font:13px system-ui;color:#ecf5ff}*{box-sizing:border-box}
      nav{display:flex;justify-content:flex-end;gap:6px}button,a{font:inherit;color:#eaf5ff;background:#14263be8;border:1px solid #6b8bab;border-radius:16px;padding:7px 12px;text-decoration:none;cursor:pointer}
      section{width:min(360px,calc(100vw - 24px));margin-top:8px;padding:14px;background:#111f32f5;border:1px solid #48617e;border-radius:12px}section[hidden]{display:none}
      h2{font-size:16px;margin:0 0 10px}p{line-height:1.5}textarea{width:100%;height:180px;font:12px monospace;background:#07111e;color:#eaf5ff;border:1px solid #48617e;border-radius:6px;padding:8px}
    </style><nav><a id="back">Roster</a><button id="show" type="button">Connection</button></nav>
    <section hidden><h2>Self-hosted client status</h2><p id="state"></p><p>Official-server room and team validation is unchanged. An open transport does not prove a battle will work.</p><textarea readonly aria-label="Diagnostic report"></textarea><button id="copy" type="button">Copy report</button></section>`;
    const section=shadow.querySelector('section'),area=shadow.querySelector('textarea');
    shadow.querySelector('#back').href=new URL(config.base,location.origin).href;
    shadow.querySelector('#show').onclick=()=>{section.hidden=!section.hidden;};
    refresh=()=>{
      const state='Client code: '+(codeLoaded?'evaluated':'starting')+' · WebSocket: '+(socketOpened?'opened at least once':'not observed')+' · Peer: '+(peerConnected?'connected at least once':'not observed');
      shadow.querySelector('#state').textContent=state;
      area.value=state+'\nOfficial multiplayer: NOT VERIFIED\n\n'+log.join('\n');
    };
    shadow.querySelector('#copy').onclick=async()=>{
      try{await navigator.clipboard.writeText(area.value);shadow.querySelector('#copy').textContent='Copied';}
      catch{area.focus();area.select();shadow.querySelector('#copy').textContent='Select and copy the report';}
    };
    document.documentElement.append(host);refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  record('Official endpoints preserved. This page uses its real host origin; no CORS or Origin bypass.');
}
