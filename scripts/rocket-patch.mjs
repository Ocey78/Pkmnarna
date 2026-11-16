/** Execute only the exact uploaded extension's adapters, never the upstream engine. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createHash} from 'node:crypto';
import acorn from '../vendor/acorn.cjs';
export const STOCK_HASH='06f753660f6405ce447fa04f9a53de87cf1a4e28108fed70bf7cee989ac905c7';
export function patchRocket(source,extensionDirectory){
 if(createHash('sha256').update(source).digest('hex')!==STOCK_HASH)throw Error('Unsupported stock engine fingerprint');
 const manifest=JSON.parse(fs.readFileSync(path.join(extensionDirectory,'manifest.json'),'utf8'));
 if(manifest.name!=='Rocket Menu'||manifest.version!=='1.9.56')throw Error('Expected uploaded Rocket Menu 1.9.56');
 const context=vm.createContext({console,TextEncoder,TextDecoder,URL,URLSearchParams,structuredClone,atob,btoa}, {codeGeneration:{strings:false,wasm:false}});
 for(const name of manifest.background.scripts){
  if(name==='background.js')continue; // Firefox's response interception is replaced by this build step.
  if(!/^[a-z0-9-]+\.js$/.test(name))throw Error('Unsafe extension script name');
  vm.runInContext(fs.readFileSync(path.join(extensionDirectory,name),'utf8'),context,{filename:name,timeout:5000});
 }
 context.stock=source;
 const result=vm.runInContext('patchModMenu(stock)',context,{timeout:30000});
 acorn.parse(result,{sourceType:'module',ecmaVersion:'latest'});
 if(!result.includes("data-arena-mod-build','1.9.56"))throw Error('Rocket build marker is missing');
 return result;
}
