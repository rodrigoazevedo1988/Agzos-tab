import type { SystemCapabilities } from '@shared/types/system';
import type { Ports, SpawnResult } from '@main/app/ports';

export interface FakePorts extends Ports {
  openedPaths: string[];
  openedUrls: string[];
  clipboardText: string;
  spawned: Array<{ command: string; args: readonly string[] }>;
  confirmResult: boolean;
  confirmCalls: Array<{ title: string; message: string }>;
  dialogDirectory: string | null;
  dialogFiles: string[];
  dialogOpenFile: string | null;
  dialogSaveFile: string | null;
  registeredShortcuts: Map<string, () => void>;
  /** When set, the next `register` call fails (simulates an occupied hotkey). */
  failNextShortcut: boolean;
}

/** In-memory Ports implementation used by unit/integration tests. */
export function createFakePorts(capabilities: Partial<SystemCapabilities> = {}): FakePorts {
  const fake: FakePorts = {
    openedPaths: [],
    openedUrls: [],
    clipboardText: '',
    spawned: [],
    confirmResult: true,
    confirmCalls: [],
    dialogDirectory: null,
    dialogFiles: [],
    dialogOpenFile: null,
    dialogSaveFile: null,
    registeredShortcuts: new Map(),
    failNextShortcut: false,

    shell: {
      async openPath(target: string): Promise<string> {
        fake.openedPaths.push(target);
        return '';
      },
      async openExternal(url: string) {
        fake.openedUrls.push(url);
      },
      showItemInFolder(target: string) {
        fake.openedPaths.push(`reveal:${target}`);
      },
    },
    dialog: {
      async openDirectory() {
        return fake.dialogDirectory;
      },
      async openFiles() {
        return fake.dialogFiles;
      },
      async openFile() {
        return fake.dialogOpenFile;
      },
      async saveFile() {
        return fake.dialogSaveFile;
      },
      async confirm(options) {
        fake.confirmCalls.push({ title: options.title, message: options.message });
        return fake.confirmResult;
      },
    },
    clipboard: {
      async readText() {
        return fake.clipboardText;
      },
      async writeText(text: string) {
        fake.clipboardText = text;
      },
    },
    power: {
      setLaunchAtLogin() {},
      isLaunchAtLoginEnabled() {
        return false;
      },
    },
    shortcuts: {
      register(accelerator, handler) {
        if (fake.failNextShortcut) {
          fake.failNextShortcut = false;
          return false;
        }
        fake.registeredShortcuts.set(accelerator, handler);
        return true;
      },
      unregister(accelerator) {
        fake.registeredShortcuts.delete(accelerator);
      },
      unregisterAll() {
        fake.registeredShortcuts.clear();
      },
    },
    process: {
      async isAvailable() {
        return true;
      },
      async spawnDetached(command, args): Promise<SpawnResult> {
        fake.spawned.push({ command, args });
        return { ok: true };
      },
    },
    capabilities() {
      return {
        platform: 'linux',
        globalShortcut: true,
        tray: true,
        launchAtLogin: true,
        applicationDiscovery: true,
        openExternal: true,
        fileDialogs: true,
        clipboard: true,
        ...capabilities,
      };
    },
  };

  return fake;
}
