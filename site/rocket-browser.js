// Lexically scoped WebExtension compatibility for the uploaded menu.js.
// It does not modify window.browser, grant server permissions or add any UI.
function rocketBrowserBridge(){
 const key='rocket-menu.web.preferences.v1',listeners=new Set(),messages=new Set();
 const read=()=>{try{const v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}};
 const announce=(old,next)=>{const changes={};for(const k of new Set([...Object.keys(old),...Object.keys(next)])){if(old[k]!==next[k])changes[k]={oldValue:old[k],newValue:next[k]}}if(Object.keys(changes).length)for(const fn of listeners)fn(changes,'local')};
 addEventListener('storage',e=>{if(e.key!==key)return;try{announce(JSON.parse(e.oldValue||'{}'),JSON.parse(e.newValue||'{}'))}catch{}});
 return Object.freeze({
  storage:{local:{
   async get(keys){const all=read();if(keys==null)return all;const names=typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys);return Object.fromEntries(names.filter(k=>Object.hasOwn(all,k)||typeof keys==='object'&&!Array.isArray(keys)).map(k=>[k,Object.hasOwn(all,k)?all[k]:keys[k]]))},
   async set(items){const old=read(),next={...old,...items};localStorage.setItem(key,JSON.stringify(next));announce(old,next)},
   async remove(keys){const old=read(),next={...old};for(const k of Array.isArray(keys)?keys:[keys])delete next[k];localStorage.setItem(key,JSON.stringify(next));announce(old,next)}
  },onChanged:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}},
  runtime:{id:'rocket-menu-self-hosted',onMessage:{addListener:fn=>messages.add(fn)},
   async sendMessage(message){
    if(message?.type==='arena-mod-load-issue')return '';
    if(message?.type==='arena-mod-repair-tab')return {repaired:false,reason:'prepatched-build-reload-manually'};
    for(const fn of messages){const answer=fn(message,{id:'rocket-menu-self-hosted'});if(answer!==undefined)return await answer}
    return undefined;
   }
  }
 });
}
