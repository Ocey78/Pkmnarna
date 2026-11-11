# Verification and publishing preparation

## Repository upload preparation

A fresh `npm test` run passed **15 Node tests and 7 Python integration tests (22 total)** before the source commit was prepared. The three additional Node tests cover the parser setup step: accepting a verified local parser without a network request, downloading verified bytes, and rejecting wrong bytes without replacing an existing file.

The SHA-1 Git blob IDs of the 22 uploaded runtime/build/test/license files were compared against the tested local UTF-8 texts before commit preparation; all matched. Roster line endings were normalized from CRLF to LF, preserving all 1,066 exact records and unique IDs. The existing repository README was retained.

The repository does not include the generated `vendor/acorn.cjs` file. `scripts/prepare.mjs` obtains Acorn 8.15.0 and verifies SHA-256 `6426dc483d1b40cea7c99d9e6bf889560557b1265b1d9d9bee2fb1360ea9bcc6`. Both `npm test` and `npm run build` invoke this preparation step automatically. The parser's MIT license is retained in the repository.

**These checks do not prove a successful GitHub deployment, native game startup, complete assets, official multiplayer or physical iPhone compatibility.** Consult the repository Actions run for the actual import/deployment result. A source commit alone is not a playable game.

## Original development-session evidence — 2026-11-10

The source archive was validated on synthetic inputs. The following table describes the earlier development run, not a new live integration test:

| Check | Result | What this demonstrates |
| --- | --- | --- |
| Original Node tests | 12 passed | Hash/path gating, supplied patch anchors, AST rewriting, roster IDs, routing and publisher input safeguards. |
| Python integration tests | 7 passed | Synthetic import graph, shell rewriting, JSON preservation, path constraints, failed-build preservation and unknown-build rejection. |
| `python tests/dom_smoke.py` | 8 passed in the original development run | Chromium DOM with mocked fetch/transports: mobile/desktop layout, 1,066 entries, 24 Mega forms, exact-form selection, invalid input, disabled state without a build, unchanged request/packet bodies and token-redacted diagnostics. |
| Syntax and workflow structure | Passed in the original development run | Parsing and configured workflow structure, not a real Actions execution. |

The optional browser suites require Playwright and a Chromium executable at `/usr/bin/chromium`; these are not dependencies of the normal build or core tests.

## Original live import attempt

Command: `npm run build`

```text
Reading official game page...
BUILD STOPPED: <urlopen error [Errno -3] Temporary failure in name resolution>
No new site was deployed. See README troubleshooting; do not disable build verification.
```

Exit code: **1**. No `dist` output was produced by that attempt. This is a failure of the live validation step, not evidence that the upstream website is down. The source archive did not contain a playable imported game.

## Browser environment limits

`tests/browser.py` is a fuller local-server integration suite, but the original development environment blocked localhost navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`). That suite did **not** pass there. No administrator policy was changed. The separately labelled `dom_smoke.py` tests use an in-memory document and replace URL/network inputs with fixtures. They exercise the shipped UI/wrapper, not origin policy or actual network compatibility.

Any original UI screenshots are synthetic launcher previews, not evidence of native gameplay.

## Remaining integration limits

The development checks did not retrieve a current upstream JS bundle, establish native gameplay or complete sprite/audio coverage, validate an official API response or lobby join, establish a WebSocket handshake to an official host, or complete multiplayer. No physical iPhone test was performed.

Manual source review and automated tests were used; no independent reviewer was available. An atlas-metadata rewrite issue and a Mega count that included Meganium/Yanmega were corrected and covered by regressions. Remaining risks include dynamically constructed assets, changed minified symbols/hashes, native startup assumptions, cross-origin policies and official server validation.
