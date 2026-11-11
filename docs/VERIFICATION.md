# Verification and publishing preparation

## Dependency verification correction

The first GitHub build exposed a packaging error: the parser in the source ZIP reported version 8.15.0 but did not match the published distribution. Local tests against that archived copy were insufficient to validate the download pin.

The workflow now downloads the Acorn 8.15.0 npm tarball and checks its published SHA-512 integrity before reading only `package/dist/acorn.js`. That independently verified parser has SHA-256:

```text
fdb08546776ec6228b03e8d02b40d4ab3255bae5f401adba7ff5dad927ac5c9c
```

`scripts/prepare.mjs` uses that checksum. A regression test rejects the earlier archived copy. This changes a parser dependency pin, not the native game hash checks or server validation. The full core suite now contains 16 Node tests and 7 Python tests; consult the corresponding GitHub Actions run for their actual result with the published parser.

Published package metadata: https://registry.npmjs.org/acorn/8.15.0

## Repository upload preparation

Before the dependency issue was discovered, a local `npm test` run passed 15 Node tests and 7 Python integration tests (22 total) against the archived parser. The three additional Node tests covered accepting a verified local parser without a network request, downloading verified bytes, and rejecting wrong bytes without replacing an existing file.

The SHA-1 Git blob IDs of the 22 uploaded runtime/build/test/license files were compared against those local UTF-8 texts before the initial source commit; all matched. Roster line endings were normalized from CRLF to LF, preserving all 1,066 exact records and unique IDs. The existing repository README was retained.

The generated `vendor/acorn.cjs` is not committed. Both `npm test` and `npm run build` invoke the parser preparation step automatically, and the parser's MIT license is retained in the repository.

**Source checks do not prove a successful Pages deployment, native game startup, complete assets, official multiplayer or physical iPhone compatibility.** Consult repository Actions for the actual import/deployment result. A source commit alone is not a playable game.

## Original development-session evidence — 2026-11-10

The source archive was validated on synthetic inputs. These results describe the earlier development run, not a new live integration test:

| Check | Original result | What this demonstrates |
| --- | --- | --- |
| Node tests | 12 passed | Hash/path gating, supplied patch anchors, AST rewriting, roster IDs, routing and publisher input safeguards. |
| Python integration tests | 7 passed | Synthetic import graph, shell rewriting, JSON preservation, path constraints, failed-build preservation and unknown-build rejection. |
| `python tests/dom_smoke.py` | 8 passed | Chromium DOM with mocked fetch/transports: mobile/desktop layout, 1,066 entries, 24 Mega forms, exact-form selection, invalid input, disabled state without a build, unchanged request/packet bodies and token-redacted diagnostics. |
| Syntax and workflow structure | Passed | Parsing and configured workflow structure, not a real Actions execution. |

The optional browser suites require Playwright and a Chromium executable at `/usr/bin/chromium`; these are not dependencies of the normal build or core tests.

## Original live import attempt

Command: `npm run build`

```text
Reading official game page...
BUILD STOPPED: <urlopen error [Errno -3] Temporary failure in name resolution>
No new site was deployed. See README troubleshooting; do not disable build verification.
```

Exit code: 1. No `dist` output was produced by that attempt. This is a failure of the live validation step, not evidence that the upstream website is down. The source archive did not contain a playable imported game.

## Browser environment limits

`tests/browser.py` is a fuller local-server integration suite, but the original environment blocked localhost navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`). That suite did not pass there. No administrator policy was changed. The separately labelled `dom_smoke.py` tests use an in-memory document and replace URL/network inputs with fixtures. They exercise the UI/wrapper, not origin policy or actual network compatibility.

Any original UI screenshots are synthetic launcher previews, not evidence of native gameplay.

## Remaining integration limits

The development checks did not retrieve a current native game bundle, establish gameplay or complete sprite/audio coverage, validate an official API response or lobby join, establish an official WebSocket handshake, or complete multiplayer. No physical iPhone test was performed.

Manual source review and automated tests were used; no independent reviewer was available. An atlas-metadata rewrite issue and a Mega count that included Meganium/Yanmega were corrected and covered by regressions. Remaining risks include dynamically constructed assets, changed minified symbols/hashes, native startup assumptions, cross-origin policies and official server validation.
