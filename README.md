# Poké2D Full Roster — GitHub Pages

Mobile-friendly, extension-free launcher and build-time port of the supplied **Poke2D Full Roster Firefox 1.0.1** patches.

**Integration test build, not a verified playable mirror.** The source includes 1,066 Pokémon/form entries. The native game is downloaded and patched during a build; it is not included in this repository. Current native-game startup, official multiplayer, complete asset coverage, and physical iPhone Safari compatibility remain unverified.

## What this changes

The supplied patch unlocks roster selection, expands local CPU selection, and preserves exact starting forms in tagged CPU duels. It does not grant owned cards or coins, bypass authentication, or change the official server's validation. Mode-specific restrictions still apply.

The hosting wrapper preserves explicit official service addresses and native message bodies. Relative service requests are routed back to the original game host. **Preserving endpoints does not prove that the official servers accept a GitHub Pages origin.**

## Deployment for this repository

1. In **Settings → Pages**, select **GitHub Actions** as the source.
2. Open **Actions → Publish full-roster client**. Run the workflow on `main`, or inspect the run started by the project upload.
3. Open the deployment URL only after the build and deploy jobs succeed.

Expected URL after a successful deployment: https://ocey78.github.io/Pkmnarna/

The workflow runs source tests, imports the supported game build, applies the roster patch, and uploads the Pages artifact. It deliberately stops on unknown source hashes or patch anchors. Do not disable those checks to force an incompatible build.

## Local build

Requires Node.js 22+ and Python 3.10+.

```sh
npm test
npm run build
npm run preview
```

The preparation step obtains the pinned Acorn 8.15.0 parser and checks its SHA-256 before use. No Safari extension or userscript is needed for a successfully built site.

Open the printed local preview address after a successful build. The launcher alone is not the imported game. If the game import fails, read the error rather than assuming the site is playable.

## Important limits

- The native client must match the version supported by the supplied Firefox adapter.
- A failed DNS lookup, changed build, missing asset, or rejected cross-origin request can prevent import or play.
- Official multiplayer acceptance must be tested separately; no server-origin checks are bypassed.
- Existing browser saves on the original domain are not automatically transferred to GitHub Pages.
- Publish imported game code and artwork only with any required rights or permission. This project does not grant rights to upstream assets.

See `docs/REVERSE-ENGINEERING.md` and `docs/VERIFICATION.md` for implementation details and the original test limitations.
