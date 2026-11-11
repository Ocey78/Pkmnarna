// Test-only observation: expose the native Phaser game without changing its rules.
import fs from 'node:fs';
import acorn from '../vendor/acorn.cjs';
const source=fs.readFileSync(process.argv[2],'utf8');
const tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});
const matches=[];
function walk(n){if(!n?.type)return;if(n.type==='NewExpression'&&n.callee?.type==='MemberExpression'&&n.callee.property?.name==='Game')matches.push(n);for(const v of Object.values(n)){if(Array.isArray(v))for(const x of v)walk(x);else if(v?.type)walk(v);}}
walk(tree);
if(matches.length!==1)throw Error('Expected exactly one native Phaser Game constructor, found '+matches.length);
const n=matches[0];
const output=source.slice(0,n.start)+'(globalThis.__assetTestGame='+source.slice(n.start,n.end)+')'+source.slice(n.end);
acorn.parse(output,{ecmaVersion:'latest',sourceType:'module'});
fs.writeFileSync(process.argv[3],output);
console.log('Native constructor exposed for observation only:',source.slice(n.callee.start,n.callee.end));
