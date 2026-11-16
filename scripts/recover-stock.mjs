/** Invert ONLY the old cached hosting transforms. A final exact stock hash is mandatory. */
import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
import acorn from '../vendor/acorn.cjs';
import {GAME_HELPER,ROOT_HELPER} from './native-assets.mjs';
import {STOCK_HASH} from './rocket-patch.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const LEGACY_HASH='a7ec44eed74cdd99117c2eb76b90e92ae5039efce22f46cde0205b65af11f734';
function visit(n,fn){if(!n?.type)return;fn(n);for(const v of Object.values(n)){if(Array.isArray(v)){for(const c of v)visit(c,fn)}else if(v?.type)visit(v,fn)}}
export function recoverStock(source,base){
 if(sha(source)===STOCK_HASH)return source;
 const legacy=fs.readFileSync(new URL('../patches/roster.cjs',import.meta.url),'utf8');
 if(sha(legacy)!==LEGACY_HASH)throw Error('Legacy inverse adapter fingerprint changed');
 let replace=null;visit(acorn.parse(legacy,{ecmaVersion:'latest'}),n=>{if(n.type==='FunctionDeclaration'&&n.id.name==='replace')replace=n});
 if(!replace)throw Error('Legacy inverse adapter not recognized');
 const code=legacy.slice(0,replace.start)+'function replace(a,b){pairs.push([a,b]);}'+legacy.slice(replace.end);
 const context=vm.createContext({pairs:[]},{codeGeneration:{strings:false,wasm:false}});
 vm.runInContext(code,context,{timeout:1000});context.ArenaRosterAdapter.patch('');
 for(const [before,after] of context.pairs.reverse()){
  if(source.split(after).length!==2)throw Error('Cached client cannot be inverted safely');
  source=source.replace(after,before);
 }
 const tree=acorn.parse(source,{sourceType:'module',ecmaVersion:'latest'}),edits=[];
 for(const n of tree.body)if(n.type==='FunctionDeclaration'&&['ai','oi'].includes(n.id.name))edits.push({start:n.start,end:n.end,text:n.id.name==='ai'?GAME_HELPER:ROOT_HELPER});
 if(edits.length!==2)throw Error('Expected two cached path resolvers');
 for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
 source=source.replace('\n;window.dispatchEvent(new Event("roster-client-module-evaluated"));\n','');
 // The known minifier used template strings for these original asset literals.
 const escapedBase=base.replaceAll('.', '\\.');
 source=source.replace(new RegExp('"('+escapedBase+'[^"\\n]*)"','g'),(literal,p)=>{
  if(!p.startsWith(base))return literal;
  if(p.startsWith(base+'play-online/assets/movementClips'))return '`./'+p.split('/').at(-1)+'`';
  if(p.startsWith(base+'play-online/assets/pickTrim'))return '`'+p.split('/').at(-1)+'`';
  return '`'+p.replace(base+'play-online/','').replace(base,'')+'`';
 });
 source=source.replaceAll(base+'play-online/','/play-online/');
 if(sha(source)!==STOCK_HASH)throw Error('Restored engine fingerprint does not match the original; refusing to patch');
 return source;
}
