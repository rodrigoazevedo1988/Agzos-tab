import { promises as fs } from 'node:fs';
import path from 'node:path';

import { isDirectory, walk } from '../walk';

import type { RawApplicationRecord } from '@shared/types/application';
import type { Platform } from '@shared/types/platform';
import type { ApplicationAdapter, DiscoveryContext } from '../types';

/**
 * macOS discovery: scans the standard Applications directories for `.app`
 * bundles. Only well-known, user-readable locations are used — no Spotlight or
 * `mdfind` dependency.
 */
export const darwinAdapter: ApplicationAdapter = {
  id: 'darwin-applications',
  source: 'macos-applications',

  supports(platform: Platform): boolean {
    return platform === 'darwin';
  },

  defaultRoots(context: DiscoveryContext): string[] {
    const roots = [
      '/Applications',
      '/Applications/Utilities',
      '/System/Applications',
      '/System/Applications/Utilities',
      path.join(context.homeDir, 'Applications'),
    ];
    return roots;
  },

  async discover(context: DiscoveryContext): Promise<RawApplicationRecord[]> {
    const roots = context.roots.length > 0 ? context.roots : this.defaultRoots(context);
    const records: RawApplicationRecord[] = [];
    const seen = new Set<string>();

    for (const root of roots) {
      if (!(await isDirectory(root))) continue;
      const entries = await walk(root, {
        maxDepth: context.maxDepth ?? 3,
        onWarn: context.warn,
        shouldDescend: (entry) => !entry.name.endsWith('.app'),
      });

      for (const entry of entries) {
        if (!entry.isDirectory || !entry.name.endsWith('.app')) continue;
        if (seen.has(entry.path)) continue;
        seen.add(entry.path);

        const name = entry.name.replace(/\.app$/, '');
        const isUserPath = entry.path.startsWith(path.join(context.homeDir, 'Applications'));
        const iconPath = await findIcon(entry.path);
        records.push({
          name,
          path: entry.path,
          source: isUserPath ? 'macos-user-applications' : 'macos-applications',
          keywords: [name],
          ...(iconPath ? { iconPath } : {}),
        });
      }
    }

    return records;
  },
};

/** Locates the first `.icns` inside a bundle's Resources folder, if any. */
async function findIcon(bundlePath: string): Promise<string | undefined> {
  const resources = path.join(bundlePath, 'Contents', 'Resources');
  try {
    const dirents = await fs.readdir(resources, { withFileTypes: true });
    const icon = dirents.find((dirent) => dirent.isFile() && dirent.name.endsWith('.icns'));
    return icon ? path.join(resources, icon.name) : undefined;
  } catch {
    return undefined;
  }
}

export default darwinAdapter;
