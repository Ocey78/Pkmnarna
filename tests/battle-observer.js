// Read-only browser instrumentation: a world in phase "fight" may still be
// loading assets or running its intro countdown. Never step or alter the game.
globalThis.__readNativeBattle = () => {
  for (const scene of globalThis.__assetTestGame?.scene?.scenes || []) {
    if (!scene.sys.isActive() || typeof scene.world?.getState !== 'function') continue;
    const s = scene.world.getState();
    return {
      scene: scene.sys.settings.key,
      ready: scene.ready === true,
      acceptsInput: scene.world.acceptsInput(),
      intro: scene.world.introLabel(),
      phase: s.phase,
      tick: s.tick,
      inputFrame: s.inputFrame,
      elapsedMs: s.elapsedMs,
      remainingMs: s.remainingMs,
      fighters: s.fighters.map(f => ({id:f.id,speciesId:f.speciesId,hp:f.hp,x:f.x,y:f.y})),
      active: true
    };
  }
  return null;
};
globalThis.__nativeBattleStarted = () => {
  const s = globalThis.__readNativeBattle();
  return !!(s && s.ready && s.acceptsInput && s.phase === 'fight' && s.tick > 0 && s.elapsedMs > 0);
};
