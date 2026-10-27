# Contributing

Small, focused changes are welcome. Please open an issue before proposing a larger redesign.

Run `npm test` and `npm run check:release` before sending a pull request. Changes to search, caching or request lifecycle behavior should include a regression test. Keep runtime dependencies minimal and use the public Harness service interfaces.

Use fictional fixtures in tests and screenshots. Never attach real conversation exports, session caches, account configuration or credentials. A useful bug report includes the Harness version, plugin version, reproduction steps and the smallest sanitized example that demonstrates the problem.

The demo renderer uses the actual view component with a small static hook adapter. Changes to its layout should be checked in both languages; do not add performance numbers to the fixture as if they were measured results.
