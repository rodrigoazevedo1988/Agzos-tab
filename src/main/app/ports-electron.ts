import { spawn } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';
import { app, clipboard, dialog, globalShortcut, screen, shell } from 'electron';

import { createLogger } from '../logger';
import { isAllowedExternalUrl, isSafeLocalPath } from '../security/validators';

import type { Ports, ProcessPort, ShellPort } from './ports';

const log = createLogger('process');

/** Electron-backed ports used by the running application. */
export function createElectronPorts(): Ports {
  return {
    shell: createShellPort(),
    dialog: {
      async openDirectory() {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory'],
        });
        return result.canceled ? null : (result.filePaths[0] ?? null);
      },
      async openFiles() {
        const result = await dialog.showOpenDialog({
          properties: ['openFile', 'multiSelections'],
        });
        return result.canceled ? [] : result.filePaths;
      },
      async openFile(options) {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: options?.filters,
        });
        return result.canceled ? null : (result.filePaths[0] ?? null);
      },
      async saveFile(options) {
        const result = await dialog.showSaveDialog({
          title: options?.title,
          defaultPath: options?.defaultPath,
          filters: options?.filters,
        });
        return result.canceled || !result.filePath ? null : result.filePath;
      },
      async confirm(options) {
        const result = await dialog.showMessageBox({
          type: 'warning',
          buttons: ['Cancel', 'Confirm'],
          defaultId: 1,
          cancelId: 0,
          title: options.title,
          message: options.message,
          detail: options.detail,
        });
        return result.response === 1;
      },
    },
    clipboard: {
      readText: () => clipboard.readText(),
      writeText: async (text) => {
        await clipboard.writeText(text);
      },
    },
    power: {
      setLaunchAtLogin(enabled) {
        // Only meaningful in a packaged app; ignored during development.
        if (!app.isPackaged) return;
        app.setLoginItemSettings({ openAtLogin: enabled });
      },
      isLaunchAtLoginEnabled() {
        if (!app.isPackaged) return false;
        return app.getLoginItemSettings().openAtLogin;
      },
    },
    shortcuts: {
      register: (accelerator, handler) => globalShortcut.register(accelerator, handler),
      unregister: (accelerator) => globalShortcut.unregister(accelerator),
      unregisterAll: () => globalShortcut.unregisterAll(),
    },
    process: createProcessPort(),
    capabilities() {
      return {
        platform:
          process.platform === 'darwin'
            ? 'darwin'
            : process.platform === 'win32'
              ? 'win32'
              : 'linux',
        globalShortcut: true,
        tray: process.platform !== 'linux' || hasTraySupport(),
        launchAtLogin: true,
        applicationDiscovery: true,
        openExternal: true,
        fileDialogs: true,
        clipboard: true,
      };
    },
  };
}

/** Resolves a command to an executable path without invoking a shell. */
function resolveExecutable(command: string): string | null {
  if (command.includes('/') || command.includes('\\')) {
    return isSafeLocalPath(command) && isExecutable(command) ? command : null;
  }
  const pathEnv = process.env.PATH ?? '';
  const extensions = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = path.join(dir, `${command}${extension}`);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

function isExecutable(candidate: string): boolean {
  try {
    const stat = statSync(candidate);
    if (!stat.isFile()) return false;
    if (process.platform !== 'win32') accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function createProcessPort(): ProcessPort {
  return {
    async isAvailable(command) {
      return resolveExecutable(command) !== null;
    },
    async spawnDetached(command, args) {
      const resolved = resolveExecutable(command);
      if (!resolved) return { ok: false, error: 'Executable not found' };
      try {
        const child = spawn(resolved, [...args], {
          detached: true,
          stdio: 'ignore',
          shell: false,
        });
        child.on('error', (error) => {
          log.warn(`Spawn failed: ${error.name}`);
        });
        child.unref();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Could not launch the process' };
      }
    },
  };
}

function createShellPort(): ShellPort {
  return {
    async openPath(target) {
      if (!isSafeLocalPath(target)) return 'Refused to open an unsafe path';
      return shell.openPath(target);
    },
    async openExternal(url) {
      if (!isAllowedExternalUrl(url)) {
        throw new Error('Only http and https URLs can be opened externally');
      }
      await shell.openExternal(url);
    },
    showItemInFolder(target) {
      if (!isSafeLocalPath(target)) return;
      shell.showItemInFolder(target);
    },
  };
}

/**
 * Best-effort check for a system tray. Some minimal Linux desktops expose the
 * app indicator API while others do not; we cannot reliably detect this up
 * front, so we optimistically report support and degrade gracefully if the
 * tray cannot be created.
 */
function hasTraySupport(): boolean {
  if (process.platform !== 'linux') return true;
  try {
    // `screen` is available on all platforms; touching it verifies the app is
    // past `ready`, which is a prerequisite for tray availability checks.
    return screen.getAllDisplays().length > 0;
  } catch {
    return false;
  }
}
