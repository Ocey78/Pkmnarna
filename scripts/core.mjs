import { createHash } from 'node:crypto';
import acorn from '../vendor/acorn.cjs';
import adapter from '../patches/roster.cjs';
import {nativeAssetReferences,nativeHelperEdits} from './native-assets.mjs';

export const UPSTREAM = 'https://poke2darena.com';
export const SUPPORTED_PATH = '/play-online/assets/index-BBhViti1.js';
export const SUPPORTED_HASHES = new Set([
  '06f753660f6405ce447fa04f9a53de87cf1a4e28108fed70bf7cee989ac905c7',
  '30c0c2133ffb10266a3feec6ca49543c7daf8468a17c2b87f41a35f5dab52afe'
]);
const GAME = UPSTREAM + '/play-online/';
const FILE = /\.(?:m?js|css|json|png|jpe?g|webp|svg|gif|ico|ogg|mp3|wav|m4a|woff2?|ttf|bin|wasm|atlas|xml|txt)(?:[?#][^\s]*)?$/i;

export function normalizeBase(value = '/') {
  const s = String(value).trim();
  if (s.includes('//') || /[?#%\\\s]/.test(s)) throw new Error('Invalid Pages base path.');
  const parts = s.split('/').filter(Boolean);
  if (parts.some(x => x === '.' || x === '..' || !/^[a-zA-Z0-9_.-]+$/.test(x))) {
    throw new Error('Invalid Pages base path.');
  }
  return '/' + (parts.length ? parts.join('/') + '/' : '');
}
export function validateKnownHash(url, hash) {
  const u = new URL(url);
  if (u.origin !== UPSTREAM || u.pathname !== SUPPORTED_PATH || !SUPPORTED_HASHES.has(hash)) {
    throw new Error(`Unsupported upstream game build: ${u.pathname}, SHA-256 ${hash}. `+
      'Deployment stopped. The supplied Firefox adapter must be updated/reviewed for these bytes; do not disable the check.');
  }
  return true;
}
export function patchRoster(source) { return adapter.patch(source); }
export function verifyAndPatch(bytes, url) {
  const data = Buffer.from(bytes);
  const hash = createHash('sha256').update(data).digest('hex');
  validateKnownHash(url, hash);
  const source = new TextDecoder('utf-8',{fatal:true}).decode(data);
  const patched = patchRoster(source);
  acorn.parse(patched,{sourceType:'module',ecmaVersion:'latest'});
  return {source:patched, hash};
}
function walk(tree, callback) {
  const queue = [{node:tree,parent:null,key:null}];
  while (queue.length) {
    const entry=queue.pop(); callback(entry.node,entry.parent,entry.key);
    for (const [key,value] of Object.entries(entry.node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) queue.push({node:child,parent:entry.node,key});
      } else if (value?.type) queue.push({node:value,parent:entry.node,key});
    }
  }
}
function text(node) {
  if (node?.type==='Literal' && typeof node.value==='string') return node.value;
  if (node?.type==='TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
  return null;
}
function isMetaURL(node) {
  return node?.type==='MemberExpression' && node.object?.type==='MetaProperty' &&
    node.object.meta?.name==='import' && (node.property.name==='url' || node.property.value==='url');
}
function analyze(source, url) {
  const tree=acorn.parse(source,{sourceType:'module',ecmaVersion:'latest',allowHashBang:true});
  const descriptors=new Map(), dynamics=[], external=new Set();
  function add(node, resolver, required=false) {
    const value=text(node);
    if (!value || value.length>2048 || /[\n\r\0]/.test(value)) return;
    let resolved;
    try { resolved=new URL(value,resolver); } catch {return;}
    if (!['https:','http:'].includes(resolved.protocol)) return;
    if (resolved.origin!==UPSTREAM) {external.add(resolved.href); return;}
    resolved.hash='';
    const old=descriptors.get(node.start);
    descriptors.set(node.start,{node,value,url:resolved.href,required:required||old?.required||false,
      kind:/\.(?:m?js|css)$/i.test(resolved.pathname)?'code':'asset'});
  }
  // Resolve import specifiers and module-relative URL resources before generic strings.
  walk(tree,(n)=>{
    if (['ImportDeclaration','ExportAllDeclaration','ExportNamedDeclaration'].includes(n.type) && n.source) add(n.source,url,true);
    if (n.type==='ImportExpression') {
      if (text(n.source)!==null) add(n.source,url,true);
      else dynamics.push(source.slice(n.start,Math.min(n.end,n.start+220)));
    }
    if (n.type==='NewExpression' && n.callee.type==='Identifier' && n.callee.name==='URL' && isMetaURL(n.arguments[1])) {
      if (text(n.arguments[0])!==null) add(n.arguments[0],url,true);
      else dynamics.push(source.slice(n.start,Math.min(n.end,n.start+220)));
    }
  });
  walk(tree,(n,parent,key)=>{
    // Do not turn dictionary keys, regexp contents, comments, or prose into URLs.
    if (key==='key' && parent?.type==='Property' && !parent.computed) return;
    if (descriptors.has(n.start)) return;
    const value=text(n);
    if (value!==null && value.length<2048 && !/[\n\r\0]/.test(value)) {
      if (/^(https?|wss?):\/\/[^\s]+$/.test(value)) {
        try {if(new URL(value).origin!==UPSTREAM) external.add(value);}catch{}
      }
      if (FILE.test(value) && !/^[\s{}<>]|[\s{}<>]$/.test(value) && !value.startsWith('data:')) {
        // Native movement/sprite files live at the origin root, unlike game UI resources.
        add(n,/^\/?assets\/(?:movement|pokemon|cries)\//.test(value)?UPSTREAM+'/':GAME,/\.m?js(?:[?#]|$)/.test(value));
      }
    }
    if(n.type==='TemplateLiteral' && n.expressions.length && n.quasis[0].value.cooked?.startsWith('/')) {
      dynamics.push(source.slice(n.start,Math.min(n.end,n.start+220)));
    }
  });
  return {tree,descriptors,dynamics,external};
}
export function scanJS(source,url) {
  const a=analyze(source,url), refs=new Map();
  for (const {url:ref,required,kind} of a.descriptors.values()) {
    const prev=refs.get(ref);
    refs.set(ref,{url:ref,required:required||prev?.required||false,kind});
  }
  for (const ref of nativeAssetReferences(a.tree,source,url)) refs.set(ref.url,ref);
  return {references:[...refs.values()],dynamic:[...new Set(a.dynamics)],external:[...a.external]};
}
export function rewriteJS(source,url,base,assets) {
  base=normalizeBase(base);
  const available=new Set(assets), a=analyze(source,url), edits=new Map();
  for (const d of a.descriptors.values()) {
    if (!available.has(d.url)) continue;
    const u=new URL(d.url);
    edits.set(d.node.start,{start:d.node.start,end:d.node.end,text:JSON.stringify(base+u.pathname.slice(1)+u.search)});
  }
  walk(a.tree,(n,parent,key)=>{
    if(key==='key' && parent?.type==='Property' && !parent.computed) return;
    if(n.type==='Literal' && typeof n.value==='string' && n.value.startsWith('/play-online/') && !edits.has(n.start)) {
      edits.set(n.start,{start:n.start,end:n.end,text:JSON.stringify(base+n.value.slice(1))});
    }
    if(n.type==='TemplateLiteral' && n.expressions.length) {
      const first=n.quasis[0];
      if(first.value.raw.startsWith('/play-online/')) edits.set(first.start,{start:first.start,end:first.end,text:base+first.value.raw.slice(1)});
    }
  });
  for (const edit of nativeHelperEdits(a.tree,source,url,base)) edits.set(edit.start,edit);
  const ordered=[...edits.values()].sort((a,b)=>a.start-b.start), parts=[];
  let cursor=0;
  for (const e of ordered) {
    if(e.start<cursor) throw new Error('Overlapping source edits.');
    parts.push(source.slice(cursor,e.start),e.text); cursor=e.end;
  }
  parts.push(source.slice(cursor));
  const output=parts.join('');
  acorn.parse(output,{sourceType:'module',ecmaVersion:'latest',allowHashBang:true});
  return output;
}
