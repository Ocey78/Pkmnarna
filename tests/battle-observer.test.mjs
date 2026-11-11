import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const path=new URL('./battle-observer.js',import.meta.url);
const load=()=>{
 assert(fs.existsSync(path),'Native battle readiness observer is missing');
 let state={phase:'fight',tick:0,inputFrame:0,elapsedMs:0,remainingMs:90000,fighters:[]};
 let ready=false,accepts=false,intro='3';
 const scene={sys:{isActive:()=>true,settings:{key:'arena'}},get ready(){return ready;},world:{getState:()=>state,acceptsInput:()=>accepts,introLabel:()=>intro}};
 const ctx={__assetTestGame:{scene:{scenes:[scene]}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 return {ctx,setReady:()=>{ready=true;},setLive:()=>{ready=true;accepts=true;intro=null;},advance:()=>{state={...state,tick:12,inputFrame:12,elapsedMs:200,remainingMs:89800};}};
};
test('native world phase fight is not sufficient while assets or countdown gate remain',()=>{
 const o=load();assert.equal(o.ctx.__nativeBattleStarted(),false);
 o.setReady();assert.equal(o.ctx.__nativeBattleStarted(),false);
 o.setLive();assert.equal(o.ctx.__nativeBattleStarted(),false);
 o.advance();assert.equal(o.ctx.__nativeBattleStarted(),true);
});
test('read-only observer exposes native fighters and ticks without stepping simulation',()=>{
 const o=load();o.setLive();o.advance();const first=o.ctx.__readNativeBattle(),next=o.ctx.__readNativeBattle();
 assert.equal(first.tick,12);assert.equal(next.elapsedMs,200);assert.equal(first.scene,'arena');
 assert.equal(first.acceptsInput,true);assert.equal(first.intro,null);
});
