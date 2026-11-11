import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {scanJS,rewriteJS,SUPPORTED_PATH,UPSTREAM} from '../scripts/core.mjs';
const URL_MAIN=UPSTREAM+SUPPORTED_PATH;
const HELPERS='function ai(e){let t=e.replace(/^\\/+/,``);return`./`.endsWith(`/`)?`./${t}`:`.//${t}`}function oi(e){if(/^https?:\\/\\//.test(e))return e;let t=e.replace(/^\\/+/,``);return typeof window<`u`&&window.location?.origin?`${window.location.origin}/${t}`:`/${t}`}';
test('native resource helpers do not double-prefix rewritten game assets and keep root sprites local',()=>{
 const c={window:{location:{origin:'https://example.github.io'}},URL};vm.createContext(c);
 vm.runInContext(rewriteJS(HELPERS,URL_MAIN,'/Pkmnarna/',[]),c);
 assert.equal(c.ai('/Pkmnarna/play-online/fonts/test.ttf'),'/Pkmnarna/play-online/fonts/test.ttf');
 assert.equal(c.ai('vfx/ghost/ghost_hit_burst.png'),'/Pkmnarna/play-online/vfx/ghost/ghost_hit_burst.png');
 assert.equal(c.oi('assets/pokemon/charizardmegax.gif'),'https://example.github.io/Pkmnarna/assets/pokemon/charizardmegax.gif');
 assert.equal(c.oi('https://online.poke2darena.com/rooms'),'https://online.poke2darena.com/rooms');
});
test('native scan includes runtime-built roster GIFs, UI and VFX paths at their correct roots',()=>{
 const s=HELPERS+';var LM={psico:{},shadowball:{}},rK={"fire-core":{}},RU={acid:{size:32}},zU=new Set([`flamethrower`,`acid`]);QM(`ghost`);function nb(e){let t=e=>ai(`ui/hud/${e}`);t(`hp_bar_frame.png`)}';
 const refs=new Set(scanJS(s,URL_MAIN).references.map(r=>r.url));
 for(const path of ['/assets/pokemon/charizardmegax.gif','/assets/pokemon/gholdengo.gif','/play-online/ui/hud/hp_bar_frame.png','/play-online/vfx/pa2d/psico.png','/play-online/vfx/ghost/ghost_hit_burst.png','/play-online/vfx/open-m1/fire-core.png','/play-online/vfx/refined-121/acid.png','/play-online/vfx/polished-20/flamethrower.png'])assert.ok(refs.has(UPSTREAM+path),path);
});
test('generated movement tables are parsed as data without executing JavaScript',()=>{
 const source='var e={files:[`Walk-Anim.png`,`Idle-Anim.png`],clips:JSON.parse(`{"pikachu":["0025",[[0,32,32,2,[1,1],16,16],[1,32,32,2,[1,1],16,16]]],"bad":["../private",[[0]] ]}`)};throw Error("MUST NOT EXECUTE");export{e as default};';
 const refs=new Set(scanJS(source,UPSTREAM+'/play-online/assets/movementClips.generated-CxVZ_dLI.js').references.map(r=>r.url));
 assert.ok(refs.has(UPSTREAM+'/assets/movement/0025/Walk-Anim.png'));
 assert.ok(refs.has(UPSTREAM+'/assets/movement/0025/Idle-Anim.png'));
 assert.ok(![...refs].some(r=>r.includes('private')));
});
