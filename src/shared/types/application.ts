import type { Platform } from './platform';

/** How an application entry was discovered on the host system. */
export type ApplicationSource =
  | 'windows-start-menu'
  | 'windows-apps-folder'
  | 'macos-applications'
  | 'macos-user-applications'
  | 'linux-desktop-user'
  | 'linux-desktop-system';

/** Normalised, serializable representation of an installed application. */
export interface ApplicationEntry {
  /** Stable identifier derived from the canonical path. */
  id: string;
  name: string;
  /** Executable file, `.app` bundle or `.desktop` launch target. */
  path: string;
  /** For Linux `.desktop`: the Exec command; for others equals `path`. */
  launchTarget: string;
  source: ApplicationSource;
  platform: Platform;
  keywords: string[];
  /** Present for macOS bundles when an `.icns` could be located. */
  iconPath?: string;
}

export interface ApplicationCatalog {
  platform: Platform;
  scannedAt: string;
  entries: ApplicationEntry[];
  /** Non-fatal problems (unreadable directories, malformed `.desktop` files). */
  warnings: string[];
}

/** Raw record produced by a platform adapter before normalisation. */
export interface RawApplicationRecord {
  name: string;
  path: string;
  launchTarget?: string;
  source: ApplicationSource;
  keywords?: string[];
  iconPath?: string;
}
