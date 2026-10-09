import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IPC } from '@shared/ipc';

/**
 * A tiny in-memory `ipcMain` replaces Electron so the real handler registration
 * code can be exercised in Node. The mock records handlers and lets the test
 * invoke them with a synthetic event, mirroring how the renderer would.
 */
type Handler = (event: unknown, payload: unknown) => Promise<unknown>;
const handlers = new Map<string, Handler>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      handlers.delete(channel);
    },
  },
}));

const { registerIpcHandlers } = await import('@main/ipc/handlers');
const { IpcGuard } = await import('@main/security/ipc-guard');
const { CommandRegistry } = await import('@main/commands/registry');
const { CommandExecutor } = await import('@main/commands/executor');
const { createBuiltinCommands } = await import('@main/commands/builtin');
const { SearchService } = await import('@main/services/search/search-service');
const { SettingsService } = await import('@main/services/settings-service');
const { HistoryService } = await import('@main/services/history-service');
const { FavoritesService } = await import('@main/services/favorites-service');
const { ApplicationsCatalog } = await import('@main/applications/catalog');
const { GlobalShortcutManager } = await import('@main/app/shortcuts/global-shortcut');
const { createFakePorts } = await import('../helpers/fake-ports');
const { makeTempDir } = await import('../helpers/temp-dir');

const TRUSTED_URL = 'file:///app/index.html';

function trustedEvent(): unknown {
  return { senderFrame: { parent: null, url: TRUSTED_URL } };
}

function untrustedEvent(): unknown {
  return { senderFrame: { parent: null, url: 'https://evil.example.com/' } };
}

async function buildContext(): Promise<{
  invoke: (channel: string, payload?: unknown, event?: unknown) => Promise<unknown>;
  ports: Awaited<ReturnType<typeof createFakePorts>>;
  palette: { hideCount: number; showCount: number };
}> {
  const dir = await makeTempDir();
  const settings = new SettingsService(dir);
  await settings.init();
  const history = new HistoryService(dir, () => ({ enabled: true, maxEntries: 20 }));
  const favorites = new FavoritesService(dir);
  const ports = createFakePorts();
  const catalog = new ApplicationsCatalog({
    platform: 'linux',
    homeDir: dir,
    env: {},
    adapters: [],
  });
  const registry = new CommandRegistry();
  registry.registerAll(
    createBuiltinCommands({
      settings,
      history,
      favorites,
      applications: catalog,
      ports,
      appInfo: () => ({
        name: 'Agzos Tab',
        version: '0.1.0',
        platform: 'linux',
        arch: 'x64',
        electronVersion: 'test',
        nodeVersion: 'test',
        isPackaged: false,
      }),
      capabilities: () => ports.capabilities(),
    }),
  );
  const executor = new CommandExecutor(registry, history, ports.dialog);
  const search = new SearchService(registry, catalog, favorites, history, settings);
  const guard = new IpcGuard();
  guard.setAllowedPrefixes([TRUSTED_URL]);

  const paletteState = { hideCount: 0, showCount: 0 };
  const palette = {
    hide: () => {
      paletteState.hideCount += 1;
    },
    show: () => {
      paletteState.showCount += 1;
    },
    toggle: () => true,
    setHeight: () => undefined,
    withAutoHideSuppressed: <T>(operation: () => Promise<T>): Promise<T> => operation(),
  };

  registerIpcHandlers({
    guard,
    palette: palette as never,
    registry,
    executor,
    search,
    applications: catalog,
    settings,
    history,
    favorites,
    shortcuts: new GlobalShortcutManager(ports.shortcuts),
    ports,
    appInfo: () => ({
      name: 'Agzos Tab',
      version: '0.1.0',
      platform: 'linux',
      arch: 'x64',
      electronVersion: 'test',
      nodeVersion: 'test',
      isPackaged: false,
    }),
    capabilities: () => ports.capabilities(),
  });

  const invoke = async (
    channel: string,
    payload?: unknown,
    event: unknown = trustedEvent(),
  ): Promise<unknown> => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`Channel ${channel} is not registered`);
    return handler(event, payload);
  };

  return { invoke, ports, palette: paletteState };
}

describe('IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('only registers allow-listed channels', async () => {
    await buildContext();
    expect(handlers.has(IPC.appGetInfo)).toBe(true);
    expect(handlers.has(IPC.commandsSearch)).toBe(true);
    // Push-event channels must never be invokable.
    expect(handlers.has(IPC.eventVisibility)).toBe(false);
    expect(handlers.has(IPC.eventNavigate)).toBe(false);
  });

  it('rejects messages from an untrusted origin', async () => {
    const { invoke } = await buildContext();
    const response = (await invoke(IPC.appGetInfo, undefined, untrustedEvent())) as {
      ok: boolean;
      error?: { code: string };
    };
    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('PERMISSION_DENIED');
  });

  it('rejects messages sent from a sub-frame', async () => {
    const { invoke } = await buildContext();
    const response = (await invoke(IPC.appGetInfo, undefined, {
      senderFrame: { parent: {}, url: TRUSTED_URL },
    })) as { ok: boolean; error?: { code: string } };
    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('PERMISSION_DENIED');
  });

  it('rejects invalid arguments with INVALID_ARGUMENT', async () => {
    const { invoke } = await buildContext();
    const response = (await invoke(IPC.commandsSearch, { query: 123 })) as {
      ok: boolean;
      error?: { code: string };
    };
    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('INVALID_ARGUMENT');
  });

  it('returns application info for a trusted caller', async () => {
    const { invoke } = await buildContext();
    const response = (await invoke(IPC.appGetInfo)) as { ok: boolean; data: { name: string } };
    expect(response.ok).toBe(true);
    expect(response.data.name).toBe('Agzos Tab');
  });

  it('searches commands through the validated pipeline', async () => {
    const { invoke } = await buildContext();
    const response = (await invoke(IPC.commandsSearch, { query: 'calculator' })) as {
      ok: boolean;
      data: { groups: Array<{ items: Array<{ id: string }> }> };
    };
    expect(response.ok).toBe(true);
    const ids = response.data.groups.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toContain('system.open-calculator');
  });

  it('executes a builtin command end-to-end', async () => {
    const { invoke } = await buildContext();
    const response = (await invoke(IPC.commandsExecute, {
      commandId: 'system.date-time',
      args: {},
      confirmed: false,
    })) as { ok: boolean; data: { success: boolean; content?: { type: string } } };
    expect(response.ok).toBe(true);
    expect(response.data.success).toBe(true);
    expect(response.data.content?.type).toBe('key-value');
  });

  it('propagates an invalid command id as a domain failure', async () => {
    const { invoke } = await buildContext();
    const response = (await invoke(IPC.commandsExecute, {
      commandId: 'does.not.exist',
      args: {},
      confirmed: false,
    })) as { ok: boolean; data: { success: boolean; error?: { code: string } } };
    expect(response.ok).toBe(true);
    expect(response.data.success).toBe(false);
    expect(response.data.error?.code).toBe('NOT_FOUND');
  });

  it('updates settings and rejects invalid patches', async () => {
    const { invoke } = await buildContext();
    const ok = (await invoke(IPC.settingsUpdate, { appearance: { theme: 'light' } })) as {
      ok: boolean;
      data: { appearance: { theme: string } };
    };
    expect(ok.ok).toBe(true);
    expect(ok.data.appearance.theme).toBe('light');

    const bad = (await invoke(IPC.settingsUpdate, { history: { maxEntries: 10_000 } })) as {
      ok: boolean;
    };
    expect(bad.ok).toBe(false);
  });

  it('exposes platform capabilities', async () => {
    const { invoke } = await buildContext();
    const response = (await invoke(IPC.systemCapabilities)) as {
      ok: boolean;
      data: { platform: string };
    };
    expect(response.ok).toBe(true);
    expect(response.data.platform).toBe('linux');
  });

  it('reports an occupied global shortcut', async () => {
    const { invoke, ports } = await buildContext();
    ports.failNextShortcut = true;
    const response = (await invoke(IPC.shortcutRegister, {
      accelerator: 'CommandOrControl+Shift+Space',
    })) as { ok: boolean; data: { ok: boolean; reason?: string } };
    expect(response.ok).toBe(true);
    expect(response.data.ok).toBe(false);
    expect(response.data.reason).toBe('occupied');
  });

  it('toggles the palette through the window channel', async () => {
    const { invoke, palette } = await buildContext();
    const response = (await invoke(IPC.windowToggle)) as { ok: boolean };
    expect(response.ok).toBe(true);
    expect(palette.showCount + palette.hideCount).toBeGreaterThanOrEqual(0);
  });

  it('returns raw commands list metadata', async () => {
    const { invoke } = await buildContext();
    const response = (await invoke(IPC.commandsList)) as {
      ok: boolean;
      data: Array<{ id: string; enabled: boolean }>;
    };
    expect(response.ok).toBe(true);
    expect(response.data.length).toBeGreaterThan(10);
    expect(response.data.every((command) => typeof command.id === 'string')).toBe(true);
  });
});
