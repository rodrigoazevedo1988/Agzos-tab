# Testing

## Scripts

| Command                 | Purpose                                |
| ----------------------- | -------------------------------------- |
| `npm test`              | Run the whole suite once               |
| `npm run test:watch`    | Watch mode                             |
| `npm run test:coverage` | V8 coverage (`coverage/`, text + lcov) |
| `npm run lint`          | ESLint over `src` and `tests`          |
| `npm run typecheck`     | `tsc --noEmit`                         |
| `npm run format:check`  | Prettier check                         |

## Layers

### Unit tests (`tests/unit`)

| File                        | What it covers                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scoring.test.ts`           | Normalisation (case/diacritics), exact > prefix > substring ranking, word boundaries, fuzzy subsequences, field weights                           |
| `rank.test.ts`              | Ranking order, limits, stable ties, non-match filtering                                                                                           |
| `validators.test.ts`        | URL allow-list (rejects `file:`, `javascript:`, `data:`, credentials), safe paths, traversal blocking, accelerator structure                      |
| `settings-schema.test.ts`   | Defaults validate, range/enum rejection, deep merge, migration from older/corrupt documents                                                       |
| `settings-service.test.ts`  | Load/update/reset, invalid patch rejection, `changed` events, export sanitisation, import warnings, previous-config preservation on failure       |
| `json-store.test.ts`        | Defaults on missing file, round-trip, corrupt JSON fallback, atomic writes without temp leftovers, serialised concurrent writes                   |
| `history-service.test.ts`   | Recency order, de-duplication, size limit, disabled mode, remove/clear, persistence, ranking, no sensitive fields                                 |
| `favorites-service.test.ts` | Toggle, ordering, reorder + reindex, unknown ids, persistence                                                                                     |
| `command-registry.test.ts`  | Registration, duplicate rejection, enable/disable, search by name/keyword, limits, grouping                                                       |
| `module-registry.test.ts`   | Manifest validation, duplicate ids, disabled-module behaviour, unit toggling, shipped developer module                                            |
| `command-executor.test.ts`  | NOT_FOUND, disabled, history recording (and non-recording on failure), confirmation accepted/cancelled/skipped, safe internal errors, arg passing |
| `search-service.test.ts`    | Grouping, empty results, favorite/recency boosts, `maxResults`, timing                                                                            |
| `normalize.test.ts`         | Stable ids, de-duplication, keyword variants, sorting, launchTarget fallback, empty-record rejection                                              |
| `desktop-entry.test.ts`     | `[Desktop Entry]` parsing, other groups ignored, NoDisplay/Hidden, field-code stripping                                                           |
| `launcher.test.ts`          | `Exec` splitting with quotes, path-vs-command detection, shell vs spawn launch, missing executable                                                |
| `result-list.test.tsx`      | React Testing Library (jsdom): options rendered per result, `aria-selected`, confirmation badge, click handler, empty state                       |

### Integration tests (`tests/integration`)

| File                             | What it covers                                                                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ipc-handlers.test.ts`           | The real handler registration with a mocked `ipcMain`: allow-list enforcement, untrusted-origin and sub-frame rejection, `INVALID_ARGUMENT` on bad payloads, end-to-end search/execution/settings/capabilities, occupied-shortcut reporting, non-invokable push channels |
| `applications-discovery.test.ts` | Every adapter against real temporary filesystem fixtures, plus `ApplicationsCatalog` scan → persist → cached read → search → launch-target revalidation                                                                                                                  |

### Component tests

`result-list.test.tsx` runs under jsdom (opted in via a `// @vitest-environment jsdom` docblock).
Node is the default environment; renderer files that need a DOM must declare it.

## Current results

Recorded from a real run on macOS (arm64), Node v20.20.2:

| Check                  | Result                                   |
| ---------------------- | ---------------------------------------- |
| `npm run lint`         | 0 errors, 0 warnings                     |
| `npm run typecheck`    | 0 errors                                 |
| `npm run format:check` | All files formatted                      |
| `npm test`             | **143 tests passed** across **18 files** |

## What is _not_ covered

Be explicit about the gaps:

- **No end-to-end GUI automation.** There is no Playwright/Spectron-style driver. The palette was
  verified by launching the packaged app and reading the main-process boot log
  (`25 IPC channels registered`, global shortcut registered, palette shown,
  `Agzos Tab ready on darwin`) — but keyboard interaction, focus behaviour and visual rendering
  were **not** automated.
- **No real-OS integration tests.** Discovery is tested against fixtures, not against an actual
  `/Applications`, Start Menu or desktop database. Global shortcuts, the tray and native dialogs
  are exercised through fakes, not the OS.
- **Windows and Linux behaviour is unverified.** Their CI jobs are configured but have never run.
- **No signed/notarized build tests.**
- **No performance benchmark.** Startup time and memory were not measured; see
  [`ROADMAP.md`](ROADMAP.md).
- **No accessibility audit** beyond ARIA roles, focus states and reduced-motion support.

## Adding tests

- Prefer real filesystem fixtures in a temp directory (`tests/helpers/temp-dir.ts`) over mocking
  `fs`; cleanup is automatic.
- Use `tests/helpers/fake-ports.ts` for port implementations. It records calls so you can assert
  what the app actually did (`openedPaths`, `spawned`, `confirmCalls`, …).
- When mocking `electron`, mock only what the module under test imports — the IPC test mocks
  `ipcMain` and nothing else.
- A regression test must fail before the fix. The module-toggle and Linux-launch bugs both have one.
