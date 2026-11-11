import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import acorn from '../vendor/acorn.cjs';
import {
  normalizeBase, validateKnownHash, verifyAndPatch, scanJS, rewriteJS,
  patchRoster, UPSTREAM, SUPPORTED_PATH, SUPPORTED_HASHES
} from '../scripts/core.mjs';
import { routeURL } from '../site/routing.mjs';
import { findPokemon, duelURL } from '../site/roster.mjs';

const roster = JSON.parse(fs.readFileSync(new URL('../data/roster.json', import.meta.url)));
const base = '/poke2d-full-roster/';
const moduleURL = UPSTREAM + '/play-online/assets/index-test.js';

function capturePatches() {
  let code = fs.readFileSync(new URL('../patches/roster.cjs', import.meta.url), 'utf8');
  const tree = acorn.parse(code, {ecmaVersion: 'latest'});
  const queue = [tree]; let target;
  while (queue.length) {
    const node = queue.pop();
    if (node.type === 'FunctionDeclaration' && node.id?.name === 'replace') target = node.body;
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) queue.push(...v.filter(x => x?.type));
      else if (v?.type) queue.push(v);
    }
  }
  code = code.slice(0, target.start) + '{patches.push({before:anchor,after:replacement});}' + code.slice(target.end);
  return JSON.parse(JSON.stringify(vm.runInNewContext('const patches=[];'+code+';module.exports.patch("");patches', {module:{exports:{}}})));
}

test('deployment bases are normalized and traversal is rejected', () => {
  assert.equal(normalizeBase('demo'), '/demo/');
  assert.equal(normalizeBase('/'), '/');
  assert.equal(normalizeBase('/a/b/'), '/a/b/');
  for (const value of ['../private', '/a/../b', '//evil.example/', '/x?q=1', '/a%2fb/']) {
    assert.throws(() => normalizeBase(value));
  }
});
test('only the supplied build path and exact hashes are accepted', () => {
  for (const hash of SUPPORTED_HASHES) assert.equal(validateKnownHash(UPSTREAM+SUPPORTED_PATH, hash), true);
  assert.throws(() => validateKnownHash(UPSTREAM+'/play-online/assets/new.js', [...SUPPORTED_HASHES][0]));
  assert.throws(() => validateKnownHash('https://other.example'+SUPPORTED_PATH, [...SUPPORTED_HASHES][0]));
  assert.throws(() => verifyAndPatch(Buffer.from('not the real game'), UPSTREAM+SUPPORTED_PATH), /Unsupported/);
});
test('all original uploaded patch anchors apply exactly; missing/duplicate anchors stop', () => {
  const patches = capturePatches();
  assert.ok(patches.length >= 20);
  const fixture = patches.map(x => x.before).join('\n');
  const output = patchRoster(fixture);
  for (const p of patches) assert.ok(output.includes(p.after), p.before);
  assert.throws(() => patchRoster(fixture+patches[0].before), /Unsupported/);
  assert.throws(() => patchRoster(fixture.replace(patches[0].before,'')), /Unsupported/);
});
test('module imports, import.meta resources and Vite chunk tables resolve correctly', () => {
  const js = `import x from './vendor-a.js';export {x} from '../shared.js';
    const chunks=['assets/lazy-a.js'];
    const icon=new URL('./icon.png',import.meta.url);
    const sprite='/play-online/sprites/pikachu.png';
    const other='https://other.example/x.png';
    const dynamic=\`/play-online/sprites/\${id}.png\`;
    import('./lazy-b.js');`;
  const result = scanJS(js, moduleURL);
  const refs = new Set(result.references.map(x => x.url));
  for (const url of ['/play-online/assets/vendor-a.js','/play-online/shared.js','/play-online/assets/lazy-a.js',
    '/play-online/assets/icon.png','/play-online/sprites/pikachu.png','/play-online/assets/lazy-b.js']) {
    assert.ok(refs.has(UPSTREAM+url), url);
  }
  assert.ok(result.dynamic.length);
  assert.ok(result.external.includes('https://other.example/x.png'));
});
test('AST rewrite relocates modules/assets without changing official endpoints or object keys', () => {
  const js=`import x from './vendor-a.js';
    const sprite='/play-online/sprites/pikachu.png';
    const ws='wss://battle.example/socket';
    const template=\`/play-online/sprites/\${id}.png\`;
    const labels={'/play-online/sprites/pikachu.png': 'key stays'};`;
  const mirrored = [UPSTREAM+'/play-online/assets/vendor-a.js',UPSTREAM+'/play-online/sprites/pikachu.png'];
  const output = rewriteJS(js, moduleURL, base, mirrored);
  acorn.parse(output,{sourceType:'module',ecmaVersion:'latest'});
  assert.ok(output.includes('/poke2d-full-roster/play-online/assets/vendor-a.js'));
  assert.ok(output.includes('wss://battle.example/socket'));
  assert.ok(output.includes('`/poke2d-full-roster/play-online/sprites/${id}.png`'));
  assert.ok(output.includes("{'/play-online/sprites/pikachu.png': 'key stays'}"));
});
test('all 1,066 supplied IDs remain exact, with Mega and dex search', () => {
  assert.equal(roster.length,1066);
  assert.equal(new Set(roster.map(r=>r.id)).size,1066);
  assert.ok(findPokemon(roster,'charizard mega x').some(x=>x.id==='charizardmegax'));
  assert.ok(findPokemon(roster,'#1000').some(x=>x.id==='gholdengo'));
  assert.equal(findPokemon(roster,'nonexistent pokemon').length,0);
  const url=duelURL('https://user.github.io'+base, 'gholdengo','charizardmegax',roster);
  assert.equal(new URL(url).pathname,base+'play-online/');
  assert.equal(new URL(url).searchParams.get('duel'),'gholdengo,charizardmegax');
  assert.throws(()=>duelURL('https://user.github.io'+base,'bogus','pikachu',roster));
});
const config={upstream:UPSTREAM,base,assets:['/play-online/assets/game.js','/play-online/data/roster.json']};
const page='https://user.github.io'+base+'play-online/';
test('mirrored resources stay local; APIs go upstream; explicit remote endpoints stay unchanged', () => {
  assert.equal(routeURL('assets/game.js',page,config), 'https://user.github.io'+base+'play-online/assets/game.js');
  assert.equal(routeURL('/api/rooms?public=1',page,config),UPSTREAM+'/api/rooms?public=1');
  assert.equal(routeURL(UPSTREAM+'/play-online/data/roster.json',page,config),'https://user.github.io'+base+'play-online/data/roster.json');
  assert.equal(routeURL('https://battle.example/api',page,config),'https://battle.example/api');
  assert.equal(routeURL('blob:https://user.github.io/id',page,config),'blob:https://user.github.io/id');
});
test('websocket remapping retains path/query and does not override explicit official hosts', () => {
  assert.equal(routeURL('wss://user.github.io'+base+'socket?room=abc',page,config,'ws'),'wss://poke2darena.com/socket?room=abc');
  assert.equal(routeURL('/socket',page,config,'ws'),'wss://poke2darena.com/socket');
  assert.equal(routeURL('wss://battle.example/socket',page,config,'ws'),'wss://battle.example/socket');
});
test('unmirrored dynamic assets fall back upstream rather than Github 404s', () => {
  assert.equal(routeURL('/play-online/sprites/mew.png',page,config),UPSTREAM+'/play-online/sprites/mew.png');
  assert.equal(routeURL(base+'play-online/sprites/mew.png',page,config),UPSTREAM+'/play-online/sprites/mew.png');
});
