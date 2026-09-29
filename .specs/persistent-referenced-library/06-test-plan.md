# Test Plan: Persistent Referenced Library

One vertical red-green-refactor slice at a time. Tests exercise public workflow, scanner, or repository seams, not unit tests of Electron entrypoints or module mocks.

1. **Read-only in-process scan:** test nested tagged audio, symlink avoidance, unreadable audio, traversal failure, and unchanged file bytes/mtime. Implement with Effect Stream and bounded `mapEffect`. This slice has begun; current transient renderer still collects results.
2. **Driver checkpoint:** smoke-test Drizzle with a disposable SQLite file inside Electron. Do not open userData or create a schema until explicit approval.
3. **Source registration and restart:** with an approved schema, register two folders, reselect one, restart repository, then load the same sources and app track IDs.
4. **Source-specific scan:** add source B and assert only B is read and reconciled; A's IDs, presence, and last scan time are unchanged. Repeated scan requests for B coalesce.
5. **Incomplete versus unreadable:** a traversal error or interruption leaves committed rows unchanged; a known unreadable path remains present with old metadata; an absent path becomes missing only after a complete scan of its own source.
6. **Lazy UI workflow:** show saved metadata before scans start, then queue each existing source independently after paint; manual Rescan targets one source; stop subscriptions on cleanup.
7. **Bounded artwork cache:** with a temporary cache, store the same cover twice and verify one file. Remove an original audio file and verify its saved track still renders the cached cover after restart. Fill the cap with referenced images and verify they are never evicted; report and skip admission of a new cover, which remains readable from its present source. Remove the final track reference and verify orphan cleanup can reclaim its bytes. Inject a failed scan and verify it cannot delete a cover still referenced by the committed library.

Run `bun run check:electron`, `bun run test:electron`, `bun run check:effect`, `bun run lint`, `bun run format:check`, the Electron build, and a real light/dark UI scan. Scale-test a representative large folder to confirm bounded scanner reads and acceptable main-thread commit latency. Tests use temporary folders and databases only.
