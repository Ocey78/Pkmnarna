import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SHA256 = '6426dc483d1b40cea7c99d9e6bf889560557b1265b1d9d9bee2fb1360ea9bcc6';
const SOURCES = [
  'https://cdn.jsdelivr.net/npm/acorn@8.15.0/dist/acorn.js',
  'https://unpkg.com/acorn@8.15.0/dist/acorn.js'
];
const DEFAULT_TARGET = fileURLToPath(new URL('../vendor/acorn.cjs', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function ensureParser({target = DEFAULT_TARGET, fetchImpl = fetch} = {}) {
  try {
    if (digest(await readFile(target)) === SHA256) return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const failures = [];
  for (const url of SOURCES) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(20000), redirect: 'error'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > 1024 * 1024) {
        throw new Error('Parser download exceeded the size limit');
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 1024 * 1024) throw new Error('Parser download exceeded the size limit');
      if (digest(bytes) !== SHA256) throw new Error('Acorn 8.15.0 SHA-256 mismatch');
      await mkdir(dirname(target), {recursive:true});
      const temporary = `${target}.${process.pid}.tmp`;
      try {
        await writeFile(temporary, bytes, {flag:'wx'});
        await rename(temporary, target);
      } finally {
        await rm(temporary, {force:true});
      }
      return;
    } catch (error) {
      failures.push(`${new URL(url).hostname}: ${error.message}`);
    }
  }
  throw new Error('Unable to prepare the verified parser. ' + failures.join('; '));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  ensureParser().then(() => console.log('Acorn 8.15.0 verified.')).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
