# Courtside 1.7 — Chunk 05: Stream Provider Integration

**Scope:** \`refactor/modular-1.7\` only. Keep \`main\` untouched. No user-facing feature changes.

## Migrations

- \`src/api/streams/config.js\` → \`config.module.mjs\`: retain AuraSports, PPV.st and Matchora API order and 2-minute TTLs.
- \`src/api/streams/requests.js\` → \`requests.module.mjs\`: retain cache and pending-Promise identity, request timeouts, fallback endpoints, response validation and URL allowlists.
- \`src/api/streams/matching.js\` → \`matching.module.mjs\`: retain NBA team/date matching, strict home/away roles for Matchora, duplicate URL filtering and **PPV.st-first** source selection.

Original source files are retained unchanged with \`.legacy.js\` suffix for exact byte-parity reconstruction and rollback. Factories are compiled via esbuild at the original inline script positions; the distributed HTML still needs no server or runtime modules.

The request adapter reads/writes the same original stream index cache and in-flight Promise fields through getter/setter properties. The matching adapter reads the latest ESPN games and provider caches via getters, so it never captures stale data.

## Test gates

Run \`npm run check:syntax\`, \`npm test\`, \`npm run verify:baseline\`, \`npm run build\` and \`npm run test:browser\`.

Node tests compare original versus modular URL guards, ESPN team/date matching, 2-minute TTLs, host failover, pending request deduplication and PPV-first provider order.

Offline Chromium compares source selection, manual changes and **zero iframe \`src\` attribute changes** during routine score repaint. The frozen 1.6.1 374,363-byte reference and SHA-256 \`0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e\` remain mandatory.

Real ESPN endpoints and third-party streams are not contacted by these tests. The 104-case manual regression list, Firefox \`file://\` verification and explicit approval remain release gates.

**Next:** Chunk 06 — isolate low-coupling Viewer presentation before touching the iframe controller.
