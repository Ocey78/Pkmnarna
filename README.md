# Pkmnarna — native game with Rocket Menu 1.9.56

The replacement build opens directly into the native game. It has no full-roster
launcher, custom fighter-picker page, Roster button or Connection overlay.
Rocket Menu's own UI and features are retained from the supplied extension.

## One required input

Upload the **unchanged `Rocket-Menu-Firefox-1.9.56.zip`** to this repository's root
using **Add file → Upload files**. A filename with a `(1)` suffix is accepted.
Do not extract it first. The build verifies SHA-256:

`1063e69857098b21ff7e70fa2d1eb9a9808e8ba85972eba8b30eba01e6115a0d`

A ChatGPT attachment is not automatically a GitHub repository file. The connected
GitHub tools used to prepare this port do not expose a local-file upload action.
Until the exact ZIP is present, the workflow runs source tests but **does not
replace the current live deployment**. Uploading it automatically starts the
replacement build. Pages is already configured to use GitHub Actions.

## What the new build does

- Recovers the exact stock engine from the earlier cached client, then verifies
  the original SHA-256 before applying anything.
- Runs only the uploaded Rocket Menu adapters, in their manifest order.
- Uses the original menu content script with a small local preference-storage
  bridge instead of Firefox extension APIs.
- Includes the ZIP's boss music and other packaged audio files.
- Preserves native invitation search/hash values and official service endpoints.
- Reuses checksummed assets from this repository's existing public Pages site,
  because the old original-server engine download now returns HTTP 403.
- Requires native opening and advancing CPU-battle tests in Chromium and mobile
  WebKit before deployment, and repeats the checks on the live site afterward.

`patches/roster.cjs` is retained **only to invert the earlier cached mod and for
legacy regression tests**. The new build does not apply that extension. Once a
Rocket build is published, `compat/source.js` supplies the hash-verified pristine
engine for subsequent rebuilds, avoiding repeated inverse transformations.

## Rocket Menu access

The original 1.9.56 access flow is preserved: in the game's **Settings → Data**,
enter `SNEAKYGIO14` as the save name and use **Export XML** to toggle menu access.
The red R is hidden until unlocked. Every new game starts with menu switches off.
Game-save keys are not cleared. Progress on this origin remains separate from the
official website's origin.

## Local build

Use Node 22+ and Python 3.12+. With the ZIP in the repository root:

```sh
npm test
npm run seed
npm run build
npm run preview
```

The seed import uses this existing project URL, not arbitrary remote sources.
To reuse a local validated seed, pass `--seed PATH` to `scripts/build-rocket.py`.

## Verification boundary

Source/unit tests and an in-memory browser test do **not** prove native gameplay.
Check the latest **Publish Rocket Menu** run for the build, deployment and
live-verification status. Physical iPhone testing and official multiplayer
acceptance are not established by the local tests. Preserving server endpoints
does not bypass server-side origin, room or team validation.

Original game code/assets and the uploaded extension remain their respective
owners' work. No affiliation, endorsement or new redistribution rights are implied.
