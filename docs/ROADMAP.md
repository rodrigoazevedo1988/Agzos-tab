# Roadmap

Everything below is **planned, not implemented**. Nothing in this document should be described as
a current feature.

## 0.1.x — hardening the MVP

- [ ] Add a signed, notarized macOS build and document the certificate workflow.
- [ ] Produce and verify Windows and Linux artifacts on their CI runners; record the results.
- [ ] Add real end-to-end coverage (Playwright for Electron) for: open palette → search → keyboard
      navigation → execute → persistence after restart → invalid settings import → occupied hotkey.
- [ ] Measure and record startup time, search latency and idle memory on representative hardware.
- [ ] Add a key-capture widget for the global shortcut in the settings view.
- [ ] Style the light theme and apply the accent color choices.
- [ ] Add a dismissible first-run hint explaining the hotkey and the tray.

## 0.2 — Search depth

- [ ] On-demand file search with configurable scope and hard limits; **no** unrestricted disk scan
      on startup.
- [ ] Optional SQLite index once history or file data outgrows the JSON documents.
- [ ] Per-source result providers behind the existing search seam.
- [ ] Search history and usage-based ranking that the user can clear.

## 0.3 — Windows and Linux parity

- [ ] Verify tray and global shortcut behaviour across GNOME, KDE and Wayland sessions.
- [ ] Windows: evaluate a signed MSI (`maker-wix`) and document the tradeoffs versus NSIS.
- [ ] Linux: validate the AppImage on a clean machine, or drop it in favour of `.deb`/`.rpm` if it
      proves unreliable.
- [ ] `linux-arm64` builds once runner and dependency support is confirmed.

## 0.4 — Extensibility

- [ ] Define and implement a **sandbox/isolation model** for third-party modules (separate
      process, explicit permission grants, resource limits) before allowing external code.
- [ ] Module settings UI driven by each module's declared schema.
- [ ] A local module catalog with explicit user consent, signatures or hashes, and no auto-update.

## 0.5 — Automations

- [ ] Workflows composed of explicitly allowed operations with validation, step limits, timeouts,
      cancellation and failure handling.
- [ ] **No** generic "execute whatever a JSON file contains" mechanism — steps must map to
      registered operations only.

## 0.6 — AI integrations

- [ ] Implement at least one real provider behind the existing `AiProvider` contract, plus an
      optional local model path.
- [ ] Secure credential storage per platform (keychain/Credential Manager/libsecret) with an
      explicit setup flow.
- [ ] A clear consent screen describing exactly what data leaves the device, defaulting to off.
- [ ] Capabilities: semantic search, command explanation, snippet generation, selected-text
      summaries, contextual assistant.
- [ ] AI remains strictly optional: every local command must keep working with AI disabled.

## Non-goals

- Copying the visual identity, name or assets of any competitor.
- Shipping simulated AI output presented as real.
- Silent network access, telemetry or analytics.
- Executing arbitrary imported code, shell strings or free-form scripts.
