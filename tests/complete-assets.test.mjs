import test from 'node:test';
import assert from 'node:assert/strict';
import acorn from '../vendor/acorn.cjs';
import {nativeAssetReferences,GAME_HELPER,ROOT_HELPER} from '../scripts/native-assets.mjs';
const origin='https://poke2darena.com';
const entry=origin+'/play-online/assets/index-BBhViti1.js';
const inventory=source=>nativeAssetReferences(acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'}),source,entry);
const helpers=GAME_HELPER+ROOT_HELPER;
test('catalog expansion includes all music formats, result stings, menu icons, thunder sheets and credits',()=>{
 const s=helpers+';var si={menu:65,"redline-circuit":50,"battle-2":106},li=[`m4a`,`mp3`],cq={charge:{},pillar:{},web:{},light:{}},lq=cq,jQ={0:`quick`,1:`cpu`,2:`collection`};';
 const refs=inventory(s),urls=new Set(refs.map(r=>r.url));
 for(const name of ['menu','redline-circuit','battle-2','victory','defeat'])for(const ext of ['mp3','m4a'])assert(urls.has(origin+`/play-online/audio/bgm/${name}.${ext}`),`missing ${name}.${ext}`);
 for(const name of ['quick','cpu','collection'])assert(urls.has(origin+`/play-online/ui/menu/icons/menu_icon_${name}.png`));
 for(const name of ['charge','pillar','web','light'])assert(urls.has(origin+`/play-online/vfx/thunder-field/${name}.png`));
 assert(urls.has(origin+'/play-online/audio/bgm/CREDITS.md'));
 assert(urls.has(origin+'/play-online/audio/bgm/loops.json'));
});
test('fallback walking art covers every supplied dex independently of movement catalog coverage',()=>{
 const urls=new Set(inventory(helpers).map(x=>x.url));
 for(const dex of ['0001','0006','1000','1024'])assert(urls.has(origin+`/assets/movement/${dex}/Walk-Anim.png`));
});
test('alias cycles and unsafe catalog values never escape resource paths',()=>{
 const refs=inventory(helpers+';var cq=lq,lq=cq,jQ={0:`../secret`,1:`https://bad.example/x`,2:`online`},li=[`mp3`,`../private`],si={menu:65};');
 assert(refs.some(r=>r.url.endsWith('/menu_icon_online.png')));
 assert(!refs.some(r=>r.url.includes('../')||r.url.includes('bad.example')||r.url.endsWith('.private')));
});
