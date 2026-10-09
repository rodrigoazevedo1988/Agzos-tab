import path from 'node:path';

import { isDirectory, walk } from '../walk';

import type { RawApplicationRecord } from '@shared/types/application';
import type { Platform } from '@shared/types/platform';
import type { ApplicationAdapter, DiscoveryContext } from '../types';

/** Shortcuts that are not user-facing applications. */
const IGNORED_NAME_PATTERNS = [
  /^uninstall/i,
  /^unins\d/i,
  /^desinstalar/i,
  /^remove\s/i,
  /^setup$/i,
  /^readme/i,
  /^help$/i,
];

/**
 * Windows discovery based on Start Menu shortcuts (`.lnk`) and executables
 * (`.exe`). The registry is intentionally *not* used: it would require parsing
 * binary hives and often returns uninstaller entries rather than apps.
 */
export const win32Adapter: ApplicationAdapter = {
  id: 'win32-start-menu',
  source: 'windows-start-menu',

  supports(platform: Platform): boolean {
    return platform === 'win32';
  },

  defaultRoots(context: DiscoveryContext): string[] {
    const programData = context.env['ProgramData'] ?? 'C:\\ProgramData';
    const appData = context.env['APPDATA'] ?? '';
    const roots = [path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs')];
    if (appData) {
      roots.push(path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
    }
    return roots;
  },

  async discover(context: DiscoveryContext): Promise<RawApplicationRecord[]> {
    const roots = context.roots.length > 0 ? context.roots : this.defaultRoots(context);
    const records: RawApplicationRecord[] = [];
    const seen = new Set<string>();

    for (const root of roots) {
      if (!(await isDirectory(root))) continue;
      const entries = await walk(root, {
        maxDepth: context.maxDepth ?? 5,
        onWarn: context.warn,
      });

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const lower = entry.name.toLowerCase();
        if (!lower.endsWith('.lnk') && !lower.endsWith('.exe')) continue;
        const name = entry.name.replace(/\.(lnk|exe)$/i, '');
        if (IGNORED_NAME_PATTERNS.some((pattern) => pattern.test(name))) continue;

        const key = `${name.toLowerCase()}|${entry.path.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        records.push({
          name,
          path: entry.path,
          source: 'windows-start-menu',
          keywords: [name],
        });
      }
    }

    return records;
  },
};

export default win32Adapter;
