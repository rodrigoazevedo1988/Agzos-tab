import { stat } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { ApplicationsCatalog } from '@main/applications/catalog';
import { darwinAdapter } from '@main/applications/adapters/darwin';
import { linuxAdapter } from '@main/applications/adapters/linux';
import { win32Adapter } from '@main/applications/adapters/win32';

import { makeFixtureDir, makeTempDir, writeFixture } from '../helpers/temp-dir';

import type { DiscoveryContext } from '@main/applications/types';

function context(roots: string[], platform: 'darwin' | 'win32' | 'linux'): DiscoveryContext {
  const warnings: string[] = [];
  const ctx: DiscoveryContext = {
    platform,
    homeDir: roots[0] ?? '/',
    env: {},
    roots,
    warn: (message) => warnings.push(message),
    maxDepth: 5,
  };
  return ctx;
}

describe('macOS discovery adapter', () => {
  it('finds .app bundles and de-duplicates them', async () => {
    const root = await makeTempDir();
    await makeFixtureDir(root, 'Alpha.app/Contents');
    await makeFixtureDir(root, 'Beta.app/Contents');
    await makeFixtureDir(root, 'NotAnApp/Contents');

    const records = await darwinAdapter.discover(context([root], 'darwin'));
    const names = records.map((record) => record.name).sort();
    expect(names).toEqual(['Alpha', 'Beta']);
    expect(records.every((record) => record.source === 'macos-applications')).toBe(true);
  });

  it('reports no records for a missing root', async () => {
    const records = await darwinAdapter.discover(context(['/definitely/not/here'], 'darwin'));
    expect(records).toEqual([]);
  });
});

describe('Windows discovery adapter', () => {
  it('finds .lnk and .exe files and skips uninstallers', async () => {
    const root = await makeTempDir();
    await writeFixture(root, 'Programs/Alpha.lnk', '');
    await writeFixture(root, 'Programs/Beta.exe', '');
    await writeFixture(root, 'Programs/uninstall-gamma.lnk', '');
    await writeFixture(root, 'Programs/notes.txt', '');

    const records = await win32Adapter.discover(context([root], 'win32'));
    const names = records.map((record) => record.name).sort();
    expect(names).toEqual(['Alpha', 'Beta']);
  });
});

describe('Linux discovery adapter', () => {
  it('parses .desktop entries and skips hidden ones', async () => {
    const root = await makeTempDir();
    await writeFixture(
      root,
      'alpha.desktop',
      '[Desktop Entry]\nType=Application\nName=Alpha Editor\nExec=alpha %U\n',
    );
    await writeFixture(
      root,
      'hidden.desktop',
      '[Desktop Entry]\nType=Application\nName=Hidden\nExec=hidden\nNoDisplay=true\n',
    );
    await writeFixture(
      root,
      'link.desktop',
      '[Desktop Entry]\nType=Link\nName=Website\nURL=https://example.com\n',
    );

    const records = await linuxAdapter.discover(context([root], 'linux'));
    expect(records.map((record) => record.name)).toEqual(['Alpha Editor']);
    expect(records[0]?.launchTarget).toBe('alpha');
  });
});

describe('ApplicationsCatalog', () => {
  it('scans, caches, searches and revalidates launch targets', async () => {
    const root = await makeTempDir();
    await makeFixtureDir(root, 'Alpha.app/Contents');
    await writeFixture(
      root,
      'Notes.desktop',
      '[Desktop Entry]\nType=Application\nName=Notes\nExec=notes\n',
    );

    const cacheDir = await makeTempDir();
    const catalog = new ApplicationsCatalog({
      platform: 'linux',
      homeDir: root,
      env: {},
      cacheDir,
      adapters: [linuxAdapter],
    });

    const refreshed = await catalog.refresh([root]);
    expect(refreshed.entries).toHaveLength(1);

    const results = await catalog.search('notes', 5);
    expect(results[0]?.name).toBe('Notes');

    // A second catalog instance reads the persisted cache without rescanning.
    const cachedCatalog = new ApplicationsCatalog({
      platform: 'linux',
      homeDir: root,
      env: {},
      cacheDir,
      adapters: [linuxAdapter],
    });
    expect(await cachedCatalog.loadCache()).not.toBeNull();
    expect((await cachedCatalog.list())[0]?.name).toBe('Notes');

    // The .desktop file itself is revalidated on disk for bare-command targets.
    const entry = await catalog.getById(results[0]?.id ?? '');
    expect(entry).toBeDefined();
    await stat(entry?.path ?? '');
    await expect(catalog.resolveLaunchTarget(entry?.id ?? '')).resolves.toEqual({ entry });
    await expect(catalog.resolveLaunchTarget('ghost-id')).resolves.toEqual({
      error: 'Application not found in the catalog',
    });
  });

  it('returns an English error when the target disappeared', async () => {
    const root = await makeTempDir();
    await writeFixture(
      root,
      'Gone.desktop',
      '[Desktop Entry]\nType=Application\nName=Gone\nExec=/missing/binary\n',
    );
    const catalog = new ApplicationsCatalog({
      platform: 'linux',
      homeDir: root,
      env: {},
      adapters: [linuxAdapter],
    });
    await catalog.refresh([root]);
    const [entry] = await catalog.list();
    const resolved = await catalog.resolveLaunchTarget(entry?.id ?? '');
    expect('error' in resolved && resolved.error).toContain('no longer available');
  });
});
