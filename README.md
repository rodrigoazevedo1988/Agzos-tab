# Agzos Tab

A fast, secure and extensible keyboard-driven desktop launcher for **Windows, macOS and Linux**.

Agzos Tab is a command palette that sits behind a global hotkey. Press it, type, and run —
applications, system actions, tools and settings, all without touching the mouse.

> **Status: 0.1.0 (MVP).** The core launcher works end-to-end and is verified by automated tests
> plus a real packaged build. See [Known limitations](#known-limitations) before treating any
> platform-specific claim as verified.

---

## Features

- **Global hotkey** (`Ctrl/Cmd + Shift + Space`) shows and hides the palette from anywhere.
- **Universal search** across commands, applications and settings with prefix, word-boundary,
  substring and fuzzy matching, plus boosts for favorites and recently used items.
- **Application discovery** per platform: `/Applications` bundles on macOS, Start Menu
  shortcuts on Windows, and Freedesktop `.desktop` entries on Linux.
- **Keyboard-first**: `↑`/`↓` to navigate, `Enter` to run, `Escape` to close or go back,
  `Ctrl/Cmd + K` to clear, `Ctrl/Cmd + D` to pin.
- **Favorites and history**, persisted locally, with a configurable size limit.
- **Settings** with a validated, versioned JSON schema, atomic writes, migrations, and
  import/export that rejects malformed input without corrupting the current configuration.
- **Tray integration** with Open / Settings / Quit.
- **Command registry** so new commands and internal modules can be added without touching the core.
- **AI-ready contracts** (provider interfaces, streaming, cancellation, privacy guards) with no
  external AI dependency and **no simulated AI responses**.
- **Security by default**: sandboxed renderer, no Node in the UI, an explicit IPC allow-list,
  argument validation on every channel, origin checks, navigation blocking and a production CSP.

## Technology

| Area          | Choice                                       |
| ------------- | -------------------------------------------- |
| Desktop shell | Electron 44 (Electron Forge 7 + Vite plugin) |
| UI            | React 18 + TypeScript 5 (strict)             |
| Build         | Vite 5                                       |
| Styling       | Tailwind CSS 3 + Lucide icons                |
| State         | Zustand                                      |
| Validation    | Zod                                          |
| Tests         | Vitest + React Testing Library (jsdom)       |
| Quality       | ESLint + Prettier                            |
| CI/CD         | GitHub Actions                               |

## Requirements

- **Node.js 20+** and npm 10+
- **Git**
- Platform packaging tools:
  - macOS: Xcode Command Line Tools (`hdiutil` ships with macOS)
  - Windows: nothing extra for the NSIS installer
  - Linux: `rpm` and `fakeroot` for the `.rpm`/`.deb` makers

## Getting started

```bash
git clone https://github.com/rodrigoazevedo1988/Agzos-tab.git
cd Agzos-tab
npm ci
npm run dev        # launches Electron with Vite in development mode
```

Press `Ctrl/Cmd + Shift + Space` (or use the tray icon) to open the palette.

### Useful scripts

| Script                            | What it does                                                            |
| --------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                     | Run the app in development (alias of `npm start`)                       |
| `npm run start`                   | `electron-forge start`                                                  |
| `npm run build`                   | Typecheck, build the production bundles and package the app into `out/` |
| `npm run package`                 | Package the app for the current platform into `out/`                    |
| `npm run make`                    | Package and build installers into `out/make`                            |
| `npm test`                        | Run the Vitest suite once                                               |
| `npm run test:watch`              | Vitest in watch mode                                                    |
| `npm run test:coverage`           | Vitest with V8 coverage                                                 |
| `npm run lint`                    | ESLint over `src` and `tests`                                           |
| `npm run typecheck`               | `tsc --noEmit`                                                          |
| `npm run format` / `format:check` | Prettier write / check                                                  |
| `node scripts/generate-icons.mjs` | Regenerate the PNG icons in `resources/icons`                           |
| `node scripts/checksums.mjs`      | Write `out/make/SHA256SUMS` for built artifacts                         |

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — process model, IPC, command registry, storage.
- [`docs/BUILD.md`](docs/BUILD.md) — per-platform builds, artifact names, signing and notarization.
- [`docs/TESTING.md`](docs/TESTING.md) — test layers, what is and is not covered.
- [`docs/EXTENSIONS.md`](docs/EXTENSIONS.md) — module contract and how to add a command.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — planned evolution (nothing below is implemented yet).
- [`SECURITY.md`](SECURITY.md) — security model and vulnerability reporting.
- [`CHANGELOG.md`](CHANGELOG.md) — release history.

## Distribution

`npm run make` produces (per platform, on that platform):

| Platform | Formats                     |
| -------- | --------------------------- |
| Windows  | NSIS `.exe` installer       |
| macOS    | `.dmg` and `.zip` (`.app`)  |
| Linux    | `.AppImage`, `.deb`, `.rpm` |

Artifact names include the version and architecture (e.g. `Agzos Tab-0.1.0-arm64.dmg`,
`Agzos Tab-darwin-arm64-0.1.0.zip`). `node scripts/checksums.mjs` writes a `SHA256SUMS` file
covering everything produced.

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds on all three runners,
verifies that the tag matches `package.json`, generates checksums and attaches the artifacts to a
GitHub release.

## Known limitations

These are stated honestly rather than hidden:

- **Verified builds:** only **macOS arm64** has been built, packaged and launched end-to-end in
  this repository's development environment. The Windows and Linux pipelines are configured and
  their YAML is syntax-validated, but **their artifacts have not been produced or tested here**.
- **Installers are unsigned.** No code-signing certificates or notarization credentials are
  configured. macOS builds will show Gatekeeper warnings and are not notarized.
- **Global hotkey** registration depends on the OS/desktop environment. If the combination is
  already taken, the app reports the conflict and lets you choose another. Custom bindings are
  user-editable but the settings UI does not yet offer a key-capture widget.
- **No MSI** on Windows (`@electron-forge/maker-wix` is not configured); the NSIS `.exe` is the
  supported installer.
- **AppImage** uses the community `@reforged/maker-appimage` package and has not been exercised
  in this environment.
- **File search is not implemented.** The setting and the architecture hook exist
  (`search.includeFileSearch`), but no on-demand file indexer ships yet.
- **AI is contracts only.** No provider performs network calls; nothing is simulated.
- **Light theme** and the accent choices are persisted but only the dark theme is styled.
- **Accessibility**: focus states, ARIA roles and reduced-motion support are implemented, but no
  screen-reader audit has been performed.

## License

MIT. See [`LICENSE`](LICENSE).
