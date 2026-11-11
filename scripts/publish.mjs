#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline/promises';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export function validRepoName(name){return typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(name);}
export function remoteMatches(remote,owner,name){
  const expected=(owner+'/'+name).toLowerCase();
  const ssh=String(remote).match(/^git@github\.com:([^?#]+)$/);
  if(ssh)return ssh[1].replace(/\.git$/,'').toLowerCase()===expected;
  try{
    const u=new URL(remote);
    return u.protocol==='https:'&&u.hostname==='github.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&
      u.pathname.replace(/^\//,'').replace(/\.git$/,'').toLowerCase()===expected;
  }catch{return false;}
}
export function sourcePaths(){return ['.github','.gitignore','README.md','PUBLISH.bat','package.json','scripts','patches','data','vendor','site','docs','tests'];}
function run(command,args,{capture=false,allowFailure=false,input}={}){
  const result=spawnSync(command,args,{cwd:ROOT,encoding:'utf8',shell:false,input,
    stdio:capture||input!==undefined?['pipe','pipe','pipe']:'inherit'});
  if(result.error){if(allowFailure)return {status:1,stdout:'',stderr:result.error.message};throw new Error('Could not run '+command+'. Install it and reopen your terminal.');}
  if(result.status!==0&&!allowFailure)throw new Error((capture?result.stderr:'')||command+' failed. No force push or reset was attempted.');
  return {status:result.status,stdout:result.stdout||'',stderr:result.stderr||''};
}
function get(command,args){return run(command,args,{capture:true}).stdout.trim();}
async function publish(){
  if(process.argv.includes('--help')||process.argv.includes('-h')){
    console.log('Usage: node scripts/publish.mjs [new-repo-name]\nDefault: poke2d-full-roster\nRequires Node 22+, Git, GitHub CLI. Creates a PUBLIC repository and enables public GitHub Pages after confirmation. No tokens are saved in project files.');return;
  }
  const name=process.argv[2]||'poke2d-full-roster';
  if(!validRepoName(name))throw new Error('Use a simple repository name, not a URL or owner/name.');
  if(Number(process.versions.node.split('.')[0])<22)throw new Error('Node.js 22 or newer is required.');
  run('git',['--version']);run('gh',['--version']);
  if(run('gh',['auth','status','--hostname','github.com'],{capture:true,allowFailure:true}).status!==0){
    run('gh',['auth','login','--hostname','github.com','--git-protocol','https','--web']);
  }
  const user=JSON.parse(get('gh',['api','user']));
  if(!user.login||!Number.isSafeInteger(user.id))throw new Error('Could not determine the authenticated GitHub user.');
  const full=user.login+'/'+name;
  console.log('\nThis publishes source tools to PUBLIC repository '+full+'.');
  console.log('The Pages build downloads/patches upstream assets. Publish those assets only with any required permission.');
  console.log('Real-server and iPhone compatibility are still unverified. The build stops on an unsupported game version.');
  const rl=createInterface({input:process.stdin,output:process.stdout});
  const answer=await rl.question('Continue with this public publish? [y/N] ');rl.close();
  if(!/^y(?:es)?$/i.test(answer.trim())){console.log('Cancelled. Nothing pushed.');return;}
  const top=run('git',['rev-parse','--show-toplevel'],{capture:true,allowFailure:true});
  if(top.status===0&&fs.realpathSync(top.stdout.trim())!==fs.realpathSync(ROOT))throw new Error('Extract into a separate directory outside any other Git repository.');
  if(top.status!==0)run('git',['init','-b','main']);
  if(get('git',['branch','--show-current'])!=='main')throw new Error('This publisher only uses main. Switch to main yourself after reviewing the repository.');
  const existing=run('git',['remote','get-url','origin'],{capture:true,allowFailure:true});
  if(existing.status===0&&!remoteMatches(existing.stdout.trim(),user.login,name))throw new Error('The existing origin belongs to a different repository. Refusing to change it.');
  const remoteExists=run('gh',['repo','view',full,'--json','nameWithOwner'],{capture:true,allowFailure:true}).status===0;
  if(remoteExists&&existing.status!==0)throw new Error('That repository already exists. Choose a new name, or clone the intended repository and review changes there.');
  if(!remoteExists&&existing.status===0)throw new Error('The configured remote is not accessible. Check GitHub permissions before retrying.');
  const allowed=sourcePaths();
  const staged=get('git',['diff','--cached','--name-only']).split(/\r?\n/).filter(Boolean);
  if(staged.some(file=>!allowed.some(p=>file===p||file.startsWith(p+'/'))))throw new Error('Unrelated files are already staged. Unstage them before publishing.');
  // Run core/source safety checks before uploading. The workflow also runs Python integration tests.
  run(process.execPath,['scripts/prepare.mjs']);
  const tests=fs.readdirSync(path.join(ROOT,'tests')).filter(p=>p.endsWith('.test.mjs')).map(p=>'tests/'+p);
  run(process.execPath,['--test',...tests]);
  if(run('git',['config','user.name'],{capture:true,allowFailure:true}).status!==0)run('git',['config','--local','user.name',user.login]);
  if(run('git',['config','user.email'],{capture:true,allowFailure:true}).status!==0)run('git',['config','--local','user.email',`${user.id}+${user.login}@users.noreply.github.com`]);
  run('git',['add','--',...allowed]);
  if(get('git',['diff','--cached','--name-only']))run('git',['commit','-m','Add full-roster Pages importer and launcher']);
  if(!remoteExists)run('gh',['repo','create',full,'--public','--source',ROOT,'--remote','origin']);
  run('gh',['auth','setup-git','--hostname','github.com']);
  run('git',['push','--set-upstream','origin','main']);
  const endpoint='repos/'+full+'/pages';
  const pagesExist=run('gh',['api',endpoint],{capture:true,allowFailure:true}).status===0;
  const enable=run('gh',['api',endpoint,'--method',pagesExist?'PUT':'POST','--input','-'],{
    input:JSON.stringify({build_type:'workflow'}),capture:true,allowFailure:true});
  if(enable.status!==0){
    console.log('Source pushed, but Pages setup was not confirmed. Open repository Settings > Pages > Source: GitHub Actions.');
    console.log('Repository: https://github.com/'+full);return;
  }
  // Dispatch after Pages is enabled; the initial push workflow may have started before setup.
  let dispatch;
  for(let attempt=0;attempt<3;attempt++){
    dispatch=run('gh',['workflow','run','publish.yml','--repo',full,'--ref','main'],{capture:true,allowFailure:true});
    if(dispatch.status===0)break;
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  console.log('\nSource push confirmed. A successful Pages deployment is not yet confirmed.');
  console.log('Workflow: https://github.com/'+full+'/actions');
  if(dispatch.status!==0)console.log('Run the Publish full-roster client workflow manually from Actions.');
  const host=user.login.toLowerCase()+'.github.io';
  console.log('Intended URL after a successful build: https://'+host+'/'+(name.toLowerCase()===host?'':name+'/'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  publish().catch(error=>{console.error('\nPublish stopped:',error.message);process.exitCode=1;});
}
