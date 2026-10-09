# Security Policy

Agzos Tab runs with the user's privileges and can open files, launch applications and read the
clipboard. Security is treated as an architectural requirement, not an afterthought.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub's
[Security Advisories](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
for this repository, or email the maintainer listed in `package.json`.

Include: affected version, platform, reproduction steps, and the impact you believe is possible.

You can expect an acknowledgement within a few days. Please allow time for a fix before public
disclosure.

## Supported versions

Only the latest released version receives security fixes while the project is pre-1.0.

## Security model

### Process separation

| Process      | Trust            | Capabilities                                                                |
| ------------ | ---------------- | --------------------------------------------------------------------------- |
| **Main**     | Trusted          | Full Node.js, OS integration. The only authority for privileged operations. |
| **Preload**  | Trusted, minimal | Bridges a fixed set of functions over `contextBridge`. No Node APIs.        |
| **Renderer** | Untrusted        | React UI only. Cannot reach Node, the filesystem or arbitrary IPC.          |

### Window hardening (all windows)

```
contextIsolation: true
nodeIntegration: false
nodeIntegrationInWorker: false
nodeIntegrationInSubFrames: false
sandbox: true
webSecurity: true
allowRunningInsecureContent: false
experimentalFeatures: false
webviewTag: false
```

Plus, at runtime (`src/main/security/window-security.ts`):

- `will-navigate` is blocked for any URL outside the app's own document.
- `setWindowOpenHandler` denies every new window; `http`/`https` links are handed to the OS
  browser instead of being loaded in-app.
- `<webview>` attachment is denied.
- The packaged app uses Electron fuses to disable `RunAsNode`, `NODE_OPTIONS`, CLI inspect
  arguments, and to enforce ASAR integrity and loading only from ASAR.

### Content Security Policy

Production HTML ships with a strict CSP injected at build time (`vite.renderer.config.ts`):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'
```

`frame-ancestors` is deliberately absent: it is only honoured as an HTTP header and Chromium
ignores it inside `<meta>`. Framing is blocked by the navigation guards instead.

The dev build intentionally has no meta CSP because Vite's HMR needs inline script. This applies
to the local development server only.

### IPC

- The complete channel set is an explicit allow-list in `src/shared/ipc.ts`
  (`INVOKABLE_CHANNELS`). `registerIpcHandlers` refuses to bind anything outside it.
- The preload exposes **one function per channel**. The renderer cannot name a channel.
- Every handler validates its payload with a Zod schema before touching any service.
- `IpcGuard` rejects messages whose sender frame is not the app's own top-level frame, or that
  come from an unexpected origin.
- Handlers return a typed envelope (`{ ok: true, data }` / `{ ok: false, error }`). Internal
  exceptions are reduced to a generic message so stack traces never reach the UI.
- No generic "invoke anything" channel exists.

### Privileged operations

- **External URLs**: only `http` and `https`, no embedded credentials, validated before
  `shell.openExternal`.
- **File paths**: must be absolute and free of null bytes; Windows UNC/device paths are rejected
  before `shell.openPath`.
- **Traversal**: `resolveWithinBase` refuses paths that escape their base directory.
- **Process launching**: no shell is ever used. Executables are resolved against `PATH` or must
  be absolute existing files. Command arguments come from trusted code or validated `.desktop`
  files — never from raw user input.
- **Destructive commands** carry `riskLevel: 'destructive'` and are confirmed through a native
  dialog before execution.
- **File dialogs** are initiated by the main process; the renderer cannot specify arbitrary paths
  to open beyond what the OS picker returns.

### Clipboard and history

- History stores only `id`, `kind`, `title` and a timestamp. Command arguments, file contents and
  clipboard data are never recorded.
- History can be disabled entirely, and its size is bounded.

### Secrets

- No credentials are stored in the settings document, exported JSON, logs or the repository.
- `SettingsService.export()` defensively strips keys named `apiKey`, `token`, `password`,
  `secret` or `credential` at any depth.
- AI provider credentials (when providers are implemented) must go to the OS keychain, never to
  the JSON settings file. The `ai` settings section intentionally holds only non-secret
  preferences.
- `.gitignore` excludes `node_modules`, `out/`, `.vite/`, coverage output and `.env` files.

### Privacy

- Telemetry is off and there is no analytics code.
- No data is sent anywhere. AI integrations are disabled until the user configures a provider,
  and `assertRemoteAllowed` refuses remote requests unless the caller explicitly opts in.
- Clipboard content and history are never forwarded to external services automatically.

## Dependencies

- Runtime dependencies are audited in CI (`npm audit --omit=dev --audit-level=high`).
- Lockfiles are committed so installs are reproducible (`npm ci` in CI).
- Dependencies are chosen for compatibility with the pinned Electron major version.

## Known accepted risks

| Risk                                         | Rationale / mitigation                                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modules run in the main process (no sandbox) | Modules are compiled-in, trusted code. Loading untrusted third-party plugins is **not** implemented; a sandboxed/isolation model must be designed first. |
| Global shortcuts may be unavailable          | Registration is validated and failures are surfaced to the user rather than silently ignored.                                                            |
| Unsigned builds                              | Documented in `README.md` and `docs/BUILD.md`. Verification steps are left to the user until certificates are configured.                                |
