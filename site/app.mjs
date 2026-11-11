import {findPokemon,duelURL} from './roster.mjs';

const $=id=>document.getElementById(id);
const root=new URL('./',document.baseURI);
let roster=[], imported=false;
const pickers=new Map();
function disableLink(id,disabled,url){
  const a=$(id);a.setAttribute('aria-disabled',String(disabled));a.tabIndex=disabled?-1:0;
  if(disabled)a.removeAttribute('href');else a.href=url;
}
function update(){
  const player=$('player-species').value,cpu=$('cpu-species').value;
  let duel=null;
  try{duel=duelURL(root,player,cpu,roster);}catch{}
  disableLink('duel-link',!imported||!duel,duel);
  disableLink('menu-link',!imported,new URL('play-online/',root).href);
  $('join-invite').disabled=!imported;
}
function picker(prefix,initial){
  const search=$(prefix+'-search'),select=$(prefix+'-species');
  let rows=roster;
  function render(preferred){
    const old=preferred||select.value;rows=findPokemon(roster,search.value);
    const fragment=document.createDocumentFragment();
    for(const p of rows)fragment.append(new Option(p.name+' · #'+String(p.dex).padStart(4,'0'),p.id));
    if(!rows.length)fragment.append(new Option('No matches',''));
    select.replaceChildren(fragment);select.disabled=!rows.length;
    select.value=(rows.find(p=>p.id===old)||rows[0])?.id||'';
    $(prefix+'-count').textContent=rows.length.toLocaleString()+(rows.length===1?' matching entry':' matching entries');
    $(prefix+'-random').disabled=!rows.length;
    change();
  }
  function change(){
    const p=roster.find(p=>p.id===select.value);
    $(prefix+'-dex').textContent=p?'DEX '+String(p.dex).padStart(4,'0'):'—';update();
  }
  search.disabled=false;search.addEventListener('input',()=>render());select.addEventListener('change',change);
  $(prefix+'-random').onclick=()=>{if(rows.length){select.value=rows[Math.floor(Math.random()*rows.length)].id;change();}};
  render(initial);
  pickers.set(prefix,id=>{search.value='';render(id);});
}
for(const id of ['duel-link','menu-link'])$(id).addEventListener('click',event=>{
  if($(id).getAttribute('aria-disabled')==='true')event.preventDefault();
});
$('swap').onclick=()=>{
  const p=$('player-species').value,c=$('cpu-species').value;
  pickers.get('player')(c);pickers.get('cpu')(p);
};
$('invite-form').addEventListener('submit',event=>{
  event.preventDefault();$('invite-error').textContent='';
  if(!imported)return;
  try{
    const invite=new URL($('invite').value.trim());
    const target=new URL('play-online/',root);
    const official=invite.origin==='https://poke2darena.com'&&/^\/play-online\/?$/.test(invite.pathname);
    const self=invite.origin===target.origin&&invite.pathname.replace(/\/$/,'')===target.pathname.replace(/\/$/,'');
    if((!official&&!self)||invite.username||invite.password||(!invite.search&&!invite.hash))throw new Error('Paste the complete official /play-online/ invitation, including its room parameters.');
    target.search=invite.search;target.hash=invite.hash;location.assign(target.href);
  }catch(error){$('invite-error').textContent=error.message||'That invitation is not valid.';}
});
async function json(path){
  const response=await fetch(new URL(path,root),{cache:'no-cache'});
  if(!response.ok)throw new Error(path+' returned HTTP '+response.status);
  return response.json();
}
async function start(){
  const results=await Promise.allSettled([json('data/roster.json'),json('build-report.json')]);
  if(results[0].status==='fulfilled'&&Array.isArray(results[0].value)){
    roster=results[0].value;
    $('roster-total').textContent=roster.length.toLocaleString();
    $('mega-total').textContent=roster.filter(p=>/-mega(?:-|$)/i.test(p.name)).length.toLocaleString();
    picker('player','pikachu');picker('cpu','charizard');$('swap').disabled=false;
  }
  const report=results[1].status==='fulfilled'?results[1].value:null;
  imported=Boolean(report?.buildStatus==='imported'&&roster.length);
  if(imported){
    $('build-state').textContent='Imported client · official multiplayer unverified';
    $('build-state').dataset.state='imported';
    const date=new Date(report.builtAt);
    $('build-detail').textContent=(Number.isNaN(date.valueOf())?'Build date unavailable':date.toLocaleDateString())+' · '+report.staticResources+' static resources';
    $('report-link').hidden=false;
    const unresolved=report.missingOptionalResources?.length||0;
    if(unresolved)$('build-detail').textContent+=' · '+unresolved+' optional resources unresolved';
  }else{
    $('build-state').textContent='Build required';$('build-state').dataset.state='error';
    $('build-detail').textContent='Run the GitHub Pages workflow or npm run build. This source-only launcher does not contain the game.';
    if(!roster.length)$('build-detail').textContent+=' The roster file could not be loaded.';
  }
  update();
}
void start().catch(error=>{
  $('build-state').textContent='Launcher error';$('build-state').dataset.state='error';
  $('build-detail').textContent=error.message;imported=false;update();
});
