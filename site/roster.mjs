const normalize=s=>String(s).normalize('NFKD').toLowerCase().replace(/\p{Mark}/gu,'').replace(/♀/g,'f').replace(/♂/g,'m');
export function findPokemon(roster,text) {
  const query=String(text).trim();
  if(!query)return roster;
  if(/^#?\s*\d+$/.test(query)){const dex=Number(query.replace(/^#?\s*/,''));return roster.filter(p=>p.dex===dex);}
  const words=normalize(query).match(/[a-z0-9]+/g)||[];
  if(!words.length)return [];
  const compact=words.join('');
  return roster.filter(p=>{
    const id=normalize(p.id).replace(/[^a-z0-9]/g,''),name=normalize(p.name).replace(/[^a-z0-9]/g,'');
    return id.includes(compact)||name.includes(compact)||words.every(w=>id.includes(w)||name.includes(w));
  }).sort((a,b)=>Number(b.id===compact)-Number(a.id===compact));
}
export function duelURL(root,player,cpu,roster) {
  const ids=new Set(roster.map(p=>p.id));
  if(!ids.has(player)||!ids.has(cpu))throw new Error('Choose two valid roster entries.');
  const url=new URL('play-online/',root);
  url.searchParams.set('duel',player+','+cpu);
  url.searchParams.set('ai','1');url.searchParams.set('arenaRoster','1');
  return url.href;
}
