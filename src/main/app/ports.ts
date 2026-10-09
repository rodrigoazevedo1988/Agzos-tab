import type { SystemCapabilities } from '@shared/types/system';

/**
 * Narrow interfaces around privileged OS behaviour. The main process injects
 * Electron-backed implementations; tests inject fakes. Services never import
 * `electron` directly, which keeps them unit-testable and auditable.
 */

export interface ShellPort {
  /** Returns an empty string on success, or a human-readable error message. */
  openPath(target: string): Promise<string>;
  openExternal(url: string): Promise<void>;
  showItemInFolder(target: string): void;
}

export interface SaveFileOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface DialogPort {
  openDirectory(): Promise<string | null>;
  openFiles(): Promise<string[]>;
  openFile(options?: {
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null>;
  saveFile(options?: SaveFileOptions): Promise<string | null>;
  confirm(options: { title: string; message: string; detail?: string }): Promise<boolean>;
}

/** Electron 44 exposes the clipboard asynchronously; the port mirrors that. */
export interface ClipboardPort {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface PowerPort {
  setLaunchAtLogin(enabled: boolean): void;
  isLaunchAtLoginEnabled(): boolean;
}

export interface ShortcutPort {
  register(accelerator: string, handler: () => void): boolean;
  unregister(accelerator: string): void;
  unregisterAll(): void;
}

export interface SpawnResult {
  ok: boolean;
  error?: string;
}

/**
 * Launches a detached process. There is no shell involved, so no string
 * interpolation or command injection is possible, and callers only pass
 * program names/absolute paths chosen by trusted command code — never raw user
 * input. Absolute paths must resolve to an existing executable; bare names are
 * resolved against `PATH`.
 */
export interface ProcessPort {
  isAvailable(command: string): Promise<boolean>;
  spawnDetached(command: string, args: readonly string[]): Promise<SpawnResult>;
}

export interface Ports {
  shell: ShellPort;
  dialog: DialogPort;
  clipboard: ClipboardPort;
  power: PowerPort;
  shortcuts: ShortcutPort;
  process: ProcessPort;
  capabilities(): SystemCapabilities;
}
