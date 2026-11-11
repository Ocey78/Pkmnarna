// JSON stdin/stdout bridge used by the dependency-free Python importer.
import {verifyAndPatch,scanJS,rewriteJS} from './core.mjs';
let data='';for await(const part of process.stdin)data+=part;
try {
  const input=JSON.parse(data);let result;
  if(input.op==='patch')result=verifyAndPatch(Buffer.from(input.bytes,'base64'),input.url);
  else if(input.op==='scan')result=scanJS(input.source,input.url);
  else if(input.op==='rewrite')result={source:rewriteJS(input.source,input.url,input.base,input.assets)};
  else throw new Error('Unknown source operation.');
  process.stdout.write(JSON.stringify(result));
}catch(error){console.error(error.message);process.exitCode=1;}
