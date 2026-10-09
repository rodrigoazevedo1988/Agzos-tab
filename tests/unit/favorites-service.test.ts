import { describe, expect, it } from 'vitest';

import { FavoritesService } from '@main/services/favorites-service';

import { makeTempDir } from '../helpers/temp-dir';

describe('FavoritesService', () => {
  it('adds and removes favorites by toggle', async () => {
    const dir = await makeTempDir();
    const service = new FavoritesService(dir);
    await service.toggle({ id: 'a', kind: 'command', title: 'A' });
    expect(await service.ids()).toEqual(['a']);
    await service.toggle({ id: 'a', kind: 'command', title: 'A' });
    expect(await service.ids()).toEqual([]);
  });

  it('appends new favorites in order', async () => {
    const dir = await makeTempDir();
    const service = new FavoritesService(dir);
    await service.toggle({ id: 'a', kind: 'command', title: 'A' });
    await service.toggle({ id: 'b', kind: 'application', title: 'B' });
    const list = await service.list();
    expect(list.map((entry) => entry.order)).toEqual([0, 1]);
    expect(list.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('reorders and reindexes', async () => {
    const dir = await makeTempDir();
    const service = new FavoritesService(dir);
    await service.toggle({ id: 'a', kind: 'command', title: 'A' });
    await service.toggle({ id: 'b', kind: 'command', title: 'B' });
    await service.toggle({ id: 'c', kind: 'command', title: 'C' });
    const reordered = await service.reorder(['c', 'a', 'b']);
    expect(reordered.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(reordered.map((entry) => entry.order)).toEqual([0, 1, 2]);
  });

  it('appends ids missing from a reorder payload', async () => {
    const dir = await makeTempDir();
    const service = new FavoritesService(dir);
    await service.toggle({ id: 'a', kind: 'command', title: 'A' });
    await service.toggle({ id: 'b', kind: 'command', title: 'B' });
    const reordered = await service.reorder(['b']);
    expect(reordered.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('ignores unknown ids during reorder', async () => {
    const dir = await makeTempDir();
    const service = new FavoritesService(dir);
    await service.toggle({ id: 'a', kind: 'command', title: 'A' });
    const reordered = await service.reorder(['ghost', 'a']);
    expect(reordered.map((entry) => entry.id)).toEqual(['a']);
  });

  it('persists across instances', async () => {
    const dir = await makeTempDir();
    await new FavoritesService(dir).toggle({ id: 'a', kind: 'command', title: 'A' });
    expect(await new FavoritesService(dir).ids()).toEqual(['a']);
  });
});
