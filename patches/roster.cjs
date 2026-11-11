/* global browser */
// This adapter targets one verified game build. Its caller verifies the raw
// response hash before using patch(). All replacements must match exactly.
(() => {
  'use strict';

  function patch(original) {
    let source = original;
    function replace(anchor, replacement) {
      const index = source.indexOf(anchor);
      if (index < 0 || source.indexOf(anchor, index + anchor.length) !== -1) {
        throw new Error('Unsupported game build. Missing or ambiguous roster anchor: ' + anchor.slice(0, 72));
      }
      source = source.slice(0, index) + replacement + source.slice(index + anchor.length);
    }

    // Collection ownership, rewards and the Pokédex consult the original lock.
    // Only callers actually selecting a team are allowed to preview every entry.
    replace('function ud(e,t){let n=ad(e);', 'function ud(e,t,forRoster=false){if(forRoster)return false;let n=ad(e);');
    for (const [before, after] of [
      ['filter(t=>!ud(t.id,e)).map(e=>e.id)', 'filter(t=>!ud(t.id,e,true)).map(e=>e.id)'],
      ['l=ud(r.id,e);c>=0', 'l=ud(r.id,e,true);c>=0'],
      ['o!==null&&ud(o,t)', 'o!==null&&ud(o,t,true)'],
      ['e!==null&&ud(e,df())', 'e!==null&&ud(e,df(),true)'],
      ['this.currentPool().filter(e=>!ud(e.id,df()))', 'this.currentPool().filter(e=>!ud(e.id,df(),true))'],
      ['function FC(e,t){return!ud(e,t)}', 'function FC(e,t){return!ud(e,t,true)}'],
      ['.filter(e=>!ud(e.id,n));if(r.length===3)', '.filter(e=>!ud(e.id,n,true));if(r.length===3)']
    ]) replace(before, after);

    // The game's shared picker has two callers. Local selection may choose
    // Mega forms. The official room keeps its original non-Mega roster and
    // its own party validation. The default All page includes every entry.
    replace('showPick(e,t=`quick`){this.mount()', 'showPick(e,t=`quick`,offline=false){this.arenaRosterOffline=offline;this.mount()');
    replace('Z.showPick(e=>this.start(e),this.source)', 'Z.showPick(e=>this.start(e),this.source,true)');
    replace('currentPool(){return z_(rn,{query:', 'currentPool(){return z_(this.arenaRosterOffline?Zt:rn,{browseAll:true,query:');
    replace('if(t.typeName!==`all`){let r=e.filter(e=>!n.has(e.id)&&e.types.includes(t.typeName))',
      'if(t.browseAll||t.typeName!==`all`){let r=e.filter(e=>!n.has(e.id)&&(t.typeName===`all`||e.types.includes(t.typeName)))');

    // Pass an explicit full-roster option only from Quick and Vs CPU. Story
    // stays scripted, and other stock modes retain their original featured pool.
    replace('let a=Jt.flatMap(e=>{try{let t=dn(e);return r.has(t.dex)?[]:[t]}catch{return[]}})',
      'let a=n?.fullRoster?Zt.filter(mon=>!r.has(mon.dex)):Jt.flatMap(e=>{try{let t=dn(e);return r.has(t.dex)?[]:[t]}catch{return[]}})');
    replace('n=(e.featuredIds??Jt).filter(e=>e.length>0)', 'n=(e.featuredIds??Zt.map(mon=>mon.id)).filter(e=>e.length>0)');
    replace('opponent:r?[...mZ]:yo(o,s),difficulty:Sl(e.storage)', 'opponent:r?[...mZ]:yo(o,s,{fullRoster:true}),difficulty:Sl(e.storage)');
    replace('function Rk(e){', 'let arenaRosterSeed=0;function Rk(e){');
    replace('return 17+Math.max(0,t)}function zk(e,t){return yo(e,Rk(e[0]),t?.bst?{bst:!0}:void 0)}',
      'return (arenaRosterSeed+17+Math.max(0,t))>>>0}function zk(e,t){let seed=Rk(e[0]);return yo(e,seed,{fullRoster:true,bst:t?.bst===true&&(seed&3)!==0})}');
    replace('init(e){this.source=e?.source??`quick`,this.origin=zq(e)}',
      'init(e){arenaRosterSeed=Math.floor(Math.random()*4294967296);this.source=e?.source??`quick`,this.origin=zq(e)}');

    // Preserve exact form IDs only when the arena constructs an offline CPU
    // simulation. Native network worlds never receive this flag.
    replace('if(this.combat=Pa(e.stageId),e.thirdPartyIds!==void 0)',
      'if(this.rosterForms=e.rosterForms===true&&e.ai===true,this.combat=Pa(e.stageId),e.thirdPartyIds!==void 0)');
    replace('this.playerSpecies=dn(yc(e.playerSpeciesId)),this.opponentSpecies=dn(yc(e.opponentSpeciesId))',
      'this.playerSpecies=dn(this.rosterForms?e.playerSpeciesId:yc(e.playerSpeciesId)),this.opponentSpecies=dn(this.rosterForms?e.opponentSpeciesId:yc(e.opponentSpeciesId))');
    replace('membersFrom(e,t){return e.map((e,n)=>{let r=yc(e),i=dn(r)',
      'membersFrom(e,t){return e.map((e,n)=>{let r=this.rosterForms?e:yc(e),i=dn(r)');
    replace('this.world=new bc({seed:c,stageId:this.stageId,playerSpeciesId:o,opponentSpeciesId:d',
      'this.world=new bc({rosterForms:this.aiEnabled&&!this.net&&!this.story&&!this.run&&!this.encounter&&(!i||t?.get("arenaRoster")==="1"),seed:c,stageId:this.stageId,playerSpeciesId:o,opponentSpeciesId:d');

    // An untagged native duel keeps its normal party behavior. For a roster
    // challenge, validate both IDs and keep the intended one-on-one lineup.
    replace('function YQ(e){',
      'function YQ(e){let rosterQuery=new URLSearchParams(e);if(rosterQuery.get("arenaRoster")==="1"&&rosterQuery.has("duel")){let ids=rosterQuery.get("duel").split(",");if(ids.length!==2||ids.some(id=>!Qt.has(id)))return null;return {playerSpeciesId:ids[0],opponentSpeciesId:ids[1],partyIds:[ids[0]]}}');
    return source;
  }

  const api = Object.freeze({patch});
  globalThis.ArenaRosterAdapter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
