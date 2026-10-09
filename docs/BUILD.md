# Building and distributing Agzos Tab

## Tooling

| Tool                                             | Purpose                                     |
| ------------------------------------------------ | ------------------------------------------- |
| Node.js 20+ and npm 10+                          | Install, build, test                        |
| Electron Forge 7 + `@electron-forge/plugin-vite` | Packaging and installers                    |
| Xcode Command Line Tools (macOS)                 | `hdiutil` for the `.dmg` maker              |
| `rpm`, `fakeroot` (Linux)                        | `maker-rpm` and `maker-deb`                 |
| `libarchive-tools` (Linux)                       | AppImage tooling used by the AppImage maker |

Install dependencies reproducibly:

```bash
npm ci
```

## Build locally

```bash
npm run build     # typecheck + production bundles + package into out/
npm run package   # package only (no installers)
npm run make      # package + build installers into out/make
```

Artifacts land in `out/make`. Generate checksums with:

```bash
node scripts/checksums.mjs          # writes out/make/SHA256SUMS
node scripts/checksums.mjs --stdout # prints without writing
```

The script refuses to checksum an empty file and fails if no artifact exists, so CI cannot publish
a hollow build.

## Configuring the build

`forge.config.ts` holds everything:

- `packagerConfig.name` → `Agzos Tab`, `executableName` → `agzos-tab`, `appBundleId` →
  `dev.agzos.tab`.
- `extraResource: ['./resources/icons']` ships the icons so the tray/window icon resolves
  identically in development and in production.
- Makers: Squirrel (Windows), DMG + ZIP (macOS), AppImage + deb + rpm (Linux).
- Fuses: `RunAsNode` off, cookie encryption on, `NODE_OPTIONS` and CLI inspect arguments off,
  ASAR integrity validation on, load-only-from-ASAR on.

Regenerate the icon PNGs at any time (no binary assets required in history):

```bash
node scripts/generate-icons.mjs
```

## Per-platform notes

### Windows

Produced: an NSIS installer named `<appName>-<version> Setup.exe`.

- **Packaged successfully by CI** on `windows-latest`; artifact `agzos-tab-windows-latest` (~147 MB)
  with a generated `SHA256SUMS`.
- **Never launched on Windows.** Only packaging is verified — runtime behaviour (hotkey, tray,
  Start Menu discovery) is not.
- The installer is **unsigned**, so SmartScreen will warn until a certificate is configured.
- **MSI is not configured.** `@electron-forge/maker-wix` is intentionally absent rather than
  half-configured.
- Forge's Squirrel maker appends the version to the installer name but not the architecture; the
  runner architecture (x64 on `windows-latest`) is implied.

### macOS

Produced: `.dmg` (ULFO compression) and `.zip` containing the `.app`.

Verified locally: `Agzos Tab-0.1.0-arm64.dmg` and
`Agzos Tab-darwin-arm64-0.1.0.zip`, both 121 MB, from a real `npm run make` run.

- Artifact names include the version and architecture.
- **Signing and notarization are not configured.** To enable them, provide certificates as CI
  secrets and set `packagerConfig.osxSign` / `osxNotarize`. Until then, Gatekeeper will block the
  app and users must allow it manually. This limitation is stated in `README.md` as well.
- The Electron binary architecture is chosen by the packaging step; building for Intel on an
  Apple-Silicon machine requires `--arch=x64` and a Rosetta-capable toolchain.

### Linux

Produced: `.AppImage`, `.deb`, `.rpm`.

- **Packaged successfully by CI** on `ubuntu-latest`; artifact `agzos-tab-ubuntu-latest` (~307 MB)
  with a generated `SHA256SUMS`.
- **Never launched on Linux.** Only packaging is verified — runtime behaviour (hotkey, tray,
  `.desktop` discovery) is not.
- The AppImage uses the community `@reforged/maker-appimage` package, because Electron Forge has no
  official AppImage maker. If it proves unreliable, remove that maker and keep `.deb`/`.rpm` rather
  than claiming AppImage support.
- Global shortcuts and the tray depend on the desktop environment. On minimal desktops without a
  StatusNotifier/app-indicator host, the tray returns `null` and the app continues to work via the
  hotkey. Freedesktop `EGL`/Wayland differences in global shortcut support are a known
  cross-desktop limitation.
- `linux-arm64` is not configured; only the x64 runner is targeted initially.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main`/`master`, on pull requests and manually:

1. **quality** (Ubuntu): `npm ci`, lint, typecheck, format check, tests with coverage, coverage
   artifact upload.
2. **dependencies** (Ubuntu): `npm audit --omit=dev --audit-level=high` — only runtime
   dependencies gate the build.
3. **package** (Ubuntu, macOS, Windows matrix): install Linux packaging tools where relevant,
   `npm run make`, verify artifacts and write checksums, then upload them as build artifacts.

The Linux packaging tools step is what makes `maker-deb`, `maker-rpm` and the AppImage maker work
on the runner.

### Actions pinning

Actions are pinned to major-version tags (`actions/checkout@v4`, …) for reproducibility. Pinning to
full commit SHAs is stricter and recommended for hardened environments; it is not done here because
the SHAs cannot be verified offline in this environment.

## Releases

`.github/workflows/release.yml` triggers on `v*` tags (or manually):

1. Each platform job runs `node scripts/check-version.mjs "$GITHUB_REF_NAME"` first, so a release
   can never publish artifacts whose version disagrees with the tag.
2. `npm run make` then `node scripts/checksums.mjs`.
3. Artifacts are uploaded per OS.
4. The `publish` job downloads all artifacts and runs `gh release create … --verify-tag
--generate-notes`, attaching every file plus `SHA256SUMS`.

Permissions are least-privilege: `contents: read` globally, `contents: write` only on the publish
job.

The CI workflow has run successfully on `main`, producing packaged artifacts for all three
platforms. **No tagged release has been published yet** — `release.yml` is configured and its YAML
is syntax-validated, but it has not been triggered, so signing, notarization and release
publication remain unproven.

## Common problems

| Symptom                                          | Cause and fix                                                                                                                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `The main entry point to your app was not found` | The Vite plugin names the main bundle after the entry file's basename. Keep the entries as `src/main/main.ts` and `src/preload/preload.ts` so the output matches `package.json#main` (`.vite/build/main.js`).    |
| Tray icon missing                                | `resources/icons` was not regenerated/shipped. Run `node scripts/generate-icons.mjs`; the packaged path is `Contents/Resources/icons` (`extraResource`).                                                         |
| `rpm`/`deb` maker fails on CI                    | Install `rpm` and `fakeroot` (the workflow already does).                                                                                                                                                        |
| Global hotkey does nothing                       | Another application owns the combination, or the desktop does not support global shortcuts. The app reports the conflict in the logs and the settings view.                                                      |
| Settings look reset                              | A corrupted `settings.json` fails validation and falls back to defaults by design. Check `~/Library/Application Support/Agzos Tab/` (macOS), `%APPDATA%\Agzos Tab\` (Windows) or `~/.config/Agzos Tab/` (Linux). |
