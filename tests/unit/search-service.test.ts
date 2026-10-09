import { describe, expect, it } from 'vitest';

import { ApplicationsCatalog } from '@main/applications/catalog';
import { defineCommand, success } from '@main/commands/define';
import { CommandRegistry } from '@main/commands/registry';
import { FavoritesService } from '@main/services/favorites-service';
import { HistoryService } from '@main/services/history-service';
import { SearchService } from '@main/services/search/search-service';
import { SettingsService } from '@main/services/settings-service';

import { makeTempDir } from '../helpers/temp-dir';

import type { CommandMetadata } from '@shared/types/command';

function metadata(overrides: Partial<CommandMetadata>): CommandMetadata {
  return {
    id: 'cmd',
    name: 'Command',
    description: 'Description',
    category: 'tools',
    keywords: [],
    icon: 'Circle',
    enabled: true,
    source: 'builtin',
    riskLevel: 'safe',
    ...overrides,
  };
}

async function makeSearch(): Promise<{
  search: SearchService;
  registry: CommandRegistry;
  favorites: FavoritesService;
  history: HistoryService;
  settings: SettingsService;
}> {
  const dir = await makeTempDir();
  const registry = new CommandRegistry();
  registry.register(
    defineCommand(
      metadata({ id: 'system.open-calculator', name: 'Open Calculator', keywords: ['math'] }),
      async () => success(),
    ),
  );
  registry.register(
    defineCommand(
      metadata({
        id: 'history.clear',
        name: 'Clear History',
        category: 'settings',
        keywords: ['cleanup'],
      }),
      async () => success(),
    ),
  );

  const favorites = new FavoritesService(dir);
  const history = new HistoryService(dir, () => ({ enabled: true, maxEntries: 20 }));
  const settings = new SettingsService(dir);
  await settings.init();

  // No adapters → the catalog never scans the filesystem during tests.
  const catalog = new ApplicationsCatalog({
    platform: 'linux',
    homeDir: dir,
    env: {},
    adapters: [],
  });

  const search = new SearchService(registry, catalog, favorites, history, settings);
  return { search, registry, favorites, history, settings };
}

describe('SearchService', () => {
  it('finds matching commands and groups them', async () => {
    const { search } = await makeSearch();
    const response = await search.search('calculator');
    expect(response.total).toBeGreaterThan(0);
    expect(response.groups.flatMap((group) => group.items).map((item) => item.id)).toContain(
      'system.open-calculator',
    );
    expect(response.groups.every((group) => group.items.length > 0)).toBe(true);
  });

  it('returns an empty result set for a non-matching query', async () => {
    const { search } = await makeSearch();
    const response = await search.search('zzzzzznotfound');
    expect(response.total).toBe(0);
    expect(response.groups).toHaveLength(0);
  });

  it('boosts favorites above equally relevant results', async () => {
    const { search, favorites } = await makeSearch();
    await favorites.toggle({ id: 'history.clear', kind: 'command', title: 'Clear History' });
    const response = await search.search('clear');
    const flat = response.groups.flatMap((group) => group.items);
    const favorite = flat.find((item) => item.id === 'history.clear');
    expect(favorite?.isFavorite).toBe(true);
  });

  it('marks favorites in results', async () => {
    const { search, favorites } = await makeSearch();
    await favorites.toggle({
      id: 'system.open-calculator',
      kind: 'command',
      title: 'Open Calculator',
    });
    const response = await search.search('calculator');
    const item = response.groups
      .flatMap((group) => group.items)
      .find((candidate) => candidate.id === 'system.open-calculator');
    expect(item?.isFavorite).toBe(true);
  });

  it('respects the maximum results setting', async () => {
    const { search, settings } = await makeSearch();
    await settings.update({ search: { maxResults: 1 } });
    const response = await search.search('');
    const flat = response.groups.flatMap((group) => group.items);
    expect(flat).toHaveLength(1);
  });

  it('reports the elapsed time', async () => {
    const { search } = await makeSearch();
    const response = await search.search('calc');
    expect(response.tookMs).toBeGreaterThanOrEqual(0);
  });
});
