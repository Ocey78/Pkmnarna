# Rocket Menu 1.9.56 integration verification

## Request
Replace the earlier hosted full-roster extension with the supplied Rocket Menu ZIP.
Open directly into the native game. Remove the independent picker/hosting overlay,
but preserve the uploaded extension's own UI. Keep native service endpoints.

## Completed checks
- 28 Node tests passed; 19 Python tests passed.
- The new root/overlay and archive-validation tests were observed failing before
  implementation. An additional duplicate-menu regression failed before its fix.
- The exact uploaded archive (SHA-256 1063e69857098b21ff7e70fa2d1eb9a9808e8ba85972eba8b30eba01e6115a0d) was extracted and its ordered adapter pipeline applied.
- The cached old native engine was inverted and matched the original engine
  SHA-256 06f753660f6405ce447fa04f9a53de87cf1a4e28108fed70bf7cee989ac905c7 exactly.
- Rebuilt output: 9,470 inventoried files, 200,928,690 bytes. All file checksums
  matched the generated inventory. This includes the uploaded boss music.
- Seven in-memory Chromium menu/bridge checks passed: locked initial visibility,
  unlocking presentation, opening the original panel, switches initially off,
  untouched sentinel game save, no global browser API pollution, no page errors.

## Not claimed
The in-memory component test does not run the native game or official network.
Local native navigation is blocked by this environment's administrator policy;
that policy was not changed. The GitHub workflow must execute the actual native
menu/battle tests before publishing, and then repeat them against Pages.
Official multiplayer and physical iPhone compatibility remain unverified.

## Delivery constraint
The GitHub connector used here can write text/Git objects but has no mounted
local-file upload action. The full input ZIP has not been transferred to GitHub
by this integration. The workflow explicitly waits for the exact original ZIP
in the repository root, and leaves the existing Pages deployment unchanged
until the replacement passes its build and gameplay checks.
