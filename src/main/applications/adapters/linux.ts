import { promises as fs } from 'node:fs';
import path from 'node:path';

import { isDirectory } from '../walk';

import type { RawApplicationRecord } from '@shared/types/application';
import type { Platform } from '@shared/types/platform';
import type { ApplicationAdapter, DiscoveryContext } from '../types';

interface DesktopEntry {
  name?: string;
  exec?: string;
  icon?: string;
  type?: string;
  noDisplay?: boolean;
  hidden?: boolean;
  onlyShowIn?: string;
}

/**
 * Linux discovery via Freedesktop `.desktop` entries. Covers the user and
 * system application directories plus the two common Flatpak export paths.
 * Entries marked `NoDisplay`/`Hidden` or that are not `Type=Application` are
 * skipped, as are those hidden by `OnlyShowIn` for other desktops.
 */
export const linuxAdapter: ApplicationAdapter = {
  id: 'linux-desktop-entries',
  source: 'linux-desktop-user',

  supports(platform: Platform): boolean {
    return platform === 'linux';
  },

  defaultRoots(context: DiscoveryContext): string[] {
    const dataHome = context.env['XDG_DATA_HOME'] ?? path.join(context.homeDir, '.local', 'share');
    const dataDirs = (context.env['XDG_DATA_DIRS'] ?? '/usr/local/share:/usr/share')
      .split(':')
      .filter(Boolean);
    const roots = [
      path.join(dataHome, 'applications'),
      path.join(dataHome, 'flatpak', 'exports', 'share', 'applications'),
      '/var/lib/flatpak/exports/share/applications',
      ...dataDirs.map((dir) => path.join(dir, 'applications')),
    ];
    return Array.from(new Set(roots));
  },

  async discover(context: DiscoveryContext): Promise<RawApplicationRecord[]> {
    const roots = context.roots.length > 0 ? context.roots : this.defaultRoots(context);
    const records: RawApplicationRecord[] = [];
    const seen = new Set<string>();

    for (const root of roots) {
      if (!(await isDirectory(root))) continue;
      let dirents;
      try {
        dirents = await fs.readdir(root, { withFileTypes: true });
      } catch {
        context.warn(`Could not read applications directory: ${root}`);
        continue;
      }

      for (const dirent of dirents) {
        if (!dirent.isFile() || !dirent.name.endsWith('.desktop')) continue;
        const full = path.join(root, dirent.name);
        let contents: string;
        try {
          contents = await fs.readFile(full, 'utf8');
        } catch {
          context.warn(`Could not read desktop entry: ${dirent.name}`);
          continue;
        }

        const entry = parseDesktopEntry(contents);
        const exec = entry.exec ? stripFieldCodes(entry.exec) : '';
        if (!entry.name || !exec) continue;
        if (entry.hidden === true || entry.noDisplay === true) continue;
        if (entry.type && entry.type !== 'Application') continue;
        if (entry.onlyShowIn && entry.onlyShowIn.split(';').filter(Boolean).length > 0) continue;

        const key = `${entry.name.toLowerCase()}|${exec}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const isUserRoot = root.includes(path.join('.local', 'share')) || root.includes('flatpak');
        records.push({
          name: entry.name,
          path: full,
          launchTarget: exec,
          source: isUserRoot ? 'linux-desktop-user' : 'linux-desktop-system',
          keywords: [entry.name, entry.exec ?? ''],
          ...(entry.icon ? { iconPath: entry.icon } : {}),
        });
      }
    }

    return records;
  },
};

/** Parses the `[Desktop Entry]` group of a desktop file. */
export function parseDesktopEntry(contents: string): DesktopEntry {
  const result: DesktopEntry = {};
  let inGroup = false;

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    if (line.startsWith('[')) {
      inGroup = line === '[Desktop Entry]';
      continue;
    }
    if (!inGroup) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    switch (key) {
      case 'Name':
        result.name = value;
        break;
      case 'Exec':
        result.exec = value;
        break;
      case 'Icon':
        result.icon = value;
        break;
      case 'Type':
        result.type = value;
        break;
      case 'NoDisplay':
        result.noDisplay = value === 'true';
        break;
      case 'Hidden':
        result.hidden = value === 'true';
        break;
      case 'OnlyShowIn':
        result.onlyShowIn = value;
        break;
      default:
        break;
    }
  }

  return result;
}

/** Removes Freedesktop field codes (`%U`, `%f`, …) from an Exec line. */
export function stripFieldCodes(exec: string): string {
  return exec
    .replace(/%[fFuUdDnNickvm]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default linuxAdapter;
