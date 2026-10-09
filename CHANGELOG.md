# Changelog

All notable changes to Agzos Tab are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] — 2026-10-08

First working MVP: a real, packaged launcher with a secured process model, persistent settings,
application discovery and an extensible command registry.

### Added

**Foundation**

- Electron Forge 7 project on the Vite + TypeScript template, with React 18, Tailwind CSS 3,
  Zustand and Zod.
- Strict TypeScript configuration (including `noUncheckedIndexedAccess` and
  `noUnusedLocals`) with `@shared`/`@main`/`@preload`/`@renderer` path aliases wired into every
  Vite config and Vitest.
- ESLint (with `import` ordering and Prettier compatibility) and Prettier.

**Launcher experience**

- Frameless command palette window: starts hidden, opens on the global hotkey, centres on the
  display under the cursor, hides on blur when packaged, and reports its content height to the
  main process so it stays compact.
- Universal search combining commands and applications, grouped by category and ranked with
  exact/prefix/word-boundary/substring/fuzzy tiers plus additive boosts for favorites and
  recently used items.
- Full keyboard control: `↑`/`↓` (and `Ctrl+N`/`Ctrl+P`), `Enter`, `Escape`, `Ctrl/Cmd+K`,
  `Ctrl/Cmd+D`.
- Result panel rendering structured command output (`text`, `list`, `key-value`).
- Settings, Favorites, History and Keyboard-shortcuts views.
- Empty, loading and error states, plus a non-blocking status line.

**System integration**

- Global shortcut registration with conflict detection and restoration of the previous binding on
  failure; released on quit.
- Tray icon with Open / Settings / Quit, degrading gracefully when unavailable.
- Application discovery adapters: macOS `.app` bundles, Windows Start Menu `.lnk`/`.exe`
  (uninstallers filtered out), Linux Freedesktop `.desktop` entries.
- Catalog caching with on-demand scanning and launch-time revalidation of targets.
- Application launching that respects target shape: `shell.openPath` for absolute paths, direct
  `spawn` (no shell) for Linux `Exec` commands.
- Single-instance lock; a second launch surfaces the existing palette.
- Launch-at-login support.

**Data**

- Atomic JSON persistence (temp file + rename) for settings, history and favorites, with
  validation on every read.
- Versioned settings schema with migration, deep-merge patching and strict rejection of invalid
  updates.
- JSON export (secrets stripped at any depth) and import that validates before applying and
  leaves the previous configuration intact on failure.
- Bounded, de-duplicating history that stores no sensitive fields.

**Extensibility**

- Central command registry with typed metadata (`id`, `name`, `description`, `category`,
  `keywords`, `icon`, `shortcut`, `enabled`, `source`, `riskLevel`), scoring-based search and
  per-command enable/disable.
- Command executor enforcing existence, enabled state, confirmation policy and safe error
  translation.
- Internal module registry with manifest validation, capability declarations and unit toggling,
  plus a shipped example module (`core.developer`).
- Abstract AI provider contracts (models, streaming, cancellation, timeout, usage, privacy guard)
  with **no** provider implementation and no simulated responses.

**Security**

- Sandboxed renderer, `contextIsolation`, no Node integration, disabled webviews.
- Explicit IPC allow-list, origin/sub-frame validation, Zod-validated arguments and typed response
  envelopes.
- Navigation and new-window blocking; http/https links delegated to the OS browser.
- Production CSP injected at build time.
- Electron fuses locked down (no `RunAsNode`, no `NODE_OPTIONS`, ASAR integrity).
- URL, path and accelerator validators with traversal protection.

**Quality and delivery**

- 143 automated tests across 18 files: unit tests for scoring, ranking, validators, settings
  schema/service, storage, history, favorites, registry, module registry, executor, search,
  normalization, `.desktop` parsing and the launcher; integration tests for IPC handlers (with a
  mocked `ipcMain`) and application discovery against real filesystem fixtures; a React Testing
  Library component test.
- GitHub Actions CI with quality gates, a runtime-dependency audit and per-OS packaging
  (Ubuntu, macOS, Windows).
- Tag-driven release workflow with version consistency checking, checksum generation and release
  publication.
- Reproducible PNG icon generator (Node built-ins only).
- Documentation: README, SECURITY, ARCHITECTURE, BUILD, TESTING, EXTENSIONS, ROADMAP.

### Fixed during development

- **Module enable/disable was ineffective.** `declareCommand` ran before the module registered its
  command, so a module configured as disabled had its commands re-enabled by its own
  `commands.register()` call. Toggling now happens after registration. Covered by a regression
  test.
- **Linux applications could never be launched.** `launchTarget` for `.desktop` entries is
  frequently a bare command resolved through `PATH`, but revalidation treated it as a filesystem
  path and rejected every entry. Targets are now handled by shape: absolute paths are revalidated
  on disk, bare commands are spawned without a shell after a `PATH` lookup.
- **`frame-ancestors` in the meta CSP** produced a Chromium warning and had no effect. Removed;
  framing is blocked by the navigation guards.
- **Electron 44 clipboard API is asynchronous**; the clipboard port was adjusted accordingly.

### Known limitations

See the "Known limitations" section of [`README.md`](README.md). In short: only macOS arm64
artifacts have actually been built and launched; installers are unsigned; Windows and Linux
artifacts are configured but unverified in this environment; no file search; AI is contracts only.

<!--
Comparison links intentionally omitted: this repository has no configured remote yet.
Once one exists, add:
  [Unreleased]: <remote>/compare/v0.1.0...HEAD
  [0.1.0]: <remote>/releases/tag/v0.1.0
-->
