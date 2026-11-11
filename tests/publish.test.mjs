import test from 'node:test';
import assert from 'node:assert/strict';
import {validRepoName,remoteMatches,sourcePaths} from '../scripts/publish.mjs';
test('publisher accepts a simple new repo name, never shell/path syntax',()=>{
  assert.equal(validRepoName('poke2d-full-roster'),true);
  for(const value of ['../x','owner/repo','; rm -rf /','--force','','a b'])assert.equal(validRepoName(value),false);
});
test('publisher only updates an origin matching the authenticated owner and chosen repo',()=>{
  assert.equal(remoteMatches('https://github.com/testuser/poke2d-full-roster.git','testuser','poke2d-full-roster'),true);
  assert.equal(remoteMatches('git@github.com:testuser/poke2d-full-roster.git','testuser','poke2d-full-roster'),true);
  assert.equal(remoteMatches('https://github.com/another/repo','testuser','poke2d-full-roster'),false);
  assert.equal(remoteMatches('https://github.com.evil.test/testuser/poke2d-full-roster','testuser','poke2d-full-roster'),false);
  assert.equal(remoteMatches('https://token@github.com/testuser/poke2d-full-roster','testuser','poke2d-full-roster'),false);
});
test('publisher stages source tools but not game imports, tokens, caches or arbitrary root files',()=>{
  const paths=sourcePaths();
  assert.ok(paths.includes('.github'));assert.ok(paths.includes('patches'));assert.ok(paths.includes('site'));
  for(const name of ['dist','.cache','.env','.git','.'])assert.equal(paths.includes(name),false);
});
