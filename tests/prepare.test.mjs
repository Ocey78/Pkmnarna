import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { ensureParser } from '../scripts/prepare.mjs';
const parser = await readFile(new URL('../vendor/acorn.cjs', import.meta.url));
const hash = createHash('sha256').update(parser).digest('hex');
async function temp(run) {
  const dir = await mkdtemp(join(tmpdir(), 'poke2d-parser-'));
  try { await run(join(dir, 'acorn.cjs')); }
  finally { await rm(dir, {recursive:true, force:true}); }
}
test('preparation preserves a verified local parser without network access', async () => {
  await temp(async target => {
    await writeFile(target, parser);
    await ensureParser({target, fetchImpl:() => { throw new Error('unexpected network'); }});
    assert.equal(createHash('sha256').update(await readFile(target)).digest('hex'), hash);
  });
});
test('preparation downloads the pinned parser and verifies exact bytes', async () => {
  await temp(async target => {
    await ensureParser({target, fetchImpl:async () => new Response(parser)});
    assert.equal(createHash('sha256').update(await readFile(target)).digest('hex'), hash);
  });
});
test('preparation rejects mismatched downloads and preserves an existing file', async () => {
  await temp(async target => {
    await writeFile(target, 'existing file');
    await assert.rejects(ensureParser({target, fetchImpl:async () => new Response('wrong bytes')}), /SHA-256/);
    assert.equal(await readFile(target, 'utf8'), 'existing file');
  });
});
