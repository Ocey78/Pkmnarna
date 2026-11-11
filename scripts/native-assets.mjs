/** Asset paths assembled by the pinned native client. This reads AST data, never executes upstream code. */
import {readFileSync} from 'node:fs';
const roster=JSON.parse(readFileSync(new URL('../data/roster.json',import.meta.url),'utf8'));
export const GAME_HELPER='function ai(e){let t=e.replace(/^\\/+/,``);return`./`.endsWith(`/`)?`./${t}`:`.//${t}`}';
export const ROOT_HELPER='function oi(e){if(/^https?:\\/\\//.test(e))return e;let t=e.replace(/^\\/+/,``);return typeof window<`u`&&window.location?.origin?`${window.location.origin}/${t}`:`/${t}`}';
const ORIGIN='https://poke2darena.com';
const NAME=/^[a-zA-Z0-9_-]+$/;
function text(n){return n?.type==='Literal'?n.value:n?.type==='TemplateLiteral'&&!n.expressions.length?n.quasis[0].value.cooked:null;}
function visit(n,fn){if(!n?.type)return;fn(n);for(const v of Object.values(n)){if(Array.isArray(v))for(const x of v)visit(x,fn);else if(v?.type)visit(v,fn);}}
function properties(n){return n?.type==='ObjectExpression'?n.properties.filter(p=>p.type==='Property'&&!p.computed):[];}
function key(p){return p.key.type==='Identifier'?p.key.name:text(p.key);}
function fields(n){return new Map(properties(n).map(p=>[key(p),p.value]));}
export function nativeAssetReferences(tree,source,url){
 const refs=new Map();
 const add=(path,required=false)=>{if(!path.startsWith('/')||path.includes('..')||path.includes('\\'))return;const u=ORIGIN+path;refs.set(u,{url:u,kind:'asset',required:required||refs.get(u)?.required||false});};
 const path=new URL(url).pathname;
 if(/\/movementClips\.generated-[\w-]+\.js$/.test(path)){
  visit(tree,n=>{
   if(n.type!=='ObjectExpression')return;
   const props=fields(n),files=props.get('files'),clips=props.get('clips');
   if(files?.type!=='ArrayExpression'||clips?.type!=='CallExpression'||clips.callee?.object?.name!=='JSON'||clips.callee?.property?.name!=='parse')return;
   const data=text(clips.arguments[0]);if(typeof data!=='string')return;
   let records;try{records=JSON.parse(data);}catch{return;}
   const names=files.elements.map(text);
   for(const record of Object.values(records)){
    if(!Array.isArray(record)||!/^\d{4}(?:\/\d{4})*$/.test(record[0])||!Array.isArray(record[1]))continue;
    for(const clip of record[1]){
     if(!Array.isArray(clip))continue;const file=names[clip[0]];
     if(typeof file==='string'&&/^[A-Za-z]+-Anim\.png$/.test(file))add('/assets/movement/'+record[0]+'/'+file);
    }
   }
  });
  return [...refs.values()];
 }
 if(path!=='/play-online/assets/index-BBhViti1.js'||!source.includes(GAME_HELPER)||!source.includes(ROOT_HELPER))return [];
 const vars=new Map();
 for(const statement of tree.body){if(statement.type==='VariableDeclaration')for(const d of statement.declarations)if(d.id.type==='Identifier')vars.set(d.id.name,d.init);}
 const keys=(name)=>properties(vars.get(name)).map(key).filter(v=>typeof v==='string'&&NAME.test(v));
 for(const {id} of roster){if(!NAME.test(id))throw new Error('Unsafe roster asset ID');add('/assets/pokemon/'+id+'.gif',true);add('/assets/cries/'+id+'.mp3');add('/play-online/ui/hud/heads/'+id+'.png');}
 for(const name of keys('LM'))add('/play-online/vfx/pa2d/'+name+'.png');
 for(const [table,folder] of [['rK','open-m1'],['iK','open-m2'],['hK','open-m3'],['kK','open-m4'],['AK','open-m4']])for(const name of keys(table))add('/play-online/vfx/'+folder+'/'+name+'.png');
 const refined=new Set(keys('RU'));for(const name of refined)add('/play-online/vfx/refined-121/'+name+'.png');
 visit(vars.get('zU'),n=>{const name=text(n);if(typeof name==='string'&&NAME.test(name)&&!refined.has(name))add('/play-online/vfx/polished-20/'+name+'.png');});
 for(const name of ['meteorimpact','windimpact','blizzardimpact'])add('/play-online/vfx/'+(refined.has(name)?'refined-121':'polished-20')+'/'+name+'.png');
 visit(tree,n=>{
  if(n.type==='CallExpression'&&n.callee?.name==='QM'){const name=text(n.arguments[0]);if(typeof name==='string'&&NAME.test(name))add('/play-online/vfx/'+name+'/'+name+'_hit_burst.png');}
  if(n.type==='FunctionDeclaration'&&n.id?.name==='nb')visit(n.body,k=>{const file=text(k);if(typeof file==='string'&&/^[a-z0-9_-]+\.png$/.test(file))add('/play-online/ui/hud/'+file);});
 });
 return [...refs.values()];
}
export function nativeHelperEdits(tree,source,url,base){
 if(new URL(url).pathname!=='/play-online/assets/index-BBhViti1.js')return [];
 const edits=[];
 const b=JSON.stringify(base),game=JSON.stringify(base+'play-online/');
 for(const n of tree.body){
  if(n.type!=='FunctionDeclaration')continue;
  const exact=source.slice(n.start,n.end);
  if(exact===GAME_HELPER)edits.push({start:n.start,end:n.end,text:`function ai(e){if(/^(?:https?:)?\\/\\//.test(e))return e;let b=${b};if((b!=="/"&&e.startsWith(b))||e.startsWith(${game}))return e;return ${game}+e.replace(/^\\/+/,"").replace(/^play-online\\//,"")}`});
  if(exact===ROOT_HELPER)edits.push({start:n.start,end:n.end,text:`function oi(e){if(/^https?:\\/\\//.test(e))return e;let b=${b},p=e.startsWith(b)?e:b+e.replace(/^\\/+/ ,"");return new URL(p,window.location.origin).href}`});
 }
 return edits;
}
