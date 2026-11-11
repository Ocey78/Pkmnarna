# Inspected behavior and remaining unknowns

This is an analysis of the **uploaded Firefox adapter**, not a claim that the entire native game or server was decompiled. No full upstream game bundle was available in the development environment. Minified symbols below refer only to the adapter's pinned build and are not stable public APIs.

## Adapter behavior actually available for inspection

| Anchor or symbol | Supplied patch behavior |
| --- | --- |
| `ud` | Adds a `forRoster` parameter so roster selection can ignore a collection gate without changing ordinary ownership queries. |
| Selected `ud` call sites and `FC` | Pass the roster flag in the intended selection paths; do not indiscriminately replace every ownership check. |
| `showPick`, `currentPool`, `rn`, `Zt` | Mark an offline picker and select the complete catalog for that flow; enable browse-all filtering. |
| `yo`, `Jt`, `zk`, `Rk` | Use the full catalog for selected CPU opponent generation and vary the local seed, retaining introductory/mode-specific cases. |
| `bc`, `membersFrom`, `yc` | Preserve selected form IDs only under the adapter's local AI/form conditions rather than normalizing every form into a base species. |
| `YQ` | For the tagged `arenaRoster=1` duel flow, validate two IDs against `Qt` and use a one-member local lineup. |

The included `patches/roster.cjs` retains the uploaded adapter. `data/roster.json` retains the same records; Git upload normalizes its CRLF line endings to LF. It contains 1,066 distinct IDs, including 24 names matching Mega-form naming (not merely names containing the letters “mega”). CPU duel URLs use those exact IDs, not display-name slug guesses.

The normal card collection, coins, native authored story progression and online team validation are outside the unlock scope. Exact starting Mega forms in local duels do not imply official online support for those forms.

## Hosting work added here

The Firefox add-on replaces a fetched script while retaining the official website origin. GitHub Pages cannot recreate that exact execution origin. This project instead imports public resources during a build, applies the supplied patch to known source bytes, and serves an external patched module as an ordinary static site.

Acorn is used at **build time** to identify module imports and recognizable resource strings, not to invent missing game logic. Root and project-subpath deployments get corrected paths. JSON asset metadata remains byte-for-byte unchanged because strings that resemble file paths can also be frame names or IDs.

A runtime compatibility layer maps a local mirrored asset to the new static host and a relative service request back to the official host. Explicit external service addresses remain as supplied by the native client. The layer preserves native request methods/bodies, WebSocket subprotocols/messages and invitation parameters. It observes transport state but does not fabricate a response, replace the server, change the browser Origin or initiate a background connection probe.

## Deliberately not claimed

- No endpoint map or packet schema has been reverse-engineered from an unavailable native bundle.
- No current hash match, full asset closure, native game startup, iPhone Safari compatibility or successful official room battle was established.
- No guarantee that official CORS, socket-origin, authentication, version or roster validation permits this new site.
- No promise that all 1,066 entries are permitted in every native mode.

A real validation run must import the native client, play a local duel with a non-default form, inspect missing resources, then join a consenting player's private official room and complete a battle. An opened socket or an executed module is not a substitute for that test.

## Primary references

- https://poke2darena.com/guides/online-multiplayer/
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
- https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
