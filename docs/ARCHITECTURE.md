# Architecture

Agzos Tab is an Electron application split into three processes with a strict trust boundary, plus
a shared layer of contracts used by all of them.

```
src/
├── shared/        contracts used by every process (no Electron, no Node globals)
├── main/          trusted: OS integration, storage, command execution
├── preload/       minimal typed bridge over contextBridge
└── renderer/      untrusted React UI
```

```
┌──────────────────────────── renderer (sandboxed, no Node) ───────────────────────────┐
│  React + Zustand  ·  palette views  ·  keyboard handling  ·  window.agzos (typed API) │
└───────────────────────────────────┬──────────────────────────────────────────────────┘
                                    │  contextBridge (fixed function set)
┌───────────────────────────────────▼──────────────────────────────────────────────────┐
│  preload  ·  invoke(channel, payload) → unwraps { ok, data } | throws AgzosApiError   │
└───────────────────────────────────┬──────────────────────────────────────────────────┘
                                    │  ipcMain.handle (allow-listed channels only)
┌───────────────────────────────────▼──────────────────────────────────────────────────┐
│  main  ·  IpcGuard (origin/frame) → Zod validation → service → typed envelope         │
│        services: settings · history · favorites · catalog · search · executor         │
│        infrastructure: ports (shell/dialog/clipboard/power/shortcuts/process)          │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Shared layer (`src/shared`)

Pure contracts with no runtime dependency on Electron or Node globals, so the renderer can import
them safely:

- `ipc.ts` — the channel allow-list (`IPC`), `INVOKABLE_CHANNELS`, response envelope types and the
  channel → response map used to type the preload bridge.
- `api.ts` — the `AgzosApi` interface that describes `window.agzos`.
- `settings-schema.ts` — the Zod schema, defaults, deep-merge and migration.
- `types/` — commands, applications, search, history, system info, extensions, platform.
- `ai/provider.ts` — abstract AI contracts and the remote-privacy guard.
- `errors.ts` — `AgzosApiError`, thrown by the bridge on transport/permission failures.

## Main process (`src/main`)

`main.ts` is the composition root. On boot it:

1. acquires the single-instance lock;
2. loads settings, then builds history and favorites on top of the user-data directory;
3. detects platform capabilities and constructs the Electron-backed ports;
4. builds the command registry (builtins + modules) and the applications catalog;
5. creates the palette window and registers the IPC handlers with the window's allowed origins;
6. registers the global shortcut and creates the tray;
7. shows the palette unless `startup.startMinimized` is set.

Shutdown: `before-quit` releases shortcuts and disposes modules.

### Ports

Privileged OS behaviour sits behind narrow interfaces (`app/ports.ts`) so services stay testable
and auditable. `app/ports-electron.ts` provides the real implementation; tests inject
`tests/helpers/fake-ports.ts`.

| Port        | Responsibility                                                               |
| ----------- | ---------------------------------------------------------------------------- |
| `shell`     | `openPath` (validated), `openExternal` (http/https only), `showItemInFolder` |
| `dialog`    | directory/file pickers, save dialog, native confirmation                     |
| `clipboard` | read/write text (Electron 44's async clipboard API)                          |
| `power`     | launch-at-login                                                              |
| `shortcuts` | global shortcut register/unregister                                          |
| `process`   | `PATH` resolution and detached `spawn` with no shell                         |

### Services

- **`SettingsService`** — validated reads/writes, `changed` events, export (secrets stripped) and
  import (validated before applying).
- **`HistoryService`** — bounded, de-duplicating recent items; records only id/kind/title/time.
- **`FavoritesService`** — ordered pins with reindexing.
- **`ApplicationsCatalog`** — lazy discovery, persisted cache, search and launch-time
  revalidation.
- **`SearchService`** — merges command and application hits, applies favorite/recency boosts and
  groups by category.
- **`CommandExecutor`** — the single choke-point for running commands.

### Storage (`storage/json-store.ts`)

Documents are written to a sibling temp file and then `rename`d over the target, so an interrupted
write cannot corrupt the file. Reads validate via a per-document `deserialize` function and fall
back to defaults on anything unexpected. Concurrent writes are serialised through a promise chain.

Persisted under `app.getPath('userData')`:

| File                      | Contents                    |
| ------------------------- | --------------------------- |
| `settings.json`           | Versioned settings document |
| `history.json`            | Recent items                |
| `favorites.json`          | Pinned items                |
| `applications-cache.json` | Last discovery result       |

## Command registry and execution

Commands are `{ metadata, handler }` pairs registered from code — handlers are **never**
deserialised from JSON. Metadata is serializable and is what the renderer receives.

`CommandExecutor.execute()` enforces, in order:

1. the command exists (`NOT_FOUND` otherwise);
2. it is enabled (`PERMISSION_DENIED` otherwise);
3. if `riskLevel === 'destructive'` (or `requiresConfirmation`), a native confirmation is shown —
   automated callers may pass `confirmed: true`;
4. the handler runs inside a try/catch; success is recorded in history;
5. any thrown error becomes `{ success: false, error: { code: 'INTERNAL', … } }` with no leaked
   internals.

## Modules / extensions

`ModuleRegistry` validates each manifest with Zod before registration, tracks which commands a
module owns, and can enable/disable a module's commands as a unit. Modules are compiled-in trusted
code; there is no dynamic loading of third-party code. See [`EXTENSIONS.md`](EXTENSIONS.md).

## Renderer (`src/renderer`)

- `stores/palette-store.ts` — Zustand store for view, query, grouped/flat results, selection,
  loading, error, last result and toast.
- `features/command-palette/useCommandPalette.ts` — debounced search with stale-response
  cancellation via a monotonic request id, execution, favorite toggling, global key handling and
  content-height reporting.
- Components render the palette frame, search field, grouped results, result panel and footer;
  views cover search, settings, favorites, history and help.
- `utils/icons.tsx` maps command icon names to Lucide components.

The renderer performs **no** privileged work: every action goes through `window.agzos`.

## IPC lifecycle

```
renderer calls window.agzos.commands.search(query)
  → preload invoke('agzos:commands:search', { query })
  → ipcMain handler
      · IpcGuard.isTrusted(event)          → PERMISSION_DENIED if not the app's top frame
      · parseArgs(schema, payload)         → INVALID_ARGUMENT on shape mismatch
      · SearchService.search(query)        → domain work
      · ipcOk(data) / ipcFail(code, msg)
  → preload unwraps: returns data, or throws AgzosApiError(code, message)
```

Push events from main to renderer (`agzos:event:visibility`, `agzos:event:navigate`) are
subscribe-only and are never registered as invokable channels.

## Platform adapters

Each adapter declares `supports(platform)`, `defaultRoots(context)` and
`discover(context): RawApplicationRecord[]`. Roots are injectable, which is exactly how the
integration tests point them at temporary fixtures.

| Platform | Sources                                                                                | Notes                                                                                  |
| -------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| macOS    | `/Applications`, `/Applications/Utilities`, `/System/Applications`, `~/Applications`   | `.app` bundles; first `.icns` in `Contents/Resources` recorded                         |
| Windows  | Start Menu `Programs` (machine and user)                                               | `.lnk`/`.exe`; uninstallers/setup/readme filtered out                                  |
| Linux    | `$XDG_DATA_HOME/applications`, Flatpak exports, `/var/lib/flatpak/…`, `$XDG_DATA_DIRS` | `.desktop` parsed for Name/Exec/Type/NoDisplay/Hidden/OnlyShowIn; field codes stripped |

Records are normalised: whitespace collapsed, keyword variants built, ids derived from
`sha1(platform:path)`, duplicates removed and results sorted by name.

## AI readiness

`src/shared/ai/provider.ts` defines `AiProvider`, model descriptors, request/stream/usage types and
`assertRemoteAllowed`. Nothing is implemented and nothing is simulated. When a provider is added,
credentials must live in the OS keychain and the `ai` settings section must keep holding only
non-secret preferences.
