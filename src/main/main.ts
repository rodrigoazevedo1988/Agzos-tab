import path from 'node:path';
import { app } from 'electron';

import started from 'electron-squirrel-startup';

import { APP_ID, APP_NAME, DEFAULT_GLOBAL_SHORTCUT } from '@shared/constants';
import { IPC } from '@shared/ipc';

import { ApplicationsCatalog } from './applications/catalog';
import { createElectronPorts } from './app/ports-electron';
import { resolveBundledAsset, homeDir, userDataDir } from './app/paths';
import { GlobalShortcutManager } from './app/shortcuts/global-shortcut';
import { createTray } from './app/tray/tray';
import { PaletteWindowManager } from './app/windows/palette-window';
import { createBuiltinCommands } from './commands/builtin';
import { CommandExecutor } from './commands/executor';
import { CommandRegistry } from './commands/registry';
import { ModuleRegistry } from './extensions/module-registry';
import { createDeveloperModule } from './extensions/modules/developer-module';
import { registerIpcHandlers } from './ipc/handlers';
import { createLogger } from './logger';
import { IpcGuard } from './security/ipc-guard';
import { FavoritesService } from './services/favorites-service';
import { HistoryService } from './services/history-service';
import { SearchService } from './services/search/search-service';
import { SettingsService } from './services/settings-service';

import type { Ports } from './app/ports';
import type { AppInfo, SystemCapabilities } from '@shared/types/system';

const log = createLogger('main');

// Windows: finish the Squirrel install/uninstall lifecycle before doing anything.
if (started) {
  app.quit();
}

let isQuitting = false;
let palette: PaletteWindowManager | null = null;
let shortcuts: GlobalShortcutManager | null = null;
let modules: ModuleRegistry | null = null;

/** Applies settings that affect OS-level integration. */
function applySettingsSideEffects(settings: SettingsService, ports: Ports): void {
  const current = settings.get();
  ports.power.setLaunchAtLogin(current.startup.launchAtLogin);
}

async function bootstrap(): Promise<void> {
  app.setName(APP_NAME);
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

  const ports = createElectronPorts();
  const dataDir = userDataDir();

  const settings = new SettingsService(dataDir);
  await settings.init();

  const history = new HistoryService(dataDir, () => {
    const current = settings.get();
    return {
      enabled: current.history.enabled && current.privacy.persistHistory,
      maxEntries: current.history.maxEntries,
    };
  });
  const favorites = new FavoritesService(dataDir);

  const capabilities: SystemCapabilities = ports.capabilities();
  const catalog = new ApplicationsCatalog({
    platform: capabilities.platform,
    homeDir: homeDir(),
    env: process.env,
    cacheDir: dataDir,
  });

  const registry = new CommandRegistry();
  const builtinServices = {
    settings,
    history,
    favorites,
    applications: catalog,
    ports,
    appInfo: (): AppInfo => buildAppInfo(capabilities),
    capabilities: () => capabilities,
  };
  registry.registerAll(createBuiltinCommands(builtinServices));

  modules = new ModuleRegistry({
    commands: registry,
    isEnabled: (moduleId) => settings.get().extensions.enabled[moduleId] !== false,
  });
  modules.registerModule(createDeveloperModule());

  const executor = new CommandExecutor(registry, history, ports.dialog);
  const search = new SearchService(registry, catalog, favorites, history, settings);

  const windowManager = new PaletteWindowManager({
    preloadPath: path.join(__dirname, 'preload.js'),
    isDev: Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL),
    shouldQuit: () => isQuitting,
    openExternal: (url) => {
      void ports.shell.openExternal(url).catch(() => {
        log.warn('Blocked or failed external navigation');
      });
    },
  });
  palette = windowManager;
  windowManager.create();

  const guard = new IpcGuard();
  guard.setAllowedPrefixes(windowManager.allowedPrefixes());

  const shortcutManager = new GlobalShortcutManager(ports.shortcuts);
  shortcuts = shortcutManager;

  registerIpcHandlers({
    guard,
    palette: windowManager,
    registry,
    executor,
    search,
    applications: catalog,
    settings,
    history,
    favorites,
    shortcuts: shortcutManager,
    ports,
    appInfo: () => buildAppInfo(capabilities),
    capabilities: () => capabilities,
  });

  // React to settings changes that require re-applying OS integration.
  settings.on('changed', () => {
    applySettingsSideEffects(settings, ports);
  });
  applySettingsSideEffects(settings, ports);

  registerGlobalShortcut(settings, shortcutManager, windowManager);

  createTrayIfAvailable(ports, windowManager);

  if (!settings.get().startup.startMinimized) {
    windowManager.show();
  }

  log.info(`${APP_NAME} ready on ${capabilities.platform}`);
}

function registerGlobalShortcut(
  settings: SettingsService,
  manager: GlobalShortcutManager,
  windowManager: PaletteWindowManager,
): void {
  const accelerator = settings.get().shortcuts.global || DEFAULT_GLOBAL_SHORTCUT;
  const result = manager.register(accelerator, () => windowManager.toggle());
  if (!result.ok) {
    log.warn(`Could not register the global shortcut (${result.reason ?? 'unknown'})`);
  }
}

function createTrayIfAvailable(ports: Ports, windowManager: PaletteWindowManager): void {
  const isMac = ports.capabilities().platform === 'darwin';
  const iconFile = isMac ? 'trayTemplate.png' : 'icon.png';
  createTray({
    iconPath: resolveBundledAsset('icons', iconFile),
    template: isMac,
    onOpenPalette: () => windowManager.show(),
    onOpenSettings: () => {
      windowManager.show();
      windowManager.send(IPC.eventNavigate, { view: 'settings' });
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    },
  });
}

function buildAppInfo(capabilities: SystemCapabilities): AppInfo {
  return {
    name: APP_NAME,
    version: app.getVersion(),
    platform: capabilities.platform,
    arch: process.arch,
    electronVersion: process.versions.electron ?? 'unknown',
    nodeVersion: process.versions.node ?? 'unknown',
    isPackaged: app.isPackaged,
  };
}

// Single-instance: a second launch just surfaces the existing palette.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    palette?.show();
  });

  void app.whenReady().then(async () => {
    try {
      await bootstrap();
    } catch (error) {
      log.error('Failed to start', { reason: (error as Error).name });
      app.quit();
    }
  });
}

app.on('activate', () => {
  palette?.show();
});

app.on('before-quit', () => {
  isQuitting = true;
  shortcuts?.release();
  modules?.disposeAll();
  modules = null;
});

app.on('will-quit', () => {
  shortcuts?.release();
});

// The palette window hides instead of closing, so `window-all-closed` never
// fires in normal use. The app stays resident in the tray / behind the hotkey
// and only exits through the tray "Quit" item or the OS quit signal.

export {};
