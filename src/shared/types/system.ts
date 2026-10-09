import type { Platform } from './platform';

export interface AppInfo {
  name: string;
  version: string;
  platform: Platform;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
  isPackaged: boolean;
}

/** Runtime capabilities detected for the current host. */
export interface SystemCapabilities {
  platform: Platform;
  /** Global shortcut registration succeeded at boot. */
  globalShortcut: boolean;
  tray: boolean;
  launchAtLogin: boolean;
  /** `.desktop`/Start Menu/`/Applications` discovery is available. */
  applicationDiscovery: boolean;
  /** Opening URLs through the OS handler is permitted. */
  openExternal: boolean;
  /** Native file/folder pickers are available. */
  fileDialogs: boolean;
  clipboard: boolean;
}

export interface ShortcutRegistrationResult {
  ok: boolean;
  accelerator: string;
  /** Present when registration failed, e.g. `occupied`. */
  reason?: 'occupied' | 'invalid' | 'unsupported';
}
