import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {patchRocket} from '../scripts/rocket-patch.mjs';
const code=fs.readFileSync(new URL('../site/rocket-browser.js',import.meta.url),'utf8');
function bridge(){
 const values=new Map(),handlers=new Map();
 const context=vm.createContext({localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},addEventListener:(name,fn)=>handlers.set(name,fn)});
 vm.runInContext(code+';globalThis.bridge=rocketBrowserBridge();',context);
 return {api:context.bridge,values,handlers,context};
}
test('Rocket preferences persist without touching game saves or window.browser',async()=>{
 const {api,values,context}=bridge();values.set('poke2d-save','keep');
 const changes=[];api.storage.onChanged.addListener((data,area)=>changes.push([data,area]));
 await api.storage.local.set({god:false});
 assert.equal((await api.storage.local.get('god')).god,false);assert.equal(changes.length,1);
 assert.equal(values.get('poke2d-save'),'keep');assert.equal(context.browser,undefined);
 await api.storage.local.set({god:false});assert.equal(changes.length,1);
 await api.storage.local.remove('god');assert.equal(Object.keys(await api.storage.local.get(null)).length,0);
});
test('bridge handles defaults, broken preferences and no Firefox repair privileges',async()=>{
 const {api,values}=bridge();values.set('rocket-menu.web.preferences.v1','bad JSON');
 assert.equal((await api.storage.local.get({god:false})).god,false);
 assert.equal((await api.runtime.sendMessage({type:'arena-mod-repair-tab'})).repaired,false);
 assert.equal(await api.runtime.sendMessage({type:'arena-mod-load-issue'}),'');
});
test('root forwards the exact search and fragment without a selector page',()=>{
 const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 let target;const location={href:'https://example.test/Pkmnarna/?online=1#room=ABC&key=secret',search:'?online=1',hash:'#room=ABC&key=secret',replace:url=>target=url};
 vm.runInNewContext(script,{URL,location});
 assert.equal(target,'https://example.test/Pkmnarna/play-online/?online=1#room=ABC&key=secret');
 assert.ok(!html.includes('player-species'));
});
test('new pipeline refuses an unknown engine before loading the extension',()=>{
 assert.throws(()=>patchRocket('not a native engine','/not-read'),/fingerprint/);
});
